// src/chainkit/payments.js

import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { getInjectedWallet, ensureToken } from "./wallet";
import { apiCreatePaymentIntent, apiRecordPurchase } from "./api";

/**
 * Effectue un achat in-game (déblocage de chapitre / contenu).
 *
 * @param {string} chapterId - identifiant de contenu (chapitre, niveau, skin…)
 * @param {object} opts - hooks UI facultatifs { setUnlocked, setToast, setPayUrl }
 */
async function purchaseChapter(chapterId, opts = {}) {
  const { setUnlocked, setToast, setPayUrl } = opts;

  const provider = getInjectedWallet();
  if (!provider) throw new Error("No wallet detected (Phantom/Solflare).");

  try {
    await provider.connect();
  } catch {
    // ignore
  }

  const account = provider.publicKey?.toBase58?.();
  if (!account) throw new Error("Impossible de lire la clé publique du wallet.");

  const token = await ensureToken(true);
  const intent = await apiCreatePaymentIntent(chapterId);
  if (!intent?.ok || !intent.payUrl || !intent.reference) {
    throw new Error(intent?.error || "Intent failed");
  }

  const url = new URL(intent.payUrl, location.origin);
  url.searchParams.set("account", account);
  const r = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.transaction) throw new Error(j?.error || "Transaction not found");

  const raw = Uint8Array.from(atob(j.transaction), (c) => c.charCodeAt(0));
  let tx;
  try {
    tx = VersionedTransaction.deserialize(raw);
  } catch {
    tx = Transaction.from(raw);
  }

  let sig;
  if (provider.signAndSendTransaction) {
    const res = await provider.signAndSendTransaction(tx);
    sig =
      typeof res === "string"
        ? res
        : res?.signature || res?.txid || res?.txId || res?.txID;
  } else if (provider.signTransaction && window.connection) {
    const signed = await provider.signTransaction(tx);
    sig = await window.connection.sendRawTransaction(signed.serialize());
  } else {
    throw new Error("Incompatible wallet (no signAndSendTransaction).");
  }
  if (!sig) throw new Error("Signature introuvable.");

  window.__lastRefSig = { reference: intent.reference, sig };
  console.log("[pay] reference =", intent.reference, "sig =", sig);

  // Optimistic UI
  if (typeof setUnlocked === "function") {
    setUnlocked((u) =>
      Array.isArray(u) && u.includes(chapterId) ? u : [...(u || []), chapterId]
    );
  }
  if (typeof setToast === "function") {
    setToast(`Content ${chapterId} unlocked ✅`);
    setTimeout(() => setToast(null), 2000);
  }
  if (typeof setPayUrl === "function") setPayUrl(null);

  // Record DB (retry doux)
  let delay = 1200;
  const delayMax = 8000;
  const deadline = Date.now() + 90_000;

  for (;;) {
    if (Date.now() > deadline) {
      console.warn("[record] timeout after ~90s");
      break;
    }
    await new Promise((res) => setTimeout(res, delay));

    let rec = null;
    try {
      rec = await apiRecordPurchase(chapterId, sig, intent.reference);
    } catch (e) {
      console.warn("[record] fetch error:", e);
    }

    if (rec?.ok && rec?.status === "RECORDED") {
      console.log("[record] ok", rec);
      break;
    }
    if (rec?.error && /unauthor/i.test(rec.error)) {
      console.warn("[record] auth error, stop:", rec.error);
      break;
    }
    delay = Math.min(
      Math.round(delay * (rec?.rateLimited ? 2 : 1.5)),
      delayMax
    );
  }

  return sig;
}

export { purchaseChapter };

