// api/auth/siws.js
export const config = { runtime: "nodejs" };

import { sql } from "../../lib/db.js";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import bs58 from "bs58";

// TTL du JWT (en minutes)
const JWT_TTL_MIN = Number(process.env.JWT_TTL_MIN) || 60;

// Fonction utilitaire pour vérifier la signature Solana
function verifySignature(message, signatureB64, pubKeyBase58) {
  const signature = bs58.decode(signatureB64);
  const pubKey = bs58.decode(pubKeyBase58);
  const msgBytes = new TextEncoder().encode(message);
  return nacl.sign.detached.verify(msgBytes, signature, pubKey);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { account, signature, nonce, message, domain } = req.body ?? {};

    if (!account || !signature || !nonce || !message) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    // Vérifie que le nonce existe et n'a pas expiré / été utilisé
    const rows = await sql`
      SELECT * FROM siws_nonces
      WHERE nonce = ${nonce}::uuid AND account = ${account} AND used = false
        AND expires_at > now()
    `;

    if (!rows || rows.length === 0) {
      return res.status(400).json({ ok: false, error: "Invalid or expired nonce" });
    }

    // Vérifie la signature avec le wallet public key
    const valid = verifySignature(message, signature, account);
    if (!valid) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    // Marque le nonce comme utilisé
    await sql`
      UPDATE siws_nonces
      SET used = true
      WHERE nonce = ${nonce}::uuid
    `;

    // Génère le JWT
    const token = jwt.sign(
      { wallet: account, domain },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: `${JWT_TTL_MIN}m` }
    );

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
