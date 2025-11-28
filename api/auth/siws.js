// api/auth/siws.js
export const config = { runtime: "nodejs" };

function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { sql } from "../../lib/db.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}

const b64ToU8 = (b64) => {
  try {
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
};

const toU8 = (sig) => {
  if (!sig) return null;
  if (typeof sig === "string") {
    const b = b64ToU8(sig);
    if (b) return b;
    try {
      return bs58.decode(sig);
    } catch {
      /* ignore */
    }
    return null;
  }
  if (Array.isArray(sig)) return Uint8Array.from(sig);
  if (sig?.type === "Buffer" && Array.isArray(sig?.data)) {
    return Uint8Array.from(sig.data);
  }
  if (sig instanceof Uint8Array) return sig;
  return null;
};

function parseField(lines, prefix) {
  const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!line) return "";
  const idx = line.indexOf(":");
  if (idx === -1) return "";
  return line.slice(idx + 1).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    noCache(res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().toLowerCase();

    const account   = String(body.account || body.wallet || "");
    const nonce     = String(body.nonce || body.id || body.token || "");
    let   message   = String(body.message || body.msg || "");
    const domain    = String(body.domain || body.host || "").toLowerCase();
    const signature =
      body.signature ||
      body.signatureBase64 ||
      body.signature_b64 ||
      body.sig ||
      body.signature58 ||
      body.signature_base58 ||
      body.signatureBytes ||
      body.signature_bytes;

    const missing = [];
    if (!account)   missing.push("account");
    if (!nonce)     missing.push("nonce");
    if (!signature) missing.push("signature");

    if (!message) {
      // fallback : on reconstruit le message attendu
      message =
`Sign in to TomatoCoin
Wallet: ${account || "unknown"}
Nonce: ${nonce}
Domain: ${host}
Issued At: ${new Date().toISOString()}`;
    }

    if (missing.length) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Missing fields", missing });
    }

    if (domain && domain !== host) {
      noCache(res);
      return res.status(400).json({
        ok: false,
        error: "Domain mismatch",
        expected: host,
        got: domain,
      });
    }

    // ➕ On vérifie que le message signé contient bien les infos cohérentes
    const lines = message.split(/\r?\n/);
    const msgWallet = parseField(lines, "Wallet:");
    const msgNonce  = parseField(lines, "Nonce:");
    const msgDomain = parseField(lines, "Domain:").toLowerCase();

    if (msgWallet && msgWallet !== account) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Message/account mismatch" });
    }
    if (msgNonce && msgNonce !== nonce) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Message/nonce mismatch" });
    }
    if (msgDomain && msgDomain !== host) {
      noCache(res);
      return res.status(400).json({
        ok: false,
        error: "Message/domain mismatch",
        expected: host,
        got: msgDomain,
      });
    }

    // 1) Vérifie + consomme le nonce en DB (anti-replay)
    const row = await sql/* sql */`
      update siws_nonces
         set used = true
       where nonce   = ${nonce}::uuid
         and account = ${account}
         and used    = false
         and now()  <= expires_at
      returning nonce
    `;
    if (!row?.length) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Invalid or expired nonce" });
    }

    // 2) Vérification ed25519 de la signature
    const sigBytes = toU8(signature);
    if (!sigBytes) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Unusable signature format" });
    }

    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      sigBytes,
      bs58.decode(account)
    );
    if (!ok) {
      noCache(res);
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    // 3) Émet le JWT (durée plus raisonnable, par défaut 2h)
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "2h";
    const token = jwt.sign(
      {
        sub: account,
        wallet: account,
      },
      JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: jwtExpiresIn,
        issuer: "TomatocoinGame",
        audience: host || "tomatocoin-game",
      }
    );

    noCache(res);
    return res.status(200).json({ ok: true, token });
  } catch (e) {
    noCache(res);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
