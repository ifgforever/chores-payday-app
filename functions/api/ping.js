export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").first();
  return new Response(JSON.stringify({ ok: true, tables: row?.n ?? null }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}