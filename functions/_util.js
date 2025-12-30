// ============================================
// Utility Functions for Auth System
// ============================================

/**
 * Generate a random ID with optional prefix
 */
export function uid(prefix = "") {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Generate a random child code (8 uppercase alphanumeric chars)
 * Avoids ambiguous characters: 0, O, I, L, 1
 */
export function generateChildCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

/**
 * Generate a session ID (32 chars)
 */
export function generateSessionId() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Hash a password using Web Crypto API (PBKDF2)
 * Returns: "salt:hash" format
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password, storedHash) {
  const [saltHex, expectedHashHex] = storedHash.split(":");
  if (!saltHex || !expectedHashHex) return false;
  
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex === expectedHashHex;
}

/**
 * Hash a PIN (simpler, shorter)
 */
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a PIN
 */
export async function verifyPin(pin, storedHash) {
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get the week window (Saturday to Friday)
 */
export function weekWindowYYYYMMDD(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
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

/**
 * Create a JSON error response
 */
export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/**
 * Create a JSON success response
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/**
 * Set session cookie
 */
export function setSessionCookie(sessionId, maxAge = 7 * 24 * 60 * 60) {
  return `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/**
 * Clear session cookie
 */
export function clearSessionCookie() {
  return "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

/**
 * Parse cookies from request
 */
export function parseCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = {};
  cookieHeader.split(";").forEach(cookie => {
    const [name, value] = cookie.trim().split("=");
    if (name) cookies[name] = value;
  });
  return cookies;
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate password strength
 */
export function isValidPassword(password) {
  return password && password.length >= 8;
}

/**
 * Validate PIN format (4-6 digits)
 */
export function isValidPin(pin) {
  return /^\d{4,6}$/.test(pin);
}
