// ============================================
// Chores Management Endpoint (Parent Only)
// GET /api/parent/chores - List all chores
// POST /api/parent/chores - Create a new chore
// ============================================

import { 
  uid, 
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
    const rows = await env.DB.prepare(`
      SELECT id, title, description, points, is_required, active, created_at
      FROM chores 
      WHERE parent_id = ? 
      ORDER BY is_required DESC, created_at DESC
    `).bind(auth.parent.id).all();
    
    return jsonResponse({
      chores: rows.results || []
    });
    
  } catch (error) {
    console.error("List chores error:", error);
    return errorResponse("Failed to list chores", 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const points = Number(body.points ?? 0);
    const isRequired = body.is_required || body.isRequired ? 1 : 0;
    
    if (!title) {
      return errorResponse("Chore title is required");
    }
    
    if (!Number.isFinite(points) || points < 0) {
      return errorResponse("Points must be a non-negative number");
    }
    
    const choreId = uid("CH_");
    
    await env.DB.prepare(`
      INSERT INTO chores (id, parent_id, title, description, points, is_required)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(choreId, auth.parent.id, title, description || null, points, isRequired).run();
    
    return jsonResponse({
      message: "Chore created successfully",
      chore: {
        id: choreId,
        title: title,
        description: description || null,
        points: points,
        isRequired: isRequired === 1,
        active: true
      }
    }, 201);
    
  } catch (error) {
    console.error("Create chore error:", error);
    return errorResponse("Failed to create chore", 500);
  }
}
