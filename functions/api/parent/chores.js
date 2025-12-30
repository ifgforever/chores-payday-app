import { bad, requireAdmin, uid } from "../../_util.js";

export async function onRequestGet({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const parentId = "PARENT_1";
  const rows = await env.DB.prepare(
    "SELECT id, title, is_required, points, active FROM chores WHERE parent_id = ? ORDER BY created_at DESC"
  ).bind(parentId).all();

  return new Response(JSON.stringify({ ok: true, chores: rows.results || [] }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestPost({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const parentId = "PARENT_1";
  const body = await request.json().catch(() => ({}));
  const title = (body.title || "").trim();
  const points = Number(body.points ?? 0);
  const is_required = body.is_required ? 1 : 0;

  if (!title) return bad("Missing title");
  if (!Number.isFinite(points) or points < 0) return bad("Invalid points");

  const id = uid("CH_");
  await env.DB.prepare(
    "INSERT INTO chores (id, parent_id, title, is_required, points) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, parentId, title, is_required, points).run();

  return new Response(JSON.stringify({ ok: true, chore: { id, title, points, is_required } }, null, 2), {
    status: 201,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}