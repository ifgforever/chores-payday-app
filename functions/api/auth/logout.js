// ============================================
// Logout Endpoint (works for both parent and child)
// POST /api/auth/logout
// ============================================

import { 
  parseCookies,
  errorResponse, 
  jsonResponse,
  clearSessionCookie 
} from "../../_util.js";
import { deleteSession } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const cookies = parseCookies(request);
    const sessionId = cookies.session;
    
    if (sessionId) {
      // Delete session from database
      await deleteSession(env, sessionId);
    }
    
    const response = jsonResponse({
      message: "Logged out successfully"
    });
    
    // Clear the session cookie
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
    
  } catch (error) {
    console.error("Logout error:", error);
    // Still clear cookie even if there's an error
    const response = jsonResponse({
      message: "Logged out"
    });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  }
}
