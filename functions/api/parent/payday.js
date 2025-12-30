// ============================================
// Run Payday Endpoint (Parent Only)
// POST /api/parent/payday
// ============================================

import { 
  uid,
  weekWindowYYYYMMDD, 
  errorResponse, 
  jsonResponse 
} from "../../_util.js";
import { requireParent } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireParent(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const parentId = auth.parent.id;
    const win = weekWindowYYYYMMDD(new Date());
    const start = win.start;
    const end = win.end;
    
    // Get or create weekly rules
    let rules = await env.DB.prepare(`
      SELECT weekly_cap_points, strict_mode 
      FROM weekly_rules 
      WHERE parent_id = ?
    `).bind(parentId).first();
    
    if (!rules) {
      await env.DB.prepare(`
        INSERT INTO weekly_rules (id, parent_id, weekly_cap_points, strict_mode, payday_day)
        VALUES (?, ?, 100, 1, 5)
      `).bind(uid("WR_"), parentId).run();
      rules = { weekly_cap_points: 100, strict_mode: 1 };
    }
    
    const cap = Number(rules.weekly_cap_points || 100);
    
    // Get all children for this parent
    const children = await env.DB.prepare(`
      SELECT id, display_name 
      FROM children 
      WHERE parent_id = ?
    `).bind(parentId).all();
    
    // Get all required chores
    const requiredChores = await env.DB.prepare(`
      SELECT id 
      FROM chores 
      WHERE parent_id = ? AND active = 1 AND is_required = 1
    `).bind(parentId).all();
    
    const requiredIds = (requiredChores.results || []).map(r => r.id);
    const results = [];
    
    for (const kid of (children.results || [])) {
      let eligible = true;
      let missingChores = [];
      
      // Check if all required chores are completed
      for (const choreId of requiredIds) {
        const hit = await env.DB.prepare(`
          SELECT 1 FROM chore_instances 
          WHERE child_id = ? 
            AND chore_id = ? 
            AND date BETWEEN ? AND ? 
            AND status IN ('approved', 'excused') 
          LIMIT 1
        `).bind(kid.id, choreId, start, end).first();
        
        if (!hit) {
          eligible = false;
          // Get chore title for the message
          const chore = await env.DB.prepare(
            "SELECT title FROM chores WHERE id = ?"
          ).bind(choreId).first();
          if (chore) missingChores.push(chore.title);
        }
      }
      
      // Calculate total approved points
      const sumRow = await env.DB.prepare(`
        SELECT COALESCE(SUM(ch.points), 0) AS pts
        FROM chore_instances ci 
        JOIN chores ch ON ch.id = ci.chore_id
        WHERE ci.child_id = ? 
          AND ci.date BETWEEN ? AND ? 
          AND ci.status = 'approved'
      `).bind(kid.id, start, end).first();
      
      const points = Number(sumRow?.pts || 0);
      const cappedPoints = Math.min(points, cap);
      
      let message;
      let notifType;
      
      if (eligible) {
        message = `🎉 Payday! You earned ${cappedPoints} points for ${start} to ${end}. Great job!`;
        notifType = "payday";
        results.push({ 
          child_id: kid.id, 
          name: kid.display_name, 
          eligible: true, 
          points: cappedPoints,
          raw_points: points
        });
      } else {
        message = `❌ No payout this week. Missing required chores: ${missingChores.join(", ") || "Unknown"}`;
        notifType = "warning";
        results.push({ 
          child_id: kid.id, 
          name: kid.display_name, 
          eligible: false, 
          points: 0,
          missing_chores: missingChores
        });
      }
      
      // Create notification
      await env.DB.prepare(`
        INSERT INTO notifications (id, child_id, message, type)
        VALUES (?, ?, ?, ?)
      `).bind(uid("N_"), kid.id, message, notifType).run();
    }
    
    return jsonResponse({
      message: "Payday processed successfully",
      window: { start, end },
      points_cap: cap,
      results
    });
    
  } catch (error) {
    console.error("Run payday error:", error);
    return errorResponse("Failed to run payday", 500);
  }
}
