// src/chainkit/wallet.js

// ⚠️ Ce SDK suppose que tu as déjà des routes backend :
// - GET  /api/auth/nonce?account=...&t=...
// - POST /api/auth/siws { account, signature, nonce, message, domain }

function getInjectedWallet() {
  if (typeof window === "undefined") return null;
  const phantom  = (window.solana && window.solana.isPhantom) ? window.solana : null;
  const solflare = (window.solflare && window.solflare.isSolflare) ? window.solflare : null;
  return phantom || solflare || window.solana || null;
}

function setToken(t) {
  if (typeof window === "undefined") return;
  window.__jwtToken = t || null;
  if (t) localStorage.setItem("jwt", t);
  else localStorage.removeItem("jwt");
}

function getToken() {
  if (typeof window === "undefined") return null;
  return window.__jwtToken || localStorage.getItem("jwt") || null;
}

function u8ToB64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function validateToken(token, expectedAccount) {
  if (!token) return false;
  try {
    const r = await fetch("/api/player/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const j = await r.json();
    if (j?.ok !== true || !j?.wallet) return false;
    if (expectedAccount && j.wallet !== expectedAccount) return false;
    return true;
  } catch {
    return false;
  }
}

let __authPromise = null;

/**
 * Garantit un JWT SIWS valide pour le wallet connecté.
 * @param {boolean} force - force un nouveau login SIWS
 * @returns {Promise<string>} JWT
 */
async function ensureToken(force = false) {
  const provider = getInjectedWallet();
  if (!provider) throw new Error("Wallet required (Phantom or Solflare).");

  try {
    await provider.connect();
  } catch {
    // ignore
  }
  const account = provider.publicKey?.toBase58?.();
  if (!account) throw new Error("Cannot read wallet public key.");

  if (!force) {
    const cached = getToken();
    if (cached && (await validateToken(cached, account))) {
      if (typeof window !== "undefined") window.__jwtToken = cached;
      return cached;
    }
    if (__authPromise) return __authPromise;
  }

  __authPromise = (async () => {
    const nonceRes = await fetch(
      `/api/auth/nonce?account=${encodeURIComponent(account)}&t=${Date.now()}`,
      {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
      }
    );
    const n = await nonceRes.json().catch(() => ({}));
    const nonce = n?.nonce;
    const message =
      n?.message ||
      `Sign in to TomatoCoin\nWallet: ${account}\nNonce: ${nonce}\nDomain: ${location.host}\nIssued At: ${new Date().toISOString()}`;
    if (!nonce || !message) throw new Error("Nonce endpoint failed.");

    const bytes = new TextEncoder().encode(message);
    let signed;
    try {
      signed = await provider.signMessage(bytes, "utf8");
    } catch {
      signed = await provider.signMessage(bytes);
    }
    const sigBytes = signed?.signature ?? signed;
    if (!(sigBytes instanceof Uint8Array))
      throw new Error("Wallet did not return a signature.");
    const signature = u8ToB64(sigBytes);

    const siwsRes = await fetch("/api/auth/siws", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account,
        signature,
        nonce,
        message,
        domain: location.host,
      }),
    });
    const j = await siwsRes.json().catch(() => ({}));
    if (!j?.token) throw new Error(j?.error || "SIWS failed.");

    setToken(j.token);
    return j.token;
  })();

  try {
    const t = await __authPromise;
    return t;
  } finally {
    __authPromise = null;
  }
}

/**
 * Force un "reconnect" SIWS propre (utile pour un bouton dans le HUD).
 */
async function reconnect() {
  const token = await ensureToken(true);
  try {
    const me = await fetch("/api/player/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).then((r) => r.json());
    return me;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  window.ensureToken = ensureToken; // debug
}

export { getInjectedWallet, getToken, setToken, ensureToken, reconnect };

