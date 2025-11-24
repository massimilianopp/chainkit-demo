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

export default async function handler(req, res) {
  if (req.method !== "POST") { noCache(res); return res.status(405).json({ ok:false, error:"Method not allowed" }); }

  try {
    const userPk = requireAuth(req);
    const wallet = userPk.toBase58();

    const { chapterId, sig, reference, debug } = req.body || {};
    if (!chapterId || !sig) { noCache(res); return res.status(400).json({ ok:false, error:"Missing chapterId or sig" }); }

    // 1) Vérif "souple" : la signature existe et n'est pas en erreur
    const st = await connection.getSignatureStatuses([sig]).then(r => r?.value?.[0] || null);
    if (!st) {
      noCache(res);
      return res.status(200).json({ ok:true, status:"PENDING", reason:"sig-not-found" });
    }
    if (st.err) {
      noCache(res);
      return res.status(200).json({ ok:false, status:"ERROR", error:"on-chain error", ...(debug?{signatureStatus:st}:{}) });
    }
    // (souple) on ne lit pas la transaction, on se contente de la présence + confirmation
    const conf = st.confirmationStatus || "processed";

    // 2) Idempotent sans ON CONFLICT : on confirme d'abord une ligne PENDING existante
    let via = null;

    if (reference) {
      const u = await sql`
        UPDATE purchases
           SET status='CONFIRMED', signature=${sig}, confirmed_at=now()
         WHERE id=${reference}::uuid AND wallet=${wallet} AND status='PENDING'
       RETURNING id
      `;
      if (u?.[0]?.id) via = "reference-update";
    }

    if (!via) {
      const u2 = await sql`
        UPDATE purchases
           SET status='CONFIRMED', signature=${sig}, confirmed_at=now()
         WHERE wallet=${wallet} AND chapter_id=${chapterId} AND status='PENDING'
       RETURNING id
      `;
      if (u2?.[0]?.id) via = "pending-update";
    }

    if (!via) {
      // déjà confirmé ?
      const ex = await sql`
        SELECT id FROM purchases
         WHERE wallet=${wallet} AND chapter_id=${chapterId} AND status='CONFIRMED'
         LIMIT 1
      `;
      if (ex?.[0]?.id) {
        via = "already-confirmed";
      } else {
        // sinon on insère une CONFIRMED
        const id = crypto.randomUUID();
        await sql`
          INSERT INTO purchases (id, wallet, chapter_id, amount_raw, mint, merchant, status, signature, confirmed_at)
          VALUES (${id}::uuid, ${wallet}, ${chapterId}, ${CHAPTER_PRICE_RAW},
                  ${TOMATO_MINT.toBase58()}, ${MERCHANT_WALLET.toBase58()},
                  'CONFIRMED', ${sig}, now())
        `;
        via = "insert";
      }
    }

    // 3) Sécurité : annule tout PENDING résiduel pour ce chapitre
    await sql`
      UPDATE purchases
         SET status='CANCELLED'
       WHERE wallet=${wallet} AND chapter_id=${chapterId} AND status='PENDING'
    `;

    noCache(res);
    return res.status(200).json({
      ok: true,
      status: "RECORDED",
      via,
      confirmationStatus: conf,
      ...(debug ? { signatureStatus: st } : {})
    });

  } catch (e) {
    noCache(res);
    // si RPC rate-limit → laisse le client réessayer
    if (String(e?.message || "").toLowerCase().includes("rate")) {
      return res.status(200).json({ ok:true, status:"PENDING", rateLimited:true });
    }
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
