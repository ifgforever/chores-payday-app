// ============================================
// Children Management Endpoint (Parent Only)
// GET /api/parent/children - List all children
// POST /api/parent/children - Create a new child
// ============================================

import { 
  uid, 
  generateChildCode, 
  hashPin,
  isValidPin,
  errorResponse, 
  jsonResponse 
} from "../../_util.js";
import { requireParent } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  // Verify parent authentication
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const rows = await env.DB.prepare(`
      SELECT id, display_name, child_code, pin_enabled, created_at
      FROM children 
      WHERE parent_id = ? 
      ORDER BY created_at DESC
    `).bind(auth.parent.id).all();
    
    return jsonResponse({
      children: rows.results || []
    });
    
  } catch (error) {
    console.error("List children error:", error);
    return errorResponse("Failed to list children", 500);
  }
}

export async function onRequestPost({ request, env }) {
  // Verify parent authentication
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const displayName = (body.display_name || body.displayName || body.name || "").trim();
    const pin = (body.pin || "").trim();
    
    if (!displayName) {
      return errorResponse("Child name is required");
    }
    
    // Generate unique child code (retry if collision)
    let childCode;
    let attempts = 0;
    while (attempts < 10) {
      childCode = generateChildCode();
      const existing = await env.DB.prepare(
        "SELECT id FROM children WHERE child_code = ?"
      ).bind(childCode).first();
      if (!existing) break;
      attempts++;
    }
    
    if (attempts >= 10) {
      return errorResponse("Failed to generate unique child code", 500);
    }
    
    const childId = uid("C_");
    let pinHash = null;
    let pinEnabled = 0;
    
    // If PIN provided, validate and hash it
    if (pin) {
      if (!isValidPin(pin)) {
        return errorResponse("PIN must be 4-6 digits");
      }
      pinHash = await hashPin(pin);
      pinEnabled = 1;
    }
    
    await env.DB.prepare(`
      INSERT INTO children (id, parent_id, display_name, child_code, pin_hash, pin_enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(childId, auth.parent.id, displayName, childCode, pinHash, pinEnabled).run();
    
    return jsonResponse({
      message: "Child created successfully",
      child: {
        id: childId,
        displayName: displayName,
        childCode: childCode,
        pinEnabled: pinEnabled === 1
      }
    }, 201);
    
  } catch (error) {
    console.error("Create child error:", error);
    return errorResponse("Failed to create child", 500);
  }
}
