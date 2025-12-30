export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    hasDB: !!env.DB,
    hasAdminToken: !!env.ADMIN_TOKEN
  }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
