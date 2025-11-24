// src/chainkit/rewards.js

import { apiFetch } from "./api";

/**
 * Claim une reward on-chain via /api/rewards/claim
 * (le mapping eventKey -> montant se fait côté jeu ou côté backend)
 *
 * @param {string} eventKey - identifiant unique de l'événement
 * @param {number} amountUi - montant en unités "UI" (ex: 1000 TOMATO)
 * @param {object} opts - { setToast } pour feedback UI
 */
async function claimReward(eventKey, amountUi = 1, opts = {}) {
  const { setToast } = opts;
  try {
    const out = await apiFetch("/api/rewards/claim", {
      method: "POST",
      body: JSON.stringify({ eventKey, amountUi }),
    });

    if (out?.ok) {
      if (typeof setToast === "function") {
        setToast(out.already ? "Reward already received ✅" : "Reward sent 🎉");
        setTimeout(() => setToast(null), 2500);
      }
    } else {
      if (typeof setToast === "function") {
        setToast(`Reward: ${out?.error || "Server failure"}`);
        setTimeout(() => setToast(null), 2500);
      }
    }
    return out;
  } catch (e) {
    if (typeof setToast === "function") {
      setToast(`Reward: ${e?.message || e}`);
      setTimeout(() => setToast(null), 2500);
    }
    return { ok: false, error: String(e?.message || e) };
  }
}

export { claimReward };

