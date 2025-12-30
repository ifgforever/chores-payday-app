// ============================================
// Parent Login Endpoint
// POST /api/auth/login
// ============================================

import { 
  verifyPassword, 
  isValidEmail,
  errorResponse, 
  jsonResponse,
  setSessionCookie 
} from "../../_util.js";
import { createSession, checkRateLimit, resetRateLimit } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    
    // Validate inputs
    if (!email || !isValidEmail(email)) {
      return errorResponse("Valid email is required");
    }
    
    if (!password) {
      return errorResponse("Password is required");
    }
    
    // Rate limit by email
    const rateCheck = await checkRateLimit(env, `login:${email}`, 5, 15, 30);
    if (!rateCheck.ok) {
      return errorResponse(`Too many login attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 60)} minutes.`, 429);
    }
    
    // Find parent by email
    const parent = await env.DB.prepare(`
      SELECT id, email, password_hash, display_name 
      FROM parents 
      WHERE email = ?
    `).bind(email).first();
    
    if (!parent) {
      // Don't reveal whether email exists
      return errorResponse("Invalid email or password", 401);
    }
    
    // Verify password
    const validPassword = await verifyPassword(password, parent.password_hash);
    if (!validPassword) {
      return errorResponse("Invalid email or password", 401);
    }
    
    // Create session
    const sessionId = await createSession(env, parent.id, "parent", request);
    
    // Reset rate limit on successful login
    await resetRateLimit(env, `login:${email}`);
    
    const response = jsonResponse({
      message: "Login successful",
      parent: {
        id: parent.id,
        email: parent.email,
        displayName: parent.display_name
      }
    });
    
    response.headers.set("Set-Cookie", setSessionCookie(sessionId));
    return response;
    
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Login failed", 500);
  }
}
