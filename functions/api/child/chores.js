import { bad, todayYYYYMMDD } from "../../_util.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const child_id = (url.searchParams.get("child_id") || "").trim();
  if (!child_id) return bad("Missing child_id");

  const child = await env.DB.prepare("SELECT id, parent_id FROM children WHERE id = ?").bind(child_id).first();
  if (!child) return bad("Unknown child_id", 404);

  const date = todayYYYYMMDD();

  const rows = await env.DB.prepare(
    "SELECT c.id, c.title, c.is_required, c.points, " +
    "(SELECT status FROM chore_instances ci WHERE ci.child_id=? AND ci.chore_id=c.id AND ci.date=? LIMIT 1) AS today_status " +
    "FROM chores c WHERE c.parent_id=? AND c.active=1 " +
    "ORDER BY c.is_required DESC, c.created_at DESC"
  ).bind(child_id, date, child.parent_id).all();

  return new Response(JSON.stringify({ ok: true, child_id: child_id, date: date, chores: rows.results || [] }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
