// lib/rateLimit.js — simple rate limiter en mémoire (par instance Vercel)
const WINDOW_MS = 60_000; // 1 min
const LIMIT = 60;         // 60 req/min par IP+route

globalThis.__RATE_BUCKET__ = globalThis.__RATE_BUCKET__ || new Map();

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.headers["cf-connecting-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function rateLimit(req, res, { limit = LIMIT, windowMs = WINDOW_MS } = {}) {
  const ip = getClientIp(req);
  const path = req.url?.split("?")[0] || "unknown";
  const now = Date.now();
  const slot = Math.floor(now / windowMs);
  const key = `${ip}:${path}:${slot}`;

  const count = (globalThis.__RATE_BUCKET__.get(key) || 0) + 1;
  globalThis.__RATE_BUCKET__.set(key, count);

  if (count > limit) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "Too Many Requests" }));
    return false;
  }
  return true;
}

module.exports = { rateLimit };
