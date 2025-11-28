// api/auth/nonce.js
export const config = { runtime: "nodejs" };

function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

import crypto from "node:crypto";
import { sql } from "../../lib/db.js";

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58 "classique" Solana

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    noCache(res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const account =
      (method === "GET"  ? req.query?.account : undefined) ??
      (method === "POST" ? (req.body?.account || req.body?.wallet) : undefined) ??
      "";

    if (!account || !WALLET_RE.test(String(account))) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Invalid or missing account" });
    }

    // TTL en minutes (configurable via env, sinon 5 min)
    const ttlMin = Number.isFinite(Number(process.env.SIWS_NONCE_TTL_MIN))
      ? Math.max(1, Math.min(30, Number(process.env.SIWS_NONCE_TTL_MIN)))
      : 5;

    const now = Date.now();
    const expiresAt = new Date(now + ttlMin * 60_000);
    const nonce = crypto.randomUUID();

    await sql/* sql */`
      /* siws-nonce v2 */
      insert into siws_nonces (nonce, account, expires_at, used)
      values (${nonce}::uuid, ${account}, ${expiresAt.toISOString()}::timestamptz, false)
    `;

    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const message =
`Sign in to TomatoCoin
Wallet: ${account}
Nonce: ${nonce}
Domain: ${host}
Issued At: ${new Date().toISOString()}`;

    noCache(res);
    return res.status(200).json({
      ok: true,
      nonce,
      message,
      expiresInSec: ttlMin * 60,
    });
  } catch (e) {
    noCache(res);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
