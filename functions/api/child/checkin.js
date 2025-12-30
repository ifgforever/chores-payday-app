import { bad, todayYYYYMMDD, uid } from "../../_util.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const child_id = (body.child_id || "").trim();
  const chore_id = (body.chore_id || "").trim();
  if (!child_id || !chore_id) return bad("Missing child_id or chore_id");

  const child = await env.DB.prepare("SELECT id FROM children WHERE id=?").bind(child_id).first();
  if (!child) return bad("Unknown child_id", 404);

  const chore = await env.DB.prepare("SELECT id FROM chores WHERE id=? AND active=1").bind(chore_id).first();
  if (!chore) return bad("Unknown chore_id", 404);

  const date = todayYYYYMMDD();
  const id = uid("CI_");

  await env.DB.prepare(
    "INSERT INTO chore_instances (id, chore_id, child_id, date, status) VALUES (?, ?, ?, ?, 'submitted') " +
    "ON CONFLICT(chore_id, child_id, date) DO UPDATE SET status='submitted'"
  ).bind(id, chore_id, child_id, date).run();

  return new Response(JSON.stringify({ ok: true, date: date, status: "submitted" }, null, 2), {
    status: 201,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
