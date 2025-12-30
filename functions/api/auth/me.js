// ============================================
// Session Check Endpoint
// GET /api/auth/me
// Returns current user info if authenticated
// ============================================

import { errorResponse, jsonResponse } from "../../_util.js";
import { getSession } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  try {
    const auth = await getSession(request, env);
    
    if (!auth.ok) {
      return errorResponse(auth.error, 401);
    }
    
    return jsonResponse({
      authenticated: true,
      userType: auth.session.userType,
      user: auth.user,
      session: {
        expiresAt: auth.session.expiresAt
      }
    });
    
  } catch (error) {
    console.error("Session check error:", error);
    return errorResponse("Failed to check session", 500);
  }
}
