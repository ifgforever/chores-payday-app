export function bad(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
export function requireAdmin(request, env) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!env.ADMIN_TOKEN) return { ok: false, error: "Missing ADMIN_TOKEN on server" };
  if (token !== env.ADMIN_TOKEN) return { ok: false, error: "Unauthorized" };
  return { ok: true };
}
export function uid(prefix = "") {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
export function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}
export function weekWindowYYYYMMDD(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();           // 0 Sun ... 6 Sat
  const offsetToSat = (day - 6 + 7) % 7;

  const start = new Date(d);
  start.setDate(d.getDate() - offsetToSat);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const fmt = (x) => {
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return { start: fmt(start), end: fmt(end) };
}
