// ============================================
// Child Chores Endpoint
// GET /api/child/chores - Get today's chores for the logged-in child
// POST /api/child/chores - Mark a chore as complete (submit for approval)
// ============================================

import { 
  uid,
  todayYYYYMMDD, 
  errorResponse, 
  jsonResponse 
} from "../../_util.js";
import { requireChild } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireChild(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const date = todayYYYYMMDD();
    
    // Get all active chores for this child's parent, with today's status
    const rows = await env.DB.prepare(`
      SELECT 
        ch.id,
        ch.title,
        ch.description,
        ch.points,
        ch.is_required,
        (
          SELECT ci.status 
          FROM chore_instances ci 
          WHERE ci.chore_id = ch.id 
            AND ci.child_id = ? 
            AND ci.date = ?
          LIMIT 1
        ) AS today_status
      FROM chores ch
      WHERE ch.parent_id = ? 
        AND ch.active = 1
      ORDER BY ch.is_required DESC, ch.title ASC
    `).bind(auth.child.id, date, auth.child.parent_id).all();
    
    // Calculate stats
    const chores = rows.results || [];
    const total = chores.length;
    const completed = chores.filter(c => c.today_status === "approved").length;
    const pending = chores.filter(c => c.today_status === "submitted").length;
    const totalPoints = chores.reduce((sum, c) => sum + (c.points || 0), 0);
    const earnedPoints = chores
      .filter(c => c.today_status === "approved")
      .reduce((sum, c) => sum + (c.points || 0), 0);
    
    return jsonResponse({
      date,
      child: {
        id: auth.child.id,
        displayName: auth.child.display_name
      },
      chores,
      stats: {
        total,
        completed,
        pending,
        remaining: total - completed - pending,
        totalPoints,
        earnedPoints
      }
    });
    
  } catch (error) {
    console.error("Get child chores error:", error);
    return errorResponse("Failed to get chores", 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireChild(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const choreId = (body.chore_id || body.choreId || body.id || "").trim();
    const notes = (body.notes || "").trim();
    
    if (!choreId) {
      return errorResponse("Chore ID is required");
    }
    
    // Verify chore exists and belongs to this child's parent
    const chore = await env.DB.prepare(`
      SELECT id, title, points 
      FROM chores 
      WHERE id = ? AND parent_id = ? AND active = 1
    `).bind(choreId, auth.child.parent_id).first();
    
    if (!chore) {
      return errorResponse("Chore not found", 404);
    }
    
    const date = todayYYYYMMDD();
    
    // Check if already submitted/approved today
    const existing = await env.DB.prepare(`
      SELECT id, status 
      FROM chore_instances 
      WHERE chore_id = ? AND child_id = ? AND date = ?
    `).bind(choreId, auth.child.id, date).first();
    
    if (existing) {
      if (existing.status === "approved") {
        return errorResponse("This chore is already approved for today");
      }
      if (existing.status === "submitted") {
        return errorResponse("This chore is already submitted and waiting for approval");
      }
      // If rejected or excused, allow resubmission
    }
    
    const instanceId = uid("CI_");
    
    // Insert or update chore instance
    await env.DB.prepare(`
      INSERT INTO chore_instances (id, chore_id, child_id, date, status, submitted_at, notes)
      VALUES (?, ?, ?, ?, 'submitted', datetime('now'), ?)
      ON CONFLICT(chore_id, child_id, date) DO UPDATE SET 
        status = 'submitted',
        submitted_at = datetime('now'),
        notes = CASE WHEN ? != '' THEN ? ELSE notes END
    `).bind(instanceId, choreId, auth.child.id, date, notes, notes, notes).run();
    
    return jsonResponse({
      message: "Chore submitted for approval!",
      chore: {
        id: choreId,
        title: chore.title,
        points: chore.points
      },
      status: "submitted"
    }, 201);
    
  } catch (error) {
    console.error("Submit chore error:", error);
    return errorResponse("Failed to submit chore", 500);
  }
}
