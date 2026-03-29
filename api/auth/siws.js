// api/auth/siws.js
export const config = { runtime: "nodejs" };

import { sql } from "../../lib/db.js";
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import bs58 from "bs58";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET missing in env");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { account, signature, nonce, message } = req.body;
    if (!account || !signature || !nonce || !message) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    // Récupération du nonce depuis la DB
    const rows = await sql`
      select * from siws_nonces
      where nonce = ${nonce}::uuid
        and account = ${account}
        and used = false
        and expires_at > now()
    `;
    const row = rows[0];
    if (!row) return res.status(400).json({ ok: false, error: "Invalid or expired nonce" });

    // Vérification de la signature
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubKeyBytes = bs58.decode(account);

    const verified = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
    if (!verified) return res.status(400).json({ ok: false, error: "Invalid signature" });

    // Marquer le nonce comme utilisé
    await sql`
      update siws_nonces
      set used = true
      where nonce = ${nonce}::uuid
    `;

    // Génération du JWT
    const token = jwt.sign({ wallet: account }, JWT_SECRET, { expiresIn: "12h" });

    return res.status(200).json({ ok: true, token });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
