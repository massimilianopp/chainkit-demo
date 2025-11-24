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

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    noCache(res);
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const account =
      (method === "GET"  ? req.query?.account : undefined) ??
      (method === "POST" ? (req.body?.account || req.body?.wallet) : undefined) ??
      "";

    // TTL en minutes (tu peux changer la valeur)
    const ttlMin = 5;

    // On calcule la date d’expiration en JS pour éviter toute ambiguïté dans la requête SQL
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);

    const nonce = crypto.randomUUID();

    // IMPORTANT: 3 placeholders, 3 valeurs. Pas d’interpolation de $1/$2/$3 dans la string SQL.
    await sql/* sql */`
      /* siws-nonce v2 */
      insert into siws_nonces (nonce, account, expires_at, used)
      values (${nonce}::uuid, ${account}, ${expiresAt}::timestamptz, false)
    `;

    const host = req.headers["x-forwarded-host"] || req.headers.host || "";
    const message =
`Sign in to TomatoCoin
Wallet: ${account || "unknown"}
Nonce: ${nonce}
Domain: ${host}
Issued At: ${new Date().toISOString()}`;

    noCache(res);
    return res.status(200).json({ ok:true, nonce, message, expiresInSec: ttlMin * 60 });
  } catch (e) {
    noCache(res);
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
