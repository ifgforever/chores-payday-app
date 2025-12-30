// ============================================
// Single Child Management Endpoint (Parent Only)
// GET /api/parent/children/[id] - Get child details
// PUT /api/parent/children/[id] - Update child
// DELETE /api/parent/children/[id] - Delete child
// ============================================

import { 
  generateChildCode, 
  hashPin,
  isValidPin,
  errorResponse, 
  jsonResponse 
} from "../../../_util.js";
import { requireParent } from "../../../_auth.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  const childId = params.id;
  
  try {
    const child = await env.DB.prepare(`
      SELECT id, display_name, child_code, pin_enabled, created_at
      FROM children 
      WHERE id = ? AND parent_id = ?
    `).bind(childId, auth.parent.id).first();
    
    if (!child) {
      return errorResponse("Child not found", 404);
    }
    
    return jsonResponse({ child });
    
  } catch (error) {
    console.error("Get child error:", error);
    return errorResponse("Failed to get child", 500);
  }
}

export async function onRequestPut({ request, env, params }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  const childId = params.id;
  
  try {
    // Verify child belongs to this parent
    const child = await env.DB.prepare(`
      SELECT id FROM children WHERE id = ? AND parent_id = ?
    `).bind(childId, auth.parent.id).first();
    
    if (!child) {
      return errorResponse("Child not found", 404);
    }
    
    const body = await request.json().catch(() => ({}));
    const updates = [];
    const values = [];
    
    // Update display name
    if (body.display_name || body.displayName || body.name) {
      const name = (body.display_name || body.displayName || body.name).trim();
      if (name) {
        updates.push("display_name = ?");
        values.push(name);
      }
    }
    
    // Update PIN
    if (body.pin !== undefined) {
      if (body.pin === null || body.pin === "") {
        // Disable PIN
        updates.push("pin_hash = NULL");
        updates.push("pin_enabled = 0");
      } else {
        if (!isValidPin(body.pin)) {
          return errorResponse("PIN must be 4-6 digits");
        }
        const pinHash = await hashPin(body.pin);
        updates.push("pin_hash = ?");
        values.push(pinHash);
        updates.push("pin_enabled = 1");
      }
    }
    
    // Regenerate child code
    if (body.regenerate_code || body.regenerateCode) {
      let newCode;
      let attempts = 0;
      while (attempts < 10) {
        newCode = generateChildCode();
        const existing = await env.DB.prepare(
          "SELECT id FROM children WHERE child_code = ? AND id != ?"
        ).bind(newCode, childId).first();
        if (!existing) break;
        attempts++;
      }
      if (attempts >= 10) {
        return errorResponse("Failed to generate unique child code", 500);
      }
      updates.push("child_code = ?");
      values.push(newCode);
    }
    
    if (updates.length === 0) {
      return errorResponse("No valid updates provided");
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(childId);
    values.push(auth.parent.id);
    
    await env.DB.prepare(`
      UPDATE children 
      SET ${updates.join(", ")}
      WHERE id = ? AND parent_id = ?
    `).bind(...values).run();
    
    // Fetch updated child
    const updated = await env.DB.prepare(`
      SELECT id, display_name, child_code, pin_enabled, created_at
      FROM children 
      WHERE id = ?
    `).bind(childId).first();
    
    return jsonResponse({
      message: "Child updated successfully",
      child: updated
    });
    
  } catch (error) {
    console.error("Update child error:", error);
    return errorResponse("Failed to update child", 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  const childId = params.id;
  
  try {
    // Verify child belongs to this parent
    const child = await env.DB.prepare(`
      SELECT id FROM children WHERE id = ? AND parent_id = ?
    `).bind(childId, auth.parent.id).first();
    
    if (!child) {
      return errorResponse("Child not found", 404);
    }
    
    // Delete child (cascades to chore_instances, notifications)
    await env.DB.prepare("DELETE FROM children WHERE id = ?").bind(childId).run();
    
    return jsonResponse({
      message: "Child deleted successfully"
    });
    
  } catch (error) {
    console.error("Delete child error:", error);
    return errorResponse("Failed to delete child", 500);
  }
}
