// ============================================
// Child Notifications Endpoint
// GET /api/child/notifications - Get notifications for the logged-in child
// POST /api/child/notifications/read - Mark notifications as read
// ============================================

import { errorResponse, jsonResponse } from "../../_util.js";
import { requireChild } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireChild(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
    const unreadOnly = url.searchParams.get("unread") === "true";
    
    let query = `
      SELECT id, message, type, read, created_at
      FROM notifications
      WHERE child_id = ?
    `;
    
    if (unreadOnly) {
      query += " AND read = 0";
    }
    
    query += " ORDER BY created_at DESC LIMIT ?";
    
    const rows = await env.DB.prepare(query).bind(auth.child.id, limit).all();
    
    // Count unread
    const unreadCount = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE child_id = ? AND read = 0
    `).bind(auth.child.id).first();
    
    return jsonResponse({
      notifications: rows.results || [],
      unread_count: unreadCount?.count || 0
    });
    
  } catch (error) {
    console.error("Get notifications error:", error);
    return errorResponse("Failed to get notifications", 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireChild(request, env);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const notificationIds = body.ids || body.notification_ids || [];
    const markAll = body.mark_all || body.markAll || false;
    
    if (markAll) {
      // Mark all as read
      await env.DB.prepare(`
        UPDATE notifications 
        SET read = 1 
        WHERE child_id = ? AND read = 0
      `).bind(auth.child.id).run();
      
      return jsonResponse({
        message: "All notifications marked as read"
      });
    }
    
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return errorResponse("Notification IDs are required");
    }
    
    // Mark specific notifications as read (verify they belong to this child)
    const placeholders = notificationIds.map(() => "?").join(",");
    await env.DB.prepare(`
      UPDATE notifications 
      SET read = 1 
      WHERE id IN (${placeholders}) AND child_id = ?
    `).bind(...notificationIds, auth.child.id).run();
    
    return jsonResponse({
      message: "Notifications marked as read",
      count: notificationIds.length
    });
    
  } catch (error) {
    console.error("Mark notifications error:", error);
    return errorResponse("Failed to mark notifications", 500);
  }
}
