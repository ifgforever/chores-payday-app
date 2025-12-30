// ============================================
// Health Check Endpoint
// GET /api/ping
// ============================================

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'"
    ).first();
    
    return new Response(JSON.stringify({ 
      ok: true, 
      tables: row?.n ?? null,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "Database connection failed"
    }, null, 2), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
