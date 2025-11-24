// src/App.jsx — paywall TOMATO sur TOUS les chapitres + cloud save, HUD, bulles, audio
// - SIWS Phantom/Solflare → JWT (localStorage) + renouvellement auto si expiré
// - /api/player/me au chargement → reprise checkpoint
// - /api/progress/checkpoint à chaque choix/saut
// - Chapitres payants: /api/payments/intent + /api/payments/verify (10 000 TOMATO)
//   * Desktop avec Phantom/Solflare: signature directe (signAndSendTransaction)
//   * Mobile: Universal Link Phantom + QR (solana:)
// - Récompenses on-chain (ex: +1 000 TOMATO) via /api/rewards/claim
// - AUCUN blocage par solde TOMATO, AUCUN “crédit” local
// - Garde-fou: si le chapitre du nœud courant n’est pas débloqué → écran “Chapitre verrouillé” + QR

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { QRCodeCanvas as QRCode } from "qrcode.react";

import script from "./game/script.json";
import "./styles.css";
import DialogueBubbles from "./components/DialogueBubbles";

function storageKey(base, pubkey) {
  const id = pubkey ? pubkey.toBase58() : "guest";
  return `${base}::${id}`;
}


const DEV_UNLOCK = import.meta.env.VITE_DEV_UNLOCK === "true";

const TOMATO_MINT = new PublicKey("CdczQNrp2DZ9c89LSjCyRF6VmS4VtTCBkNSjXtpvmoon");

const BG = {
  field: "/assets/field.png",
  forest: "/assets/forest.png",
  house: "/assets/house.png",
  houseinside: "/assets/houseinside.png",
  path: "/assets/path.png",
  city: "/assets/city.png",
  mountain: "/assets/mountain.png",
  market: "/assets/market.png",
  temple: "/assets/temple.png",
  diningroom: "/assets/diningroom.png",
  forestentry: "/assets/forestentry.png",
  clearing: "/assets/clearing.png",
  clearingnight: "/assets/clearingnight.png",
  montainpeak: "/assets/montainpeak.png",
  templeentry: "/assets/templeentry.png",
  templeinside: "/assets/templeinside.png",
  mountaindescent: "/assets/mountaindescent.png",
  camp: "/assets/camp.png",
  clearingsnow: "/assets/clearingsnow.png",
  clearingsnownight: "/assets/clearingsnownight.png",
};

const SPR = {
  tomatola: "/assets/tomatola.png",
  wolf: "/assets/wolf.png",
  tomato: "/assets/tomato.png",
  tomatolaandwolf: "/assets/tomatolaandwolf.png",
  traveler: "/assets/traveler.png",
  familyatthetable: "/assets/familyatthetable.png",
  tomatolaandfather: "/assets/tomatolaandfather.png",
  tomatolafindstomato: "/assets/tomatolafindstomato.png",
  tomatolaback: "/assets/tomatolaback.png",
  tomatolameetswolf: "/assets/tomatolameetswolf.png",
  tomatolaandfathertomato: "/assets/tomatolaandfathertomato.png",
  buildtrap: "/assets/buildtrap.png",
  trappeddeer: "/assets/trappeddeer.png",
  tomatolawolffire: "/assets/tomatolawolffire.png",
  tomatolacoatwolf: "/assets/tomatolacoatwolf.png",
  fightbear: "/assets/fightbear.png",
  woundedwolf: "/assets/woundedwolf.png", 
  carrywolf: "/assets/carrywolf.png", 
  tomatolatraveler: "/assets/tomatolatraveler.png", 
  teacher: "/assets/teacher.png",  
  wolftomatolateacher: "/assets/wolftomatolateacher.png",  
  tomatolabird: "/assets/tomatolabird.png",
  tomatolateacher: "/assets/tomatolateacher.png",
  bear: "/assets/bear.png", 
  curedbird: "/assets/curedbird.png",
  birddead: "/assets/birddead.png",
  sickchild: "/assets/sickchild.png",
  grimoire: "/assets/grimoire.png",  
  goodbye: "/assets/goodbye.png",  
  tomatolawolfdescent: "/assets/tomatolawolfdescent.png",
  adventurer: "/assets/adventurer.png", 
  tomatolaadventurer: "/assets/tomatolaadventurer.png",
  wolfright: "/assets/wolfright.png", 
  wolfupright: "/assets/wolfupright.png",
  adventurerbow: "/assets/adventurerbow.png", 
  bow: "/assets/bow.png", 
  rabbit: "/assets/rabbit.png", 
  tomatolarabbit: "/assets/tomatolarabbit.png", 
  rabbitrunning: "/assets/rabbitrunning.png", 
  tomatolafire: "/assets/tomatolafire.png", 
  meal: "/assets/meal.png",
};

const SFX = {
  tomatoFound: "/audio/sfx_tomato_found.mp3",
  deerStruggle: "/audio/sfx_deer_struggle.mp3",
  fireLoop: "/audio/sfx_fire_loop.mp3",
  bearRoar: "/audio/sfx_bear_roar.mp3",
  whistle: "/audio/sfx_whistle.mp3",  
  magicspells: "/audio/sfx_magic_spells.mp3",  
};




const SND = {
  bgm: "/audio/bgm.mp3",
  click: "/audio/click.mp3",
  next: "/audio/advance.mp3",
};


const REWARD_EVENTS = {
  // Exemple : clé unique par reward + montant TOMATO
  "c2_temple_inside": { key: "reward_c2_temple_inside_v1", amount: 1000 },
};



// --- API base (utilise NEXT_PUBLIC_BASE_URL si présent) ---
const API_BASE =
  (import.meta?.env?.VITE_API_BASE ??
   import.meta?.env?.NEXT_PUBLIC_BASE_URL ??
   "");

// --- parse JSON sûr (évite "unexpected end of data") ---
async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok:false, status:res.status, error:text || `HTTP ${res.status}` }; }
}

// --- fetch avec JWT auto ---



// -- Enregistre un achat confirmé en base (record après signature)
async function apiRecordPurchase(token, chapterId, sig, reference) {
  const res = await fetch("/api/payments/record", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chapterId, sig, reference }),
  });
  try { return await res.json(); } catch { return null; }
}






async function readSplBalanceParsed(connection, ownerPk, mintPk) {
  try {
    const res = await connection.getParsedTokenAccountsByOwner(
      ownerPk,
      { programId: TOKEN_PROGRAM_ID },
      "confirmed"
    );
    if (!res?.value?.length) return 0;
    let total = 0;
    for (const it of res.value) {
      const info = it.account.data.parsed.info;
      if (info.mint === mintPk.toBase58()) {
        total += Number(info.tokenAmount?.uiAmount || 0);
      }
    }
    return total;
  } catch {
    return 0;
  }
}

// ===================== AUTH + API + PAYMENT (RESET) =====================


// ——— helpers communs ———
function getInjectedWallet() {
  const phantom  = (window.solana && window.solana.isPhantom) ? window.solana : null;
  const solflare = (window.solflare && window.solflare.isSolflare) ? window.solflare : null;
  return phantom || solflare || window.solana || null;
}
function setToken(t){ window.__jwtToken = t || null; if(t) localStorage.setItem("jwt", t); else localStorage.removeItem("jwt"); }
function getToken(){ return window.__jwtToken || localStorage.getItem("jwt") || null; }
function u8ToB64(u8){ let s=""; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }

// Valide le JWT et vérifie (si fourni) qu’il correspond au wallet attendu
async function validateToken(token, expectedAccount) {
  try {
    const r = await fetch("/api/player/me", { headers:{Authorization:`Bearer ${token}`}, cache:"no-store" });
    const j = await r.json();
    if (j?.ok !== true || !j?.wallet) return false;
    if (expectedAccount && j.wallet !== expectedAccount) return false;
    return true;
  } catch { return false; }
}

// Évite les logins concurrents
let __authPromise = null;

// 🔐 S’assure d’avoir un JWT pour *le wallet actuellement connecté*
async function ensureToken(force = false) {
  // 1) lis le provider + clef *avant toute chose*
  const provider = getInjectedWallet();
  if (!provider) throw new Error("Wallet required (Phantom/Solflare).");
  try { await provider.connect(); } catch {}
  const account = provider.publicKey?.toBase58?.();
  if (!account) throw new Error("Cannot read wallet public key.");

  // 2) si on a déjà un token en cache *pour ce wallet*, on le garde
  if (!force) {
    const cached = getToken();
    if (cached && await validateToken(cached, account)) return (window.__jwtToken = cached);
    if (__authPromise) return __authPromise; // un login est déjà en cours
  }

  // 3) sinon on refait le SIWS propre
  __authPromise = (async () => {
    // Nonce côté serveur (DB) — cache-buster
    const nonceRes = await fetch(`/api/auth/nonce?account=${encodeURIComponent(account)}&t=${Date.now()}`, {
      method: "GET", headers: { "Cache-Control":"no-cache","Pragma":"no-cache" }, cache:"no-store"
    });
    const n = await nonceRes.json().catch(() => ({}));
    const nonce   = n?.nonce;
    const message = n?.message || `Sign in to TomatoCoin\nWallet: ${account}\nNonce: ${nonce}\nDomain: ${location.host}\nIssued At: ${new Date().toISOString()}`;
    if (!nonce || !message) throw new Error("Nonce endpoint failed.");

    // Signature du message
    const bytes = new TextEncoder().encode(message);
    let signed;
    try { signed = await provider.signMessage(bytes, "utf8"); }
    catch { signed = await provider.signMessage(bytes); }
    const sigBytes = signed?.signature ?? signed;
    if (!(sigBytes instanceof Uint8Array)) throw new Error("Wallet did not return a signature.");
    const signature = u8ToB64(sigBytes);

    // SIWS → JWT
    const siwsRes = await fetch("/api/auth/siws", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ account, signature, nonce, message, domain: location.host })
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
if (typeof window !== "undefined") window.ensureToken = ensureToken;



// --- fetch JSON avec JWT auto ---
async function apiFetch(path, { method = "GET", headers = {}, body, cache = "no-store" } = {}) {
  const token = await ensureToken(); // garantit un JWT pour le wallet courant
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...headers },
    body,
    cache,
  });
  return safeJson(res);
}



// -------- Helpers API --------


async function apiCreatePaymentIntent(token, chapterId) {
  let res = await fetch("/api/payments/intent", {
    method: "POST",
    headers: { "Content-Type":"application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ chapterId }),
  });
  if (res.status === 401) {
    const t2 = await ensureToken(true);
    res = await fetch("/api/payments/intent", {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ chapterId }),
    });
  }
      
  return safeJson(res);
}



async function apiGetMe(token) {
  const res = await fetch("/api/player/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return safeJson(res);
}

async function apiSaveCheckpoint(token, checkpointId) {
  const res = await fetch("/api/progress/checkpoint", {
    method: "POST",
    headers: { "Content-Type":"application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ checkpointId }),
  });
  return safeJson(res);
}







// (utile au boot pour restaurer les chapitres)
async function apiGetUnlocked(token) {
  const res = await fetch("/api/player/unlocked", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return safeJson(res);
}

// -------- Paiement Desktop (Phantom/Solflare) --------
// Nécessite setUnlocked, setRewardToast, setPayUrl (optionnel) dans ton composant.
async function signOnDesktop(chapterId, opts = {}) {
  const { setUnlocked, setRewardToast, setPayUrl } = opts;

  // 0) Wallet
  const provider = getInjectedWallet();
  if (!provider) throw new Error("No wallet detected (Phantom/Solflare).");
  try { await provider.connect(); } catch {}
  const account = provider.publicKey?.toBase58?.();
  if (!account) throw new Error("Impossible de lire la clé publique du wallet.");

  // 1) Intent (DB)
  const token  = await ensureToken(true);
  const intent = await apiCreatePaymentIntent(token, chapterId);
  if (!intent?.ok || !intent.payUrl || !intent.reference) {
    throw new Error(intent?.error || "Intent failed");
  }

  // 2) Transaction depuis le backend (JWT/account vérifiés côté serveur)
  const url = new URL(intent.payUrl, location.origin);
  url.searchParams.set("account", account);
  const r = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "Cache-Control":"no-cache", "Pragma":"no-cache" },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!j?.transaction) throw new Error(j?.error || "Transaction not found");

  // 3) Désérialise (v0 ou legacy)
  const raw = Uint8Array.from(atob(j.transaction), c => c.charCodeAt(0));
  let tx;
  try { tx = VersionedTransaction.deserialize(raw); }
  catch { tx = Transaction.from(raw); }

  // 4) Signature + envoi
  let sig;
  if (provider.signAndSendTransaction) {
    const res = await provider.signAndSendTransaction(tx);
    sig = (typeof res === "string")
      ? res
      : (res?.signature || res?.txid || res?.txId || res?.txID);
  } else if (provider.signTransaction && window.connection) {
    const signed = await provider.signTransaction(tx);
    sig = await window.connection.sendRawTransaction(signed.serialize());
  } else {
    throw new Error("Incompatible wallet (signAndSendTransaction indisponible).");
  }
  if (!sig) throw new Error("Signature introuvable.");

  // utilitaire debug
  window.__lastRefSig = { reference: intent.reference, sig };
  console.log("[pay] reference =", intent.reference, "sig =", sig);

  // 5) ⚡️ Optimistic UI immédiat
  if (typeof setUnlocked === "function") {
    setUnlocked((u) => (Array.isArray(u) && u.includes(chapterId) ? u : [...(u||[]), chapterId]));
  }
  if (typeof setRewardToast === "function") {
    setRewardToast(`Chapitre ${chapterId} débloqué ✅`);
    setTimeout?.(() => setRewardToast?.(null), 2000);
  }
  if (typeof setPayUrl === "function") setPayUrl(null);

  // 6) 🧾 Enregistrement DB (retry doux jusqu’au succès)
  let delay = 1200;
  const delayMax = 8000;
  const deadline = Date.now() + 90_000;

  for (;;) {
    if (Date.now() > deadline) {
      console.warn("[record] timeout après ~90s");
      break;
    }
    await new Promise((res) => setTimeout(res, delay));

    let rec = null;
    try {
      const token2 = await ensureToken(); // au cas où
      rec = await apiRecordPurchase(token2, chapterId, sig, intent.reference);
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
    delay = Math.min(Math.round(delay * (rec?.rateLimited ? 2 : 1.5)), delayMax);
  }

  return sig; // utile si tu veux afficher un lien explorer
}

// Expose pour debug console
if (typeof window !== "undefined") {
  window.ensureToken = ensureToken;
  window.apiCreatePaymentIntent = apiCreatePaymentIntent;
  window.apiRecordPurchase = apiRecordPurchase;
  window.signOnDesktop = (cid) => signOnDesktop(cid, window.__appHooks || {});
}

// ===================== /AUTH + API + PAYMENT (RESET) =====================



















/* ============== App ============== */
export default function App() {
  const sfxRefs = useRef({});
  const [hp, setHp] = useState(100);
  const CHAPTERS = script.__chapters || null;


  const CHAPTER_LOCKED_IMAGES = {
    c2: BG.mountain, // réutilise /assets/mountain.png (tu as aussi "montain" si typo)
    c3: BG.forest,                 // /assets/forest.png
    default: BG.field,             // fallback si currentChapId est null
  };
    
  const { publicKey } = useWallet();
  const { connection } = useConnection();


// dans App(), ajoute :
useEffect(() => { if (connection) window.connection = connection; }, [connection]);




// état unlocked existant — initialisation modifiée
const [unlocked, setUnlocked] = useState(() => {
  try {
    const u = JSON.parse(localStorage.getItem("unlockedChapters") || "[]");
    if (DEV_UNLOCK) {
      // en dev : débloque tous les chapitres pour test
      return Array.from(new Set([...(CHAPTERS || []).map(c => c.id), ...u]));
    }
    return Array.from(new Set(["c1", ...u])); // production: c1 gratuit + local
  } catch { return DEV_UNLOCK ? (CHAPTERS||[]).map(c=>c.id) : ["c1"]; }
});


  const [nodeId, setNodeId] = useState(() => {
    const saved = localStorage.getItem("node");
    if (saved) return saved;
    const ul = JSON.parse(localStorage.getItem("unlockedChapters") || "[]");
    const first = (ul && ul.length ? ul[0] : "c1");
    const entry = (CHAPTERS?.find(c => c.id === first)?.entry) ?? "c1_start";
    return entry;
  });

// Rewards déjà réclamés (persistés localement)
const REWARDS_KEY = "claimedRewards_v1";
const [claimedRewards, setClaimedRewards] = useState(() => {
  try { return new Set(JSON.parse(localStorage.getItem(REWARDS_KEY) || "[]")); }
  catch { return new Set(); }
});


// --- Rewards côté client (dans App) ---
function isRewardClaimed(key) {
  return claimedRewards.has(key);
}
function markRewardClaimed(key) {
  setClaimedRewards(prev => {
    const next = new Set(prev);
    next.add(key);
    try { localStorage.setItem(REWARDS_KEY, JSON.stringify(Array.from(next))); } catch {}
    return next;
  });
}

async function claimReward(eventKey, amountUi = 1) {
  try {
    if (isRewardClaimed(eventKey)) {
      setRewardToast("Reward already received ✅");
      setTimeout(() => setRewardToast(null), 2000);
      return { ok: true, already: true };
    }
    const t = await ensureToken();
    const out = await apiFetch("/api/rewards/claim", {
      method: "POST",
      body: JSON.stringify({ eventKey, amountUi }),
    });

    if (out?.ok) {
      markRewardClaimed(eventKey);
      setRewardToast(out.already ? "Reward already received ✅" : "Reward sent 🎉");
    } else {
      setRewardToast(`Reward: ${out?.error || "Server failure"}`);
    }
    setTimeout(() => setRewardToast(null), 2500);
    return out;
  } catch (e) {
    setRewardToast(`Reward: ${e?.message || e}`);
    setTimeout(() => setRewardToast(null), 2500);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function maybeClaimRewardForNode(nodeId) {
  const cfg = REWARD_EVENTS[nodeId];
  if (!cfg) return;
  if (isRewardClaimed(cfg.key)) return;
  await claimReward(cfg.key, cfg.amount);
}

useEffect(() => {
  const provider = (window.solana?.isPhantom && window.solana) ||
                   (window.solflare?.isSolflare && window.solflare) ||
                   window.solana;

  if (!provider?.on) return;

  const onChange = async (pk) => {
    const next = pk?.toBase58?.() || pk || null;
    console.log("[wallet] accountChanged ->", next);

    // 1) on “oublie” le token et le cache UI
    setToken(null);
    setUnlocked([]);             // vider la liste locale
    // setWallet?.(next || null); // si tu as un state wallet

    // 2) si on a un nouveau wallet -> re-auth + reload des chapitres
    if (next) {
      try {
        const t = await ensureToken(true);            // JWT *pour ce wallet*
        const j = await fetch("/api/player/unlocked", {
          headers: { Authorization: `Bearer ${t}` }, cache: "no-store"
        }).then(r => r.json()).catch(() => null);
        if (Array.isArray(j?.unlocked)) setUnlocked(j.unlocked);
      } catch (e) {
        console.warn("[wallet] re-auth failed:", e);
      }
    }
  };

  provider.on("accountChanged", onChange);
  provider.on("disconnect",    () => onChange(null));

  return () => {
    try { provider.removeListener?.("accountChanged", onChange); } catch {}
  };
}, []);


    
    
  const node = script[nodeId] || {};
  const currentChapId = (nodeId.match(/^(c\d+)_/) || [])[1] || null;

  const hasNarration = (node.text || "").trim().length > 0;

  const [showChapters, setShowChapters] = useState(false);
  const [tomatoBalance, setTomatoBalance] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem("volume") || 0.6));
  const [typedText, setTypedText] = useState("");
  const [typing, setTyping] = useState(true);
  const [rewardToast, setRewardToast] = useState(null);
  const [payUrl, setPayUrl] = useState(null); // QR / deep-link
   // Inventaire (⚠️ doit être déclaré avant tout useEffect qui l’emploie)
  const [inventory, setInventory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("inventory") || "[]"); }
    catch { return []; }
  });
  const addItemOnce = (item) =>
    setInventory(prev => (prev.includes(item) ? prev : [...prev, item]));

  const CLAIMED_ONCHAIN_KEY = "claimedOnchainRewards_v1";
  const [claimedOnchain, setClaimedOnchain] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CLAIMED_ONCHAIN_KEY) || "[]")); }
    catch { return new Set(); }
  });

  const bgmRef = useRef(null), clickRef = useRef(null), nextRef = useRef(null);

  const [chapterBanner, setChapterBanner] = useState(null); // string | null
  const bannerTimerRef = useRef(null);

useEffect(() => {
  localStorage.setItem("inventory", JSON.stringify(inventory));
}, [inventory]);


const LEVEL_STEP = 100; // 100 XP = 1 niveau (change si tu veux)


// --- HEAL XP (charge/sauve par wallet) ---
const [healXp, setHealXp] = useState(0);
useEffect(() => {
  const key = storageKey("healXp_v1", publicKey);
  // Migration (une fois) depuis ancienne clé *non* préfixée
  const legacy = localStorage.getItem("healXp_v1");
  if (legacy !== null && localStorage.getItem(key) === null) {
    try { localStorage.setItem(key, legacy); } catch {}
  }
  try { setHealXp(Number(localStorage.getItem(key) || 0)); } catch { setHealXp(0); }
}, [publicKey]);
useEffect(() => {
  const key = storageKey("healXp_v1", publicKey);
  try { localStorage.setItem(key, String(healXp)); } catch {}
}, [healXp, publicKey]);

// --- Nœuds déjà crédités (one-time) par wallet ---
const [claimedHealXpNodes, setClaimedHealXpNodes] = useState(new Set());
useEffect(() => {
  const key = storageKey("healXp_claimed_v1", publicKey);
  // Migration (une fois) depuis ancienne clé *non* préfixée
  const legacy = localStorage.getItem("healXp_claimed_v1");
  if (legacy !== null && localStorage.getItem(key) === null) {
    try { localStorage.setItem(key, legacy); } catch {}
  }
  try {
    const raw = localStorage.getItem(key);
    setClaimedHealXpNodes(raw ? new Set(JSON.parse(raw)) : new Set());
  } catch { setClaimedHealXpNodes(new Set()); }
}, [publicKey]);
useEffect(() => {
  const key = storageKey("healXp_claimed_v1", publicKey);
  try { localStorage.setItem(key, JSON.stringify([...claimedHealXpNodes])); } catch {}
}, [claimedHealXpNodes, publicKey]);

// --- Dérivés (niveau + progression) ---
const healLevel = Math.floor(healXp / LEVEL_STEP);
const healCur   = healXp % LEVEL_STEP;
const healToNext= LEVEL_STEP;





  // Purge localStorage si le wallet change
useEffect(() => {
  const current = publicKey?.toBase58() || "";
  const prev = localStorage.getItem("lastWallet") || "";

  if (!current) return; // pas encore connecté

  if (current !== prev) {
    // Purge des clés locales qui peuvent créer une incohérence
    localStorage.removeItem("unlockedChapters");
    localStorage.removeItem("node");
    localStorage.removeItem("jwt"); // le prochain ensureToken() régénérera un JWT propre
    localStorage.removeItem("claimedOnchainRewards_v1");
    localStorage.removeItem("inventory"); // <-- ajouter ici lors de la purge

     try { setHealXp(0); } catch {}
     try { setClaimedHealXpNodes(new Set()); } catch {}


    // Marquer le nouveau wallet
    localStorage.setItem("lastWallet", current);

    // Remise à zéro UI
    setUnlocked([]);                // forcer l’UI à "verrouillé" en attendant la sync serveur
    setHp(100);                     // état sûr par défaut
  }
}, [publicKey]);

    

    
  useEffect(() => { localStorage.setItem("unlockedChapters", JSON.stringify(unlocked)); }, [unlocked]);
  useEffect(() => {
    localStorage.setItem("volume", String(volume));
    if (bgmRef.current) bgmRef.current.volume = volume;
    if (clickRef.current) clickRef.current.volume = Math.min(1, volume + 0.1);
    if (nextRef.current) nextRef.current.volume = Math.min(1, volume + 0.05);
    Object.values(sfxRefs.current).forEach(audio => {
     if (audio) audio.volume = volume;
});

  }, [volume]);
  useEffect(() => { localStorage.setItem(CLAIMED_ONCHAIN_KEY, JSON.stringify([...claimedOnchain])); }, [claimedOnchain]);

  useEffect(() => {
    bgmRef.current = new Audio(SND.bgm); bgmRef.current.loop = true; bgmRef.current.volume = volume;
    clickRef.current = new Audio(SND.click); clickRef.current.volume = Math.min(1, volume + 0.1);
    nextRef.current = new Audio(SND.next); nextRef.current.volume = Math.min(1, volume + 0.05);
    const unlock = () => { bgmRef.current?.play().catch(()=>{}); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); bgmRef.current?.pause(); };
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      if (!publicKey) { setTomatoBalance(null); return; }
      setLoadingBal(true);
      const tomato = await readSplBalanceParsed(connection, publicKey, TOMATO_MINT);
      if (!stop) setTomatoBalance(tomato);
      setLoadingBal(false);
    })();
    return () => { stop = true; };
  }, [publicKey, connection]);

  useEffect(() => {
    (async () => {
      try {
        const t = getToken(); if (!t) return;
        const me = await apiGetMe(t);
        if (me?.last_checkpoint && script[me.last_checkpoint]) {
          setNodeId(me.last_checkpoint);
          localStorage.setItem("node", me.last_checkpoint);
        }
        const ul = await apiGetUnlocked(t);
        if (Array.isArray(ul.unlocked) && ul.unlocked.length) {
          setUnlocked(prev => Array.from(new Set([...prev, ...ul.unlocked])));
          if (!nodeId && ul.unlocked.length) {
            const entry = (CHAPTERS?.find(c => c.id === ul.unlocked[0])?.entry) ?? "c1_start";
            setNodeId(entry);
            localStorage.setItem("node", entry);
          }
        }
      } catch (e) { console.debug("init:", e?.message || e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const full = node.text || "";
    setTypedText(""); setTyping(true);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTypedText(full.slice(0, i));
      if (i >= full.length) { setTyping(false); clearInterval(id); }
    }, Math.max(12, 900 / Math.max(10, full.length)));
    return () => clearInterval(id);
  }, [nodeId, node.text]);


   useEffect(() => {
  if (!nodeId || !CHAPTERS) return;

  const chap = (nodeId.match(/^(c\d+)_/) || [])[1];
  if (!chap) return;

  const meta = CHAPTERS.find(c => c.id === chap);
  const entry = meta?.entry || null;

  // Annoncer uniquement au nœud d’entrée du chapitre
  if (entry && nodeId === entry) {
    const title = meta?.title || chap.toUpperCase();
    const text = `📜 ${title} — Beginning of the chapter`;
    setChapterBanner(text);

    // Nettoie un éventuel timer précédent
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setChapterBanner(null), 3000);
  }

  return () => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  };
}, [nodeId, CHAPTERS]);

    

  useEffect(() => {
  Object.entries(SFX).forEach(([key, path]) => {
    const audio = new Audio(path);
    if (key === "fireLoop") audio.loop = true;
    audio.volume = volume;
    sfxRefs.current[key] = audio;
  });
}, []);

useEffect(() => {
  const sfxKey = node.sfx;

  // On QUITTE l'ancien nœud : couper d'éventuels loops ET relancer la BGM
  let hadLoop = false;
  Object.values(sfxRefs.current).forEach((audio) => {
    if (audio?.loop && !audio.paused) {
      audio.pause();
      hadLoop = true;
    }
  });
  if (hadLoop && bgmRef.current) {
    try { bgmRef.current.play(); } catch {}
  }

  if (!sfxKey) return;

  // Entrée sur le nouveau nœud : joue le SFX et mets la BGM en pause
  playSfxAndPauseBgm(sfxKey);
}, [nodeId]);

useEffect(() => {
  if (!nodeId) return;

  if (nodeId === "c1_find_tomato") addItemOnce("tomato");
  if (nodeId === "c1_path") addItemOnce("bag");
  if (nodeId === "c1_fire") addItemOnce("coat");

  if (nodeId === "c3_bow") addItemOnce("bow");
  if (nodeId === "c2_temple_inside") {
    addItemOnce("grimoire");
    maybeClaimRewardForNode("c2_temple_inside"); // pas d'await nécessaire
  

  }
}, [nodeId]);



    


useEffect(() => {
  if (!nodeId) return;
  const n = script[nodeId];
  if (!n) return;

  // ❗ Aucun XP sur un nœud qui lance un randomEvent (pour éviter les conflits)
  if (n.randomEvent) return;

  // One-time XP par nœud
  if (Number.isFinite(n.healXp) && n.healXp !== 0) {
    if (claimedHealXpNodes.has(nodeId)) return; // déjà pris pour ce wallet

    const delta = Math.trunc(n.healXp);
    setHealXp(prev => {
      const before = Math.floor(prev / LEVEL_STEP);
      const next   = Math.max(0, prev + delta);
      const after  = Math.floor(next / LEVEL_STEP);

      if (after > before) {
        setRewardToast?.(`✨ Healing Lv ${after} atteint !`);
        setTimeout(() => setRewardToast?.(null), 1800);
      } else {
        setRewardToast?.(`${delta > 0 ? "+" : ""}${delta} XP guérison`);
        setTimeout(() => setRewardToast?.(null), 1200);
      }
      return next;
    });

    setClaimedHealXpNodes(prev => {
      const s = new Set(prev);
      s.add(nodeId);
      return s;
    });
  }
}, [nodeId, script, claimedHealXpNodes, LEVEL_STEP]);


  const lastRandomEventNodeRef = useRef(null);

useEffect(() => {
  if (!nodeId) return;
  const cur = script[nodeId];
  if (!cur) return;

  const re = cur.randomEvent;
  if (!re) { 
    lastRandomEventNodeRef.current = null; 
    return; 
  }

  // anti double-fire (StrictMode / re-render)
  if (lastRandomEventNodeRef.current === nodeId) return;
  lastRandomEventNodeRef.current = nodeId;

  let { successChance = 0.5, successNext, failNext, delayMs = 0 } = re;
  successChance = Math.max(0, Math.min(1, Number(successChance) || 0));
  if (!successNext || !script[successNext]) return;
  if (!failNext || !script[failNext]) return;
  if (successNext === nodeId || failNext === nodeId) return;

  const t = setTimeout(() => {
    const roll = Math.random();
    const next = roll < successChance ? successNext : failNext;
    setNodeId(next);
    localStorage.setItem("node", next);
    (async () => { try { const tok = await ensureToken(); await apiSaveCheckpoint(tok, next); } catch {} })();
  }, Math.max(0, Number(delayMs) || 0));

  return () => clearTimeout(t);
}, [nodeId, script]);
  

  useEffect(() => {
  // Reset PV au début du chapitre 1
  if (nodeId === "c1_start") {
    setHp(100);
  }

  // Attaque de l'ours : -50 PV (sans descendre sous 0)
  if (nodeId === "c2_bear") {
    setHp((prev) => Math.max(0, prev - 50));
  }


}, [nodeId]);


  const choices = useMemo(
    () => (node.choices || []).map((c, idx) => ({ ...c, hotkey: String(idx + 1) })),
    [node]
  );


  const canAccessChapter = (chapterId) =>
    chapterId === "c1" || unlocked.includes(chapterId);

  
  function playSfxAndPauseBgm(key) {
  const audio = sfxRefs.current[key];
  if (!audio) return;

  // pause BGM
  if (bgmRef.current) bgmRef.current.pause();

  try {
    audio.currentTime = 0;
    audio.play();

    audio.onended = () => {
      if (bgmRef.current) bgmRef.current.play();
    };
  } catch {}
}

// ✅ Wrapper "reconnect" : force un JWT propre via SIWS/nonce DB-first
async function reconnect({ setWallet, setJwt } = {}) {
  const token = await ensureToken(true); // <- force un nouveau token
  try {
    // optionnel : mettre à jour l’état UI avec le wallet coté serveur
    const me = await fetch("/api/player/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).then(r => r.json());
    if (me?.ok && me.wallet) setWallet?.(me.wallet);
  } catch {}
  setJwt?.(token); // si tu gères un état jwt
  return token;
}


  async function choose(c) {
    if (clickRef.current) { try { clickRef.current.currentTime = 0; await clickRef.current.play(); } catch {} }
    setNodeId(c.next);
    localStorage.setItem("node", c.next);
    try { const t = await ensureToken(); await apiSaveCheckpoint(t, c.next); }
    catch (e) { console.debug("save checkpoint:", e?.message || e); }
  }

  function advanceIfSingleChoice() {
    if (!typing && choices.length === 1) {
      if (nextRef.current) { try { nextRef.current.currentTime = 0; nextRef.current.play(); } catch {} }
      choose(choices[0]);
    } else if (typing) {
      setTypedText(node.text || ""); setTyping(false);
    }
  }









    
async function onUnlockChapter(chapterId) {
  if (!chapterId) return;

  // évite les doubles clics
  if (onUnlockChapter._busy) return;
  onUnlockChapter._busy = true;

  try {
    // ferme la liste pendant le flow de paiement (optionnel)
    setShowChapters?.(false);

    // Détection wallet injecté (Phantom / Solflare)
    const provider =
      (window.solana && window.solana.isPhantom && window.solana) ||
      (window.solflare && window.solflare.isSolflare && window.solflare) ||
      window.solana || null;

    if (!provider) {
      alert("Please use Phantom or Solflare in this browser to purchase this chapter.");
      return;
    }

    // Lance l’achat (version RESET) + enregistrement DB en arrière-plan
    await signOnDesktop(chapterId, {
      setUnlocked,
      setRewardToast,
      setPayUrl, // si présent dans ton état
    });

  } catch (e) {
    console.error("[unlock] error:", e);
    // message utilisateur
    setRewardToast?.(`Paiement: ${e?.message || e}`);
    setTimeout?.(() => setRewardToast?.(null), 2500);
  } finally {
    onUnlockChapter._busy = false;
  }
}






 


  /* ======= Vues ======= */

// 2) Chapitre verrouillé
if (!currentChapId || !canAccessChapter(currentChapId)) {
  return (
    <div className="screen" style={{ background: "#0d0d0f", color: "#fff" }}>
      <div className="hud" style={{ marginBottom: 16 }}>
        <div className="hud-left">
          <span>
            Wallet: <code>{publicKey?.toBase58().slice(0,4)}…{publicKey?.toBase58().slice(-4)}</code>
          </span>
          <span>
            {" "}TOMATO: {loadingBal ? "…" : (tomatoBalance ?? 0).toLocaleString(undefined,{ maximumFractionDigits: 6 })}
          </span>
        </div>
        <div className="hud-right">
          <label style={{ marginRight: 8 }}>🔊</label>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(Number(e.target.value))} />
          <button className="btn" onClick={reconnect} style={{ marginLeft: 8 }}>Reconnection</button>
        </div>
      </div>

      <div className="locked-wrap">
        <div className="locked-card">
    
         
          {(() => {
          const lockedImg = CHAPTER_LOCKED_IMAGES[currentChapId] || CHAPTER_LOCKED_IMAGES.default;
          return (
             <div className="locked-hero">

             <img src={lockedImg} alt={`Chapitre ${currentChapId || ""}`} />
             <div className="locked-veil">🔒 Locked chapter</div>
            </div>

            );
         })()}

          <h1>Locked chapter</h1>
          <p>
            Pay <b>100 000 TOMATO</b> to unlock this chapter.
          </p>

          {currentChapId && (
            <button className="btn" onClick={() => onUnlockChapter(currentChapId)}>
              Débloquer {currentChapId} (100 000 TOMATO)
            </button>
          )}

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setShowChapters(true)}>See chapters</button>
          </div>
        </div>
      </div>

      {/* Modal chapitres */}
      {showChapters && (
        <div className="modal">
          <div className="modal-body">
            <h3>Chapters</h3>
            <ul className="chapters">
              {(CHAPTERS || []).map(ch => (
                <li key={ch.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, alignItems:"center" }}>
                  <button
                    className="btn"
                    disabled={!canAccessChapter(ch.id)}
                    onClick={async ()=>{
                      setNodeId(ch.entry);
                      localStorage.setItem("node", ch.entry);
                      setShowChapters(false);
                      try { const t = await ensureToken(); await apiSaveCheckpoint(t, ch.entry); } catch {}
                    }}
                  >
                    {ch.title || ch.id} {!canAccessChapter(ch.id) && <span style={{ opacity:.6 }}> (locked)</span>}
                  </button>
                  {!canAccessChapter(ch.id) && (
                    <button className="btn" onClick={()=>onUnlockChapter(ch.id)}>
                      Unlock (100 000 TOMATO)
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div style={{ textAlign: "right" }}>
              <button className="btn" onClick={() => setShowChapters(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solana Pay (QR pour desktop / fallback mobile) */}
      {payUrl && (
        <div className="modal">
          <div className="modal-body" style={{ textAlign: "center" }}>
            <h3>Scan with your wallet</h3>
            <p>Open Phantom/Solflare and scan this QR to pay.</p>
            <div style={{ display:"flex", justifyContent:"center", marginTop: 8 }}>
              <QRCode value={payUrl} size={220} />
            </div>
            <div style={{ marginTop: 12 }}>
              <a className="btn" href={payUrl}>Open in the wallet</a>
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => setPayUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {rewardToast ? <div className="reward-toast">{rewardToast}</div> : null}
    </div>
  );
}

  // 3) Rendu du jeu (chapitre débloqué)
  return (
    <div className={`game node-${nodeId}`} onClick={advanceIfSingleChoice}>
        {chapterBanner && (
  <div className="chapter-banner" onClick={() => setChapterBanner(null)}>
    {chapterBanner}
  </div>
)}

<div className="hud">
  <div className="hud-left">
    <span>❤️ PV: {hp}/100</span>
    <div className="hp-bar">
      <div className="hp-fill" style={{ width: `${hp}%` }} />
    </div>

    <span>
      TOMATO: {loadingBal ? "…" : (tomatoBalance ?? 0).toLocaleString(undefined,{maximumFractionDigits:6})}
    </span>

<div className="heal-skill">
  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
    <span>✨ Healing Lv {healLevel}</span>
    <span>{healCur}/{healToNext} XP</span>
  </div>
  <div className="hp-bar" title={`XP vers prochain niveau`}>
    <div className="hp-fill" style={{ width: `${Math.round((healCur / healToNext) * 100)}%` }} />
  </div>
</div>



    <div className="inventory">
      {inventory.length === 0 ? (
        <span className="inv-empty">Inventory : —</span>
      ) : (
inventory.map(it => (
  <div key={it} className="inv-item">
    {it === "tomato"   && <img src={SPR.tomato} alt="Tomato" />}
    {it === "bag"     && <span className="inv-emoji" title="Bag">🎒</span>}
    {it === "coat"     && <span className="inv-emoji" title="Coat">🧥</span>}
    {it === "grimoire" && <span className="inv-emoji" title="Grimoire">📜</span>}
    {it === "bow" && <img src={SPR.bow} alt="Bow" />}
    <span className="inv-label">
      {it === "tomato" ? "Tomato" : it === "bag" ? "Bag" : it === "coat" ? "Coat" : it === "grimoire" ? "Grimoire" : it === "bow" ? "Bow" : it}
    </span>
  </div>
))


      )}
    </div>
  </div>

  <div className="hud-right">
    <label style={{ marginRight: 8 }}>🔊</label>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={volume}
      onChange={e => setVolume(Number(e.target.value))}
    />
    {CHAPTERS && (
      <button
        className="btn"
        onClick={() => setShowChapters(true)}
        style={{ marginLeft: 8 }}
      >
        Chapters
      </button>
    )}
    <button className="btn" onClick={reconnect} style={{ marginLeft: 8 }}>
      Reconnection
    </button>
  </div>
</div>





      <div className="background">
        <img src={BG[node.background] || BG.field} alt="background" />
      </div>

      <div className="characters">
        {(node.characters || []).map((id) => (
          <img key={id} src={SPR[id]} alt={id} className={`char ${id}`} />
        ))}
        {node.tomato && <img src={SPR.tomato} alt="tomato" className="tomato" />}
      </div>

      {Array.isArray(node.dialogues) && node.dialogues.length > 0 && (
        <DialogueBubbles
          dialogues={node.dialogues}
          onComplete={() => {}}
          defaultDurationMs={3500}
        />
      )}

<div className={`dialogue ${!hasNarration ? "no-narration" : ""}`}>
  {hasNarration && (
    <div className="dialogue-box">
      <div className="dialogue-speaker">Narration</div>
      <div className={`dialogue-text ${typing ? "typewriter" : ""}`}>
        {typedText}
      </div>
    </div>
  )}

  <div className="choices">
    {choices.map((c, i) => (
      <button key={i} onClick={() => choose(c)}>
        {c.hotkey}. {c.text}
      </button>
    ))}
  </div>
</div>



      {/* Modal chapitres */}
      {showChapters && (
        <div className="modal">
          <div className="modal-body">
            <h3>Aller à…</h3>
            <ul className="chapters">
              {(CHAPTERS || []).map(ch => (
                <li key={ch.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, alignItems:"center" }}>
                  <button className="btn"
                          disabled={!canAccessChapter(ch.id)}
                          onClick={async ()=>{
                            setNodeId(ch.entry);
                            localStorage.setItem("node", ch.entry);
                            setShowChapters(false);
                            try { const t = await ensureToken(); await apiSaveCheckpoint(t, ch.entry); } catch {}
                          }}>
                    {ch.title || ch.id} {!canAccessChapter(ch.id) && <span style={{ opacity:.6 }}> (verrouillé)</span>}
                  </button>
                  {!canAccessChapter(ch.id) && (
                    <button className="btn" onClick={()=>onUnlockChapter(ch.id)}>
                      Unlock (100 000 TOMATO)
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div style={{ textAlign: "right" }}>
              <button className="btn" onClick={() => setShowChapters(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solana Pay (QR pour desktop / fallback mobile) */}
      {payUrl && (
        <div className="modal">
          <div className="modal-body" style={{ textAlign: "center" }}>
            <h3>Scan with your wallet</h3>
            <p>Open Phantom/Solflare and scan this QR to pay.</p>
            <div style={{ display:"flex", justifyContent:"center", marginTop: 8 }}>
              <QRCode value={payUrl} size={220} />
            </div>
            <div style={{ marginTop: 12 }}>
              <a className="btn" href={payUrl}>Open in the wallet</a>
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => setPayUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {rewardToast && (<div className="reward-toast">{rewardToast}</div>)}
    </div>
  );
}
