import { bad, requireAdmin, todayYYYYMMDD } from "../../_util.js";

export async function onRequestGet({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const date = todayYYYYMMDD();

  const rows = await env.DB.prepare(
    "SELECT ci.child_id, ch.id AS chore_id, ci.date, ci.status, " +
    "c.name AS child_name, ch.title AS chore_title, ch.is_required, ch.points " +
    "FROM chore_instances ci " +
    "JOIN children c ON c.id = ci.child_id " +
    "JOIN chores ch ON ch.id = ci.chore_id " +
    "WHERE ci.date=? AND ci.status='submitted' " +
    "ORDER BY c.name ASC, ch.is_required DESC, ch.title ASC"
  ).bind(date).all();

  return new Response(JSON.stringify({ ok: true, date: date, items: rows.results || [] }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
