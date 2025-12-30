import { bad, requireAdmin, uid, weekWindowYYYYMMDD } from "../../_util.js";

export async function onRequestPost({ request, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return bad(auth.error, 401);

  const parentId = "PARENT_1";
  const win = weekWindowYYYYMMDD(new Date());
  const start = win.start;
  const end = win.end;

  await env.DB.prepare(
    "INSERT OR IGNORE INTO weekly_rules (parent_id, weekly_cap_points, strict_mode, grace_passes_per_month) VALUES (?, 100, 1, 2)"
  ).bind(parentId).run();

  const rules = await env.DB.prepare(
    "SELECT weekly_cap_points, strict_mode FROM weekly_rules WHERE parent_id=?"
  ).bind(parentId).first();

  const cap = Number(rules?.weekly_cap_points || 0);

  const children = await env.DB.prepare(
    "SELECT id, name FROM children WHERE parent_id=?"
  ).bind(parentId).all();

  const requiredChores = await env.DB.prepare(
    "SELECT id FROM chores WHERE parent_id=? AND active=1 AND is_required=1"
  ).bind(parentId).all();

  const requiredIds = (requiredChores.results || []).map(r => r.id);
  const results = [];

  for (const kid of (children.results || [])) {
    let eligible = true;

    for (const choreId of requiredIds) {
      const hit = await env.DB.prepare(
        "SELECT 1 FROM chore_instances WHERE child_id=? AND chore_id=? AND date BETWEEN ? AND ? AND status IN ('approved','excused') LIMIT 1"
      ).bind(kid.id, choreId, start, end).first();

      if (!hit) { eligible = false; break; }
    }

    const sumRow = await env.DB.prepare(
      "SELECT COALESCE(SUM(c.points),0) AS pts " +
      "FROM chore_instances ci JOIN chores c ON c.id = ci.chore_id " +
      "WHERE ci.child_id=? AND ci.date BETWEEN ? AND ? AND ci.status='approved'"
    ).bind(kid.id, start, end).first();

    const points = Number(sumRow?.pts || 0);
    const cappedPoints = Math.min(points, cap);

    if (eligible) {
      const msg = "Payday earned ✅ You earned " + cappedPoints + " points for " + start + " to " + end + ".";
      await env.DB.prepare("INSERT INTO notifications (id, child_id, message) VALUES (?, ?, ?)")
        .bind(uid("N_"), kid.id, msg).run();
      results.push({ child_id: kid.id, name: kid.name, eligible: true, points: cappedPoints });
    } else {
      const msg = "No payout this week ❌ Required chores incomplete for " + start + " to " + end + ".";
      await env.DB.prepare("INSERT INTO notifications (id, child_id, message) VALUES (?, ?, ?)")
        .bind(uid("N_"), kid.id, msg).run();
      results.push({ child_id: kid.id, name: kid.name, eligible: false, points: 0 });
    }
  }

  return new Response(JSON.stringify({ ok: true, window: { start: start, end: end }, results: results }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
