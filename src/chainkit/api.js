// src/chainkit/api.js

import { ensureToken } from "./wallet";

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      status: res.status,
      error: text || `HTTP ${res.status}`,
    };
  }
}

/**
 * fetch JSON avec JWT auto (via ensureToken)
 */
async function apiFetch(path, { method = "GET", headers = {}, body, cache = "no-store" } = {}) {
  const token = await ensureToken();
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
    cache,
  });
  return safeJson(res);
}

// --- API "player" génériques ---

async function apiGetMe() {
  const token = await ensureToken();
  const res = await fetch("/api/player/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return safeJson(res);
}

async function apiGetUnlocked() {
  const token = await ensureToken();
  const res = await fetch("/api/player/unlocked", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return safeJson(res);
}

async function apiSaveCheckpoint(checkpointId) {
  const token = await ensureToken();
  const res = await fetch("/api/progress/checkpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ checkpointId }),
  });
  return safeJson(res);
}

// --- API "payments" génériques ---

async function apiCreatePaymentIntent(chapterId) {
  const token = await ensureToken(true);

  let res = await fetch("/api/payments/intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chapterId }), // "chapterId" = ID de contenu à débloquer
  });

  if (res.status === 401) {
    const t2 = await ensureToken(true);
    res = await fetch("/api/payments/intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t2}`,
      },
      body: JSON.stringify({ chapterId }),
    });
  }

  return safeJson(res);
}

async function apiRecordPurchase(chapterId, sig, reference) {
  const token = await ensureToken();
  const res = await fetch("/api/payments/record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chapterId, sig, reference }),
  });
  return safeJson(res);
}

export {
  apiFetch,
  apiGetMe,
  apiGetUnlocked,
  apiSaveCheckpoint,
  apiCreatePaymentIntent,
  apiRecordPurchase,
};

