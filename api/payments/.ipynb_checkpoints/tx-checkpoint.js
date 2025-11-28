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
import {
  connection,
  TOMATO_MINT,
  TOMATO_DECIMALS,
  MERCHANT_WALLET,
  CHAPTER_PRICE_RAW,
} from "../../lib/solana.js";

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

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

    if (!UUID_RE.test(String(reference))) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Invalid reference format" });
    }

    // JWT doit correspondre à `account`
    if (wallet !== account) {
      noCache(res);
      return res
        .status(400)
        .json({ ok: false, error: "JWT/account mismatch" });
    }

    // On charge l'intent de paiement
    const rows = await sql/* sql */`
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

    if (intent.wallet !== wallet) {
      noCache(res);
      return res.status(403).json({ ok: false, error: "Intent does not belong to this wallet" });
    }

    if (intent.status !== "PENDING") {
      noCache(res);
      return res.status(400).json({
        ok: false,
        error: `Intent status is ${intent.status}`,
      });
    }

    // Petits garde-fous de cohérence
    if (BigInt(intent.amount_raw) !== BigInt(CHAPTER_PRICE_RAW)) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Unexpected amount_raw in intent" });
    }

    if (intent.mint !== TOMATO_MINT.toBase58()) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Unexpected mint in intent" });
    }

    if (intent.merchant !== MERCHANT_WALLET.toBase58()) {
      noCache(res);
      return res.status(400).json({ ok: false, error: "Unexpected merchant in intent" });
    }

    // Adresses
    const playerPk   = new PublicKey(wallet);
    const mintPk     = TOMATO_MINT;
    const merchantPk = MERCHANT_WALLET;

    const playerAta   = await getAssociatedTokenAddress(mintPk, playerPk);
    const merchantAta = await getAssociatedTokenAddress(mintPk, merchantPk);

    const amountRaw = BigInt(intent.amount_raw);

    const ix = createTransferCheckedInstruction(
      playerAta,
      mintPk,
      merchantAta,
      playerPk,
      amountRaw,
      TOMATO_DECIMALS
    );

    const { blockhash } = await connection.getLatestBlockhash("finalized");

    const msg = new TransactionMessage({
      payerKey: playerPk,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const vtx = new VersionedTransaction(msg);
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
