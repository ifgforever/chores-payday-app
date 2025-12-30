import { bad, requireAdmin } from "../../_util.js";

export async function onRequestGet({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const parentId = "PARENT_1";
  await env.DB.prepare("INSERT OR IGNORE INTO parents (id) VALUES (?)").bind(parentId).run();

  const rows = await env.DB.prepare(
    "SELECT id, name, created_at FROM children WHERE parent_id = ? ORDER BY created_at DESC"
  ).bind(parentId).all();

  return new Response(JSON.stringify({ ok: true, children: rows.results || [] }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export async function onRequestPost({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const parentId = "PARENT_1";
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) return bad("Missing name");

  const childId = "C" + Math.floor(1000 + Math.random() * 9000);
  await env.DB.prepare("INSERT INTO children (id, parent_id, name) VALUES (?, ?, ?)")
    .bind(childId, parentId, name).run();

  return new Response(JSON.stringify({ ok: true, child: { id: childId, name: name } }, null, 2), {
    status: 201,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}