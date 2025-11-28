// api/payments/record.js  (SOFT MODE)
export const config = { runtime: "nodejs" };

function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

import crypto from "node:crypto";
import { requireAuth } from "../../lib/requireAuth.js";
import { sql } from "../../lib/db.js";
import { connection, TOMATO_MINT, MERCHANT_WALLET, CHAPTER_PRICE_RAW } from "../../lib/solana.js";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    noCache(res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const userPk = requireAuth(req);
    const wallet = userPk.toBase58();

    const { chapterId, sig, reference, debug } = req.body || {};
    const chapter = Number(chapterId);

    if (!Number.isInteger(chapter) || chapter <= 0) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Invalid chapterId" });
    }

    if (typeof sig !== "string" || sig.length < 64 || sig.length > 128) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Invalid signature format" });
    }

    if (reference && !UUID_RE.test(String(reference))) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Invalid reference format" });
    }

    // 1) Vérif "souple" : la signature existe et n'est pas en erreur
    const st = await connection
      .getSignatureStatuses([sig])
      .then((r) => r?.value?.[0] || null);

    if (!st) {
      noCache(res);
      return res.status(200).json({
        ok: true,
        status: "PENDING",
        reason: "sig-not-found",
      });
    }

    if (st.err) {
      noCache(res);
      return res.status(200).json({
        ok: false,
        status: "ERROR",
        error: "on-chain error",
        ...(debug ? { signatureStatus: st } : {}),
      });
    }

    const conf = st.confirmationStatus || "processed";

    // 2) Idempotent : confirme d'abord une ligne PENDING existante avec référence
    let via = null;

    if (reference) {
      const u = await sql/* sql */`
        UPDATE purchases
           SET status = 'CONFIRMED',
               signature = ${sig},
               confirmed_at = now()
         WHERE id       = ${reference}::uuid
           AND wallet   = ${wallet}
           AND chapter_id = ${chapter}
           AND status   = 'PENDING'
       RETURNING id
      `;
      if (u?.[0]?.id) via = "reference-update";
    }

    // 2bis) si pas de PENDING avec référence, check s'il y a déjà une CONFIRMED
    if (!via) {
      const already = await sql/* sql */`
        SELECT id
          FROM purchases
         WHERE wallet     = ${wallet}
           AND chapter_id = ${chapter}
           AND status     = 'CONFIRMED'
           AND signature  = ${sig}
         LIMIT 1
      `;
      if (already?.[0]?.id) {
        via = "already-confirmed";
      } else {
        // 2ter) sinon, insère une nouvelle CONFIRMED
        const id = crypto.randomUUID();
        await sql/* sql */`
          INSERT INTO purchases (
            id, wallet, chapter_id, amount_raw, mint, merchant, status, signature, confirmed_at
          )
          VALUES (
            ${id}::uuid,
            ${wallet},
            ${chapter},
            ${CHAPTER_PRICE_RAW},
            ${TOMATO_MINT.toBase58()},
            ${MERCHANT_WALLET.toBase58()},
            'CONFIRMED',
            ${sig},
            now()
          )
        `;
        via = "insert";
      }
    }

    // 3) Sécurité / hygiène : annule tout PENDING résiduel pour ce chapitre
    await sql/* sql */`
      UPDATE purchases
         SET status = 'CANCELLED'
       WHERE wallet     = ${wallet}
         AND chapter_id = ${chapter}
         AND status     = 'PENDING'
    `;

    noCache(res);
    return res.status(200).json({
      ok: true,
      status: "RECORDED",
      via,
      confirmationStatus: conf,
      ...(debug ? { signatureStatus: st } : {}),
    });
  } catch (e) {
    noCache(res);
    if (String(e?.message || "").toLowerCase().includes("rate")) {
      return res
        .status(200)
        .json({ ok: true, status: "PENDING", rateLimited: true });
    }
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
