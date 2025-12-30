import { bad } from "../../_util.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const child_id = (url.searchParams.get("child_id") || "").trim();
  if (!child_id) return bad("Missing child_id");

  const child = await env.DB.prepare("SELECT id FROM children WHERE id=?").bind(child_id).first();
  if (!child) return bad("Unknown child_id", 404);

  const rows = await env.DB.prepare(
    "SELECT id, message, created_at FROM notifications WHERE child_id=? ORDER BY created_at DESC LIMIT 50"
  ).bind(child_id).all();

  return new Response(JSON.stringify({ ok: true, child_id: child_id, notifications: rows.results || [] }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
