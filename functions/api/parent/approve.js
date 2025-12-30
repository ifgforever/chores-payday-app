import { bad, requireAdmin } from "../../_util.js";

export async function onRequestPost({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const body = await request.json().catch(() => ({}));
  const child_id = (body.child_id || "").trim();
  const chore_id = (body.chore_id || "").trim();
  const date = (body.date || "").trim();
  const action = (body.action || "").trim();

  if (!child_id || !chore_id || !date) return bad("Missing child_id, chore_id, or date");
  if (!["approved", "rejected", "excused"].includes(action)) return bad("Invalid action");

  const res = await env.DB.prepare(
    "UPDATE chore_instances SET status=? WHERE child_id=? AND chore_id=? AND date=?"
  ).bind(action, child_id, chore_id, date).run();

  return new Response(JSON.stringify({ ok: true, updated: res.meta.changes }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
