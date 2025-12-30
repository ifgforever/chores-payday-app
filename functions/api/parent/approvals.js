// ============================================
// Approvals Management Endpoint (Parent Only)
// GET /api/parent/approvals - List pending approvals
// POST /api/parent/approvals - Approve/reject a chore instance
// ============================================

import { 
  uid,
  todayYYYYMMDD, 
  errorResponse, 
  jsonResponse 
} from "../../_util.js";
import { requireParent } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || todayYYYYMMDD();
    
    // Get all pending submissions for this parent's children
    const rows = await env.DB.prepare(`
      SELECT 
        ci.id,
        ci.chore_id,
        ci.child_id,
        ci.date,
        ci.status,
        ci.submitted_at,
        ci.notes,
        c.display_name AS child_name,
        ch.title AS chore_title,
        ch.points,
        ch.is_required
      FROM chore_instances ci
      JOIN children c ON c.id = ci.child_id
      JOIN chores ch ON ch.id = ci.chore_id
      WHERE c.parent_id = ?
        AND ci.status = 'submitted'
        AND ci.date = ?
      ORDER BY c.display_name ASC, ch.is_required DESC, ch.title ASC
    `).bind(auth.parent.id, date).all();
    
    return jsonResponse({
      date: date,
      approvals: rows.results || []
    });
    
  } catch (error) {
    console.error("List approvals error:", error);
    return errorResponse("Failed to list approvals", 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const instanceId = (body.instance_id || body.instanceId || body.id || "").trim();
    const action = (body.action || "").trim().toLowerCase();
    const notes = (body.notes || "").trim();
    
    if (!instanceId) {
      return errorResponse("Instance ID is required");
    }
    
    if (!["approved", "rejected", "excused"].includes(action)) {
      return errorResponse("Action must be 'approved', 'rejected', or 'excused'");
    }
    
    // Verify this instance belongs to a child of this parent
    const instance = await env.DB.prepare(`
      SELECT ci.id, ci.child_id, ci.chore_id, ci.status, ch.points
      FROM chore_instances ci
      JOIN children c ON c.id = ci.child_id
      JOIN chores ch ON ch.id = ci.chore_id
      WHERE ci.id = ? AND c.parent_id = ?
    `).bind(instanceId, auth.parent.id).first();
    
    if (!instance) {
      return errorResponse("Chore instance not found", 404);
    }
    
    if (instance.status !== "submitted") {
      return errorResponse(`Cannot ${action} a chore that is not submitted (current status: ${instance.status})`);
    }
    
    // Update the instance
    await env.DB.prepare(`
      UPDATE chore_instances 
      SET status = ?, 
          reviewed_at = datetime('now'), 
          reviewed_by = ?,
          notes = CASE WHEN ? != '' THEN ? ELSE notes END
      WHERE id = ?
    `).bind(action, auth.parent.id, notes, notes, instanceId).run();
    
    // Create notification for child
    let message;
    if (action === "approved") {
      message = `✅ "${instance.chore_title || 'Chore'}" approved! +${instance.points} points`;
    } else if (action === "rejected") {
      message = `❌ "${instance.chore_title || 'Chore'}" was not approved${notes ? ': ' + notes : ''}`;
    } else {
      message = `📋 "${instance.chore_title || 'Chore'}" marked as excused`;
    }
    
    await env.DB.prepare(`
      INSERT INTO notifications (id, child_id, message, type)
      VALUES (?, ?, ?, ?)
    `).bind(uid("N_"), instance.child_id, message, action === "approved" ? "success" : "info").run();
    
    return jsonResponse({
      message: `Chore ${action} successfully`,
      instance_id: instanceId,
      new_status: action
    });
    
  } catch (error) {
    console.error("Process approval error:", error);
    return errorResponse("Failed to process approval", 500);
  }
}
