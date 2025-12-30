// ============================================
// Single Chore Management Endpoint (Parent Only)
// GET /api/parent/chores/[id] - Get chore details
// PUT /api/parent/chores/[id] - Update chore
// DELETE /api/parent/chores/[id] - Delete chore
// ============================================

import { errorResponse, jsonResponse } from "../../../_util.js";
import { requireParent } from "../../../_auth.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  const choreId = params.id;
  
  try {
    const chore = await env.DB.prepare(`
      SELECT id, title, description, points, is_required, active, created_at
      FROM chores 
      WHERE id = ? AND parent_id = ?
    `).bind(choreId, auth.parent.id).first();
    
    if (!chore) {
      return errorResponse("Chore not found", 404);
    }
    
    return jsonResponse({ chore });
    
  } catch (error) {
    console.error("Get chore error:", error);
    return errorResponse("Failed to get chore", 500);
  }
}

export async function onRequestPut({ request, env, params }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  const choreId = params.id;
  
  try {
    // Verify chore belongs to this parent
    const chore = await env.DB.prepare(`
      SELECT id FROM chores WHERE id = ? AND parent_id = ?
    `).bind(choreId, auth.parent.id).first();
    
    if (!chore) {
      return errorResponse("Chore not found", 404);
    }
    
    const body = await request.json().catch(() => ({}));
    const updates = [];
    const values = [];
    
    if (body.title !== undefined) {
      const title = (body.title || "").trim();
      if (!title) {
        return errorResponse("Chore title cannot be empty");
      }
      updates.push("title = ?");
      values.push(title);
    }
    
    if (body.description !== undefined) {
      updates.push("description = ?");
      values.push(body.description ? body.description.trim() : null);
    }
    
    if (body.points !== undefined) {
      const points = Number(body.points);
      if (!Number.isFinite(points) || points < 0) {
        return errorResponse("Points must be a non-negative number");
      }
      updates.push("points = ?");
      values.push(points);
    }
    
    if (body.is_required !== undefined || body.isRequired !== undefined) {
      const isRequired = (body.is_required || body.isRequired) ? 1 : 0;
      updates.push("is_required = ?");
      values.push(isRequired);
    }
    
    if (body.active !== undefined) {
      updates.push("active = ?");
      values.push(body.active ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return errorResponse("No valid updates provided");
    }
    
    updates.push("updated_at = datetime('now')");
    values.push(choreId);
    values.push(auth.parent.id);
    
    await env.DB.prepare(`
      UPDATE chores 
      SET ${updates.join(", ")}
      WHERE id = ? AND parent_id = ?
    `).bind(...values).run();
    
    // Fetch updated chore
    const updated = await env.DB.prepare(`
      SELECT id, title, description, points, is_required, active, created_at
      FROM chores 
      WHERE id = ?
    `).bind(choreId).first();
    
    return jsonResponse({
      message: "Chore updated successfully",
      chore: updated
    });
    
  } catch (error) {
    console.error("Update chore error:", error);
    return errorResponse("Failed to update chore", 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  const choreId = params.id;
  
  try {
    // Verify chore belongs to this parent
    const chore = await env.DB.prepare(`
      SELECT id FROM chores WHERE id = ? AND parent_id = ?
    `).bind(choreId, auth.parent.id).first();
    
    if (!chore) {
      return errorResponse("Chore not found", 404);
    }
    
    // Delete chore (cascades to chore_instances)
    await env.DB.prepare("DELETE FROM chores WHERE id = ?").bind(choreId).run();
    
    return jsonResponse({
      message: "Chore deleted successfully"
    });
    
  } catch (error) {
    console.error("Delete chore error:", error);
    return errorResponse("Failed to delete chore", 500);
  }
}
