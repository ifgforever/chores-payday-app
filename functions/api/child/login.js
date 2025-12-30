// ============================================
// Child Login Endpoint
// POST /api/child/login
// ============================================

import { 
  verifyPin,
  errorResponse, 
  jsonResponse,
  setSessionCookie 
} from "../../_util.js";
import { createSession, checkRateLimit, resetRateLimit } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const childCode = (body.child_code || body.childCode || body.code || "").trim().toUpperCase();
    const pin = (body.pin || "").trim();
    
    if (!childCode) {
      return errorResponse("Child code is required");
    }
    
    // Rate limit by child code
    const rateCheck = await checkRateLimit(env, `child:${childCode}`, 5, 15, 30);
    if (!rateCheck.ok) {
      return errorResponse(`Too many attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 60)} minutes.`, 429);
    }
    
    // Find child by code
    const child = await env.DB.prepare(`
      SELECT id, parent_id, display_name, child_code, pin_hash, pin_enabled, 
             pin_attempts, pin_locked_until
      FROM children 
      WHERE child_code = ?
    `).bind(childCode).first();
    
    if (!child) {
      // Don't reveal whether code exists
      return errorResponse("Invalid child code or PIN", 401);
    }
    
    // Check if PIN-locked
    if (child.pin_locked_until) {
      const now = new Date().toISOString();
      if (child.pin_locked_until > now) {
        return errorResponse("Too many failed attempts. Try again later.", 429);
      }
    }
    
    // If PIN is enabled, verify it
    if (child.pin_enabled) {
      if (!pin) {
        return errorResponse("PIN is required");
      }
      
      const validPin = await verifyPin(pin, child.pin_hash);
      if (!validPin) {
        // Increment PIN attempts
        const newAttempts = (child.pin_attempts || 0) + 1;
        
        if (newAttempts >= 5) {
          // Lock out for 30 minutes
          const lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          await env.DB.prepare(`
            UPDATE children 
            SET pin_attempts = ?, pin_locked_until = ?
            WHERE id = ?
          `).bind(newAttempts, lockedUntil, child.id).run();
          return errorResponse("Too many failed attempts. Try again in 30 minutes.", 429);
        }
        
        await env.DB.prepare(`
          UPDATE children 
          SET pin_attempts = ?
          WHERE id = ?
        `).bind(newAttempts, child.id).run();
        
        return errorResponse("Invalid child code or PIN", 401);
      }
      
      // Reset PIN attempts on success
      await env.DB.prepare(`
        UPDATE children 
        SET pin_attempts = 0, pin_locked_until = NULL
        WHERE id = ?
      `).bind(child.id).run();
    }
    
    // Create child session (shorter duration than parent: 1 day)
    const sessionId = await createSession(env, child.id, "child", request, 1);
    
    // Reset rate limit on success
    await resetRateLimit(env, `child:${childCode}`);
    
    const response = jsonResponse({
      message: "Login successful",
      child: {
        id: child.id,
        displayName: child.display_name,
        childCode: child.child_code
      }
    });
    
    response.headers.set("Set-Cookie", setSessionCookie(sessionId, 24 * 60 * 60)); // 1 day
    return response;
    
  } catch (error) {
    console.error("Child login error:", error);
    return errorResponse("Login failed", 500);
  }
}
