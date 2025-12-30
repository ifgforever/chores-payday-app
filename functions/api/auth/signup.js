// ============================================
// Parent Signup Endpoint
// POST /api/auth/signup
// ============================================

import { 
  uid, 
  hashPassword, 
  isValidEmail, 
  isValidPassword, 
  errorResponse, 
  jsonResponse,
  setSessionCookie 
} from "../../_util.js";
import { createSession, checkRateLimit, resetRateLimit } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const rateCheck = await checkRateLimit(env, `signup:${ip}`, 5, 60, 60);
    if (!rateCheck.ok) {
      return errorResponse(`Too many signup attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 60)} minutes.`, 429);
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const displayName = (body.display_name || body.displayName || "").trim();
    
    // Validate inputs
    if (!email || !isValidEmail(email)) {
      return errorResponse("Valid email is required");
    }
    
    if (!isValidPassword(password)) {
      return errorResponse("Password must be at least 8 characters");
    }
    
    // Check if email already exists
    const existing = await env.DB.prepare(
      "SELECT id FROM parents WHERE email = ?"
    ).bind(email).first();
    
    if (existing) {
      return errorResponse("An account with this email already exists");
    }
    
    // Create parent account
    const parentId = uid("P_");
    const passwordHash = await hashPassword(password);
    
    await env.DB.prepare(`
      INSERT INTO parents (id, email, password_hash, display_name)
      VALUES (?, ?, ?, ?)
    `).bind(parentId, email, passwordHash, displayName || null).run();
    
    // Create default weekly rules
    await env.DB.prepare(`
      INSERT INTO weekly_rules (id, parent_id, weekly_cap_points, strict_mode, payday_day)
      VALUES (?, ?, 100, 1, 5)
    `).bind(uid("WR_"), parentId).run();
    
    // Create session and set cookie
    const sessionId = await createSession(env, parentId, "parent", request);
    
    // Reset rate limit on success
    await resetRateLimit(env, `signup:${ip}`);
    
    const response = jsonResponse({
      message: "Account created successfully",
      parent: {
        id: parentId,
        email: email,
        displayName: displayName || null
      }
    }, 201);
    
    response.headers.set("Set-Cookie", setSessionCookie(sessionId));
    return response;
    
  } catch (error) {
    console.error("Signup error:", error);
    return errorResponse("Failed to create account", 500);
  }
}
