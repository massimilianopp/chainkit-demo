// api/payments/intent.js
export const config = { runtime: "nodejs" };

import crypto from "node:crypto";
import { requireAuth } from "../../lib/requireAuth.js";
import { sql } from "../../lib/db.js";
import { CHAPTER_PRICE_RAW, TOMATO_MINT, MERCHANT_WALLET } from "../../lib/solana.js";

function ensureInt(value, field, res) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    res.setHeader("Cache-Control", "no-store");
    res.status(400).json({ ok: false, error: `Invalid ${field}` });
    return null;
  }
  return n;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const userPk = requireAuth(req);
    const wallet = userPk.toBase58();

    const { chapterId } = req.body || {};
    const chapter = ensureInt(chapterId, "chapterId", res);
    if (chapter == null) return;

    // 1) réutilise un PENDING existant (idempotent)
    const up = await sql/* sql */`
      UPDATE purchases
         SET amount_raw = ${CHAPTER_PRICE_RAW},
             mint       = ${TOMATO_MINT.toBase58()},
             merchant   = ${MERCHANT_WALLET.toBase58()}
       WHERE wallet = ${wallet}
         AND chapter_id = ${chapter}
         AND status = 'PENDING'
   RETURNING id
    `;
    let reference = up?.[0]?.id;

    // 2) sinon insère un nouveau PENDING
    if (!reference) {
      const proposed = crypto.randomUUID();
      const ins = await sql/* sql */`
        INSERT INTO purchases (id, wallet, chapter_id, amount_raw, mint, merchant, status)
        VALUES (
          ${proposed}::uuid,
          ${wallet},
          ${chapter},
          ${CHAPTER_PRICE_RAW},
          ${TOMATO_MINT.toBase58()},
          ${MERCHANT_WALLET.toBase58()},
          'PENDING'
        )
      RETURNING id
      `;
      reference = ins?.[0]?.id;
    }

    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `${(req.headers["x-forwarded-proto"] || "https")}://${req.headers["x-forwarded-host"] || req.headers.host}`;

    const payUrl = `${base}/api/payments/tx?reference=${reference}`;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, payUrl, reference });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
