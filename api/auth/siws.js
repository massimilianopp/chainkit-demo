// api/auth/siws.js
export const config = { runtime: "nodejs" };

import jwt from "jsonwebtoken";
import { sql } from "../../lib/db.js";
import { PublicKey } from "@solana/web3.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET missing");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { account, signature, nonce, message, domain } = req.body ?? {};
  if (!account || !signature || !nonce || !message) {
    return res.status(400).json({ ok: false, error: "Missing parameters" });
  }

  try {
    // Vérifier le nonce
    const rows = await sql/* sql */`
      select * from siws_nonces
      where nonce = ${nonce}::uuid and account = ${account} and used = false
    `;
    const row = rows[0];
    if (!row) {
      return res.status(400).json({ ok: false, error: "Invalid or used nonce" });
    }

    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, error: "Nonce expired" });
    }

    // Vérifier la signature (Solana)
    const pubkey = new PublicKey(account);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = Buffer.from(signature, "base64");

    const isValid = pubkey.verify?.(msgBytes, sigBytes) ?? false;
    if (!isValid) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    // Marquer le nonce comme utilisé
    await sql/* sql */`
      update siws_nonces
      set used = true
      where nonce = ${nonce}::uuid
    `;

    // Générer le JWT
    const token = jwt.sign(
      { wallet: account },
      JWT_SECRET,
      { expiresIn: "12h" } // configurable
    );

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
