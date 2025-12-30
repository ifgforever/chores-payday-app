// ============================================
// Authentication Middleware
// ============================================

import { parseCookies, errorResponse } from "./_util.js";

/**
 * Get session from cookie and validate it
 * Returns: { ok: true, session, user } or { ok: false, error }
 */
export async function getSession(request, env) {
  const cookies = parseCookies(request);
  const sessionId = cookies.session;
  
  if (!sessionId) {
    return { ok: false, error: "Not authenticated" };
  }
  
  // Look up session in database
  const session = await env.DB.prepare(`
    SELECT id, user_id, user_type, expires_at 
    FROM sessions 
    WHERE id = ?
  `).bind(sessionId).first();
  
  if (!session) {
    return { ok: false, error: "Invalid session" };
  }
  
  // Check if session is expired
  const now = new Date().toISOString();
  if (session.expires_at < now) {
    // Clean up expired session
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return { ok: false, error: "Session expired" };
  }
  
  // Get user data based on type
  let user = null;
  if (session.user_type === "parent") {
    user = await env.DB.prepare(`
      SELECT id, email, display_name 
      FROM parents 
      WHERE id = ?
    `).bind(session.user_id).first();
  } else if (session.user_type === "child") {
    user = await env.DB.prepare(`
      SELECT id, parent_id, display_name, child_code 
      FROM children 
      WHERE id = ?
    `).bind(session.user_id).first();
  }
  
  if (!user) {
    return { ok: false, error: "User not found" };
  }
  
  return { 
    ok: true, 
    session: {
      id: session.id,
      userId: session.user_id,
      userType: session.user_type,
      expiresAt: session.expires_at
    },
    user 
  };
}

/**
 * Require parent authentication
 * Use this middleware for parent-only routes
 */
export async function requireParent(request, env) {
  const auth = await getSession(request, env);
  
  if (!auth.ok) {
    return { ok: false, error: auth.error, status: 401 };
  }
  
  if (auth.session.userType !== "parent") {
    return { ok: false, error: "Parent access required", status: 403 };
  }
  
  return { ok: true, parent: auth.user, session: auth.session };
}

/**
 * Require child authentication
 * Use this middleware for child-only routes
 */
export async function requireChild(request, env) {
  const auth = await getSession(request, env);
  
  if (!auth.ok) {
    return { ok: false, error: auth.error, status: 401 };
  }
  
  if (auth.session.userType !== "child") {
    return { ok: false, error: "Child access required", status: 403 };
  }
  
  return { ok: true, child: auth.user, session: auth.session };
}

/**
 * Create a new session
 */
export async function createSession(env, userId, userType, request, maxAgeDays = 7) {
  const { generateSessionId } = await import("./_util.js");
  
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const ipAddress = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, user_type, expires_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(sessionId, userId, userType, expiresAt, ipAddress, userAgent).run();
  
  return sessionId;
}

/**
 * Delete a session
 */
export async function deleteSession(env, sessionId) {
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Clean up expired sessions (call periodically)
 */
export async function cleanupExpiredSessions(env) {
  const now = new Date().toISOString();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
}

/**
 * Rate limiting check
 * Returns { ok: true } if allowed, { ok: false, retryAfter } if rate limited
 */
export async function checkRateLimit(env, key, maxAttempts = 5, windowMinutes = 15, lockoutMinutes = 30) {
  const now = new Date();
  const nowISO = now.toISOString();
  
  // Get current rate limit record
  const record = await env.DB.prepare(`
    SELECT attempts, first_attempt, locked_until 
    FROM rate_limits 
    WHERE key = ?
  `).bind(key).first();
  
  if (record) {
    // Check if currently locked out
    if (record.locked_until && record.locked_until > nowISO) {
      const retryAfter = Math.ceil((new Date(record.locked_until) - now) / 1000);
      return { ok: false, error: "Too many attempts", retryAfter };
    }
    
    // Check if window has expired (reset)
    const windowStart = new Date(record.first_attempt);
    const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
    
    if (now > windowEnd) {
      // Reset the window
      await env.DB.prepare(`
        UPDATE rate_limits 
        SET attempts = 1, first_attempt = ?, locked_until = NULL 
        WHERE key = ?
      `).bind(nowISO, key).run();
      return { ok: true };
    }
    
    // Within window, check attempts
    if (record.attempts >= maxAttempts) {
      // Lock out
      const lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString();
      await env.DB.prepare(`
        UPDATE rate_limits 
        SET locked_until = ? 
        WHERE key = ?
      `).bind(lockedUntil, key).run();
      return { ok: false, error: "Too many attempts", retryAfter: lockoutMinutes * 60 };
    }
    
    // Increment attempts
    await env.DB.prepare(`
      UPDATE rate_limits 
      SET attempts = attempts + 1 
      WHERE key = ?
    `).bind(key).run();
    
    return { ok: true };
  }
  
  // No record, create one
  await env.DB.prepare(`
    INSERT INTO rate_limits (id, key, attempts, first_attempt)
    VALUES (?, ?, 1, ?)
  `).bind(crypto.randomUUID(), key, nowISO).run();
  
  return { ok: true };
}

/**
 * Reset rate limit on successful action
 */
export async function resetRateLimit(env, key) {
  await env.DB.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
}
