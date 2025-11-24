// api/payments/tx.js
export const config = { runtime: "nodejs" };

function noCache(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

import { requireAuth } from "../../lib/requireAuth.js";
import { sql } from "../../lib/db.js";
import { connection, TOMATO_MINT, TOMATO_DECIMALS } from "../../lib/solana.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    noCache(res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const userPk = requireAuth(req);
    const wallet = userPk.toBase58();

    const { reference, account } = req.query || {};
    if (!reference || !account) {
      noCache(res);
      return res
        .status(400)
        .json({ ok: false, error: "Missing reference or account" });
    }

    // JWT doit correspondre à `account`
    if (wallet !== account) {
      noCache(res);
      return res
        .status(400)
        .json({ ok: false, error: "JWT/account mismatch" });
    }

    // On charge l'intent de paiement
    const rows = await sql`
      SELECT id, wallet, chapter_id, amount_raw, mint, merchant, status
      FROM purchases
      WHERE id = ${reference}::uuid
      LIMIT 1;
    `;
    const intent = rows?.[0];

    if (!intent) {
      noCache(res);
      return res
        .status(404)
        .json({ ok: false, error: "Intent not found" });
    }

    if (intent.status !== "PENDING") {
      noCache(res);
      return res.status(400).json({
        ok: false,
        error: `Intent status is ${intent.status}`,
      });
    }

    // Adresses
    const playerPk = new PublicKey(wallet);
    const mintPk = new PublicKey(intent.mint || TOMATO_MINT);
    const merchantPk = new PublicKey(intent.merchant);

    const playerAta = await getAssociatedTokenAddress(mintPk, playerPk);
    const merchantAta = await getAssociatedTokenAddress(mintPk, merchantPk);

    // Montant en "raw" (u64)
    const amountRaw = BigInt(intent.amount_raw);

    // Instruction SPL avec décimales connues
    const ix = createTransferCheckedInstruction(
      playerAta,
      mintPk,
      merchantAta,
      playerPk,
      amountRaw,
      TOMATO_DECIMALS
    );

    // Blockhash récent
    const { blockhash } = await connection.getLatestBlockhash("finalized");

    // Message v0 + transaction versionnée
    const msg = new TransactionMessage({
      payerKey: playerPk,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const vtx = new VersionedTransaction(msg);

    // Sérialisation base64
    const b64 = Buffer.from(vtx.serialize()).toString("base64");

    noCache(res);
    return res.status(200).json({ ok: true, transaction: b64 });
  } catch (e) {
    noCache(res);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || String(e) });
  }
}
