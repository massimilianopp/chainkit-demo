// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import script from "./game/script.json";
import "./styles.css";
import DialogueBubbles from "./components/DialogueBubbles";

/* --- Mints (mainnet) --- */
const TOMATO_MINT = new PublicKey("CdczQNrp2DZ9c89LSjCyRF6VmS4VtTCBkNSjXtpvmoon");

/* --- Seuils de gating --- */
const TOMATO_THRESHOLD = 100000;       // accès au jeu
const TOMATO_REQUIRED_FOR_C2 = 200000; // déblocage Chapitre 2

/* --- Assets --- */
const BG = {
  field: "/assets/field.png",
  forest: "/assets/forest.png",
  house: "/assets/house.png",
  houseinside: "/assets/houseinside.png",
  // Chapitre 2 (ajoute les fichiers si besoin)
  path: "/assets/path.png",
  city: "/assets/city.png",
  mountain: "/assets/mountain.png",
  market: "/assets/market.png",
  temple: "/assets/temple.png",
  diningroom: "/assets/diningroom.png",
  forestentry: "/assets/forestentry.png",
  clearing: "/assets/clearing.png",
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
};

/* Audio (mets les 3 fichiers dans /public/audio/) */
const SND = {
  bgm: "/audio/bgm.mp3",
  click: "/audio/click.mp3",
  next: "/audio/advance.mp3",
};

/* --- Lecture SPL via parsed accounts --- */
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
        total += Number(info.tokenAmount?.uiAmount || 0); // unités humaines
      }
    }
    return total;
  } catch (e) {
    console.warn("readSplBalanceParsed error:", e?.message || e);
    return 0;
  }
}

export default function App() {
  /* ---------- Chapitres ---------- */
  const CHAPTERS = script.__chapters || null;

  const [unlocked, setUnlocked] = useState(() => {
    try { return JSON.parse(localStorage.getItem("unlockedChapters") || '["c1"]'); }
    catch { return ["c1"]; }
  });
  const [showChapters, setShowChapters] = useState(false);

  /* ---------- Wallet / RPC ---------- */
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  /* Soldes on-chain */
  const [usdcBalance, setUsdcBalance] = useState(null);
  const [tomatoBalance, setTomatoBalance] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);

  /* ---------- Rewards UI ---------- */
  const [rewardToast, setRewardToast] = useState(null);

  /* ---------- Jeu ---------- */

  const [credits, setCredits] = useState(() =>
    Number(localStorage.getItem("credits") ?? 0)
  );

const CLAIMED_KEY = "claimedRewards_v2"; // <-- nouvelle clé

const [claimedRewards, setClaimedRewards] = useState(() => {
  try {
    // migration simple: si ancienne clé existe, on l'ignore (reset propre)
    return new Set(JSON.parse(localStorage.getItem(CLAIMED_KEY) || "[]"));
  } catch {
    return new Set();
  }
});



    
  const [nodeId, setNodeId] = useState(() => {
    const saved = localStorage.getItem("node");
    if (saved) return saved;
    if (CHAPTERS?.length) return CHAPTERS[0].entry; // ex: c1_start
    return "c1_start";
  });

  // Fallback sûr si un nodeId invalide traîne en localStorage
  const safeEntry =
    CHAPTERS?.find((c) => c.id === ((nodeId.match(/^(c\d+)_/) || [])[1] || CHAPTERS?.[0]?.id))?.entry ||
    CHAPTERS?.[0]?.entry ||
    "c1_start";

  const node = script[nodeId] || script[safeEntry];

  // Quel chapitre joue-t-on ?
  const currentChapId =
    (nodeId.match(/^(c\d+)_/) || [])[1] || (CHAPTERS?.[0]?.id ?? "c1");
  const currentChapter = CHAPTERS?.find((c) => c.id === currentChapId);

  /* ---------- Typewriter ---------- */
  const [typedText, setTypedText] = useState("");
  const [typing, setTyping] = useState(true);

  /* ---------- Audio & volume ---------- */
  const [volume, setVolume] = useState(() =>
    Number(localStorage.getItem("volume") || 0.6)
  );
  const bgmRef = useRef(null);
  const clickRef = useRef(null);
  const nextRef = useRef(null);

  /* ---------- Persist ---------- */


  useEffect(() => {
    localStorage.setItem("unlockedChapters", JSON.stringify(unlocked));
  }, [unlocked]);

  useEffect(() => {
    localStorage.setItem("volume", String(volume));
    if (bgmRef.current) bgmRef.current.volume = volume;
    if (clickRef.current) clickRef.current.volume = Math.min(1, volume + 0.1);
    if (nextRef.current) nextRef.current.volume = Math.min(1, volume + 0.05);
  }, [volume]);

  /* ---------- Init audio ---------- */
  useEffect(() => {
    bgmRef.current = new Audio(SND.bgm);
    bgmRef.current.loop = true;
    bgmRef.current.volume = volume;

    clickRef.current = new Audio(SND.click);
    clickRef.current.volume = Math.min(1, volume + 0.1);

    nextRef.current = new Audio(SND.next);
    nextRef.current.volume = Math.min(1, volume + 0.05);

    // Débloque autoplay après première interaction
    const unlock = () => {
      if (bgmRef.current && bgmRef.current.paused) {
        bgmRef.current.play().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      bgmRef.current?.pause();
    };
  }, []);

  /* ---------- Charger soldes quand le wallet change ---------- */
useEffect(() => {
  let abort = false;
  (async () => {
    if (!publicKey) {
      setTomatoBalance(null);
      return;
    }
    setLoadingBal(true);
    const tomato = await readSplBalanceParsed(connection, publicKey, TOMATO_MINT);
    if (!abort) {
      setTomatoBalance(tomato);
    }
    setLoadingBal(false);
  })();
  return () => { abort = true; };
}, [publicKey, connection]);

  /* ---------- Typewriter à chaque node ---------- */
  useEffect(() => {
    const full = node.text || "";
    setTypedText("");
    setTyping(true);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTypedText(full.slice(0, i));
      if (i >= full.length) {
        setTyping(false);
        clearInterval(id);
      }
    }, Math.max(12, 900 / Math.max(10, full.length)));
    return () => clearInterval(id);
  }, [nodeId, node.text]);

  /* ---------- Rewards : appliquer à l'arrivée sur un nœud ---------- */
  useEffect(() => {
    if (node && node.reward) {
      applyReward(nodeId, node.reward);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  /* ---------- Persistance crédits ---------- */
  useEffect(() => {
    localStorage.setItem("credits", String(credits));
  }, [credits]);

  /* ---------- Choix ---------- */
  const choices = useMemo(
    () => (node.choices || []).map((c, idx) => ({ ...c, hotkey: String(idx + 1) })),
    [node]
  );

  function choose(c) {
    // SFX click
    if (clickRef.current) {
      clickRef.current.currentTime = 0;
      clickRef.current.play().catch(() => {});
    }


    // Déverrouillage auto du chapitre suivant si on atteint un "end"
    if (CHAPTERS && c.next) {
      const finished = CHAPTERS.find((ch) => (ch.ends || []).includes(c.next));
      if (finished) {
        const idx = CHAPTERS.findIndex((x) => x.id === finished.id);
        const nextChapter = CHAPTERS[idx + 1];
        if (nextChapter && !unlocked.includes(nextChapter.id)) {
          if (nextChapter.id === "c2") {
            // gating spécial C2 (200k TOMATO)
            if ((tomatoBalance ?? 0) >= TOMATO_REQUIRED_FOR_C2) {
              setUnlocked((u) => [...u, nextChapter.id]);
            }
          } else {
            setUnlocked((u) => [...u, nextChapter.id]);
          }
        }
      }
    }

    setNodeId(c.next);
  }

  function advanceIfSingleChoice() {
    if (!typing && choices.length === 1) {
      if (nextRef.current) {
        nextRef.current.currentTime = 0;
        nextRef.current.play().catch(() => {});
      }
      choose(choices[0]);
    } else if (typing) {
      setTypedText(node.text || "");
      setTyping(false);
    }
  }

  /* ---------- Accès global au jeu ---------- */
  const hasAccess = Number.isFinite(tomatoBalance) && tomatoBalance >= TOMATO_THRESHOLD;


  /* ---------- Sélecteur chapitres ---------- */
  const canAccessChapter = (chapterId) => {
    if (chapterId === "c2") {
      return unlocked.includes("c2") || (tomatoBalance ?? 0) >= TOMATO_REQUIRED_FOR_C2;
    }
    return unlocked.includes(chapterId) || chapterId === "c1";
  };

  /* ---------- Écrans pré-conditions ---------- */
  if (!publicKey) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#fff", background: "#111", height: "100vh" }}>
        <h1>🔒 Connecte ton wallet</h1>
        <p>Connecte ton wallet Solana (Mainnet) pour jouer.</p>
      </div>
    );
  }
  if (!hasAccess) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#fff", background: "#111", height: "100vh" }}>
        <h1>🍅 Solde TOMATO insuffisant</h1>
        <p>Il faut au moins <b>{TOMATO_THRESHOLD.toLocaleString()} TOMATO</b> pour commencer.</p>
        <p style={{ marginTop: 10 }}>
          TOMATO : {loadingBal ? "…" : (tomatoBalance ?? 0).toLocaleString(undefined,{maximumFractionDigits:6})}
        </p>
     
        <button
         onClick={async ()=>{
  setLoadingBal(true);
  const tomato = await readSplBalanceParsed(connection, publicKey, TOMATO_MINT);
  setTomatoBalance(tomato);
  setLoadingBal(false);
}}

          style={{ marginTop: 14 }}
        >
          {loadingBal ? "Vérification…" : "Rafraîchir le solde"}
        </button>
        <div style={{ marginTop: 16 }}>
          <label style={{ marginRight: 8, opacity:.8 }}>Volume</label>
          <input
            className="vol"
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={(e)=>setVolume(Number(e.target.value))}
            style={{ verticalAlign:"middle" }}
          />
        </div>
        <p style={{opacity:.6, marginTop:10}}>
          Astuce: un clic n’importe où lance la musique si bloquée par le navigateur.
        </p>
      </div>
    );
  }

  /* ---------- Rewards: crédits uniquement (UNE SEULE DÉFINITION) ---------- */
  function applyReward(nodeKey, reward) {
    if (!reward || !nodeKey) return;
    if (claimedRewards.has(nodeKey)) return; // déjà pris

    if (typeof reward.credits === "number") {
      setCredits(prev => prev + reward.credits);
      setRewardToast(`+${reward.credits} Crédits`);
    }

    setClaimedRewards(prev => {
      const next = new Set(prev);
      next.add(nodeKey);
      localStorage.setItem(CLAIMED_KEY, JSON.stringify([...next]));
      return next;
    });

    setTimeout(() => setRewardToast(null), 2500);
  }

  /* ---------- Jeu ---------- */
  return (
    <div className={`game node-${nodeId}`}>
      {/* Fond */}
      <div className="background">
        <img src={BG[node.background] || BG.field} alt="background" />
      </div>

      {/* Personnages */}
      <div className="characters">
        {(node.characters || []).map((id) => (
          <img key={id} src={SPR[id]} alt={id} className={`char ${id}`} />
        ))}
        {node.tomato && <img src={SPR.tomato} alt="tomato" className="tomato" />}
      </div>

      {/* Bulles BD */}
      {Array.isArray(node.dialogues) && node.dialogues.length > 0 && (
        <DialogueBubbles
          dialogues={node.dialogues}
          onComplete={() => {}}
          defaultDurationMs={3500}
        />
      )}

      {/* Toast Reward */}
      {rewardToast && (
        <div className="reward-toast">{rewardToast}</div>
      )}

      {/* HUD */}
      <div className="hud" style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ opacity:.8 }}>Volume</span>
        <input
          className="vol"
          type="range" min="0" max="1" step="0.01"
          value={volume}
          onChange={(e)=>setVolume(Number(e.target.value))}
        />
        <span>Crédits : {credits}</span>
        {CHAPTERS && (
          <>
            <span>{currentChapter ? currentChapter.title : currentChapId}</span>
            <button onClick={() => setShowChapters(true)}>Chapitres</button>
          </>
        )}
      </div>

      {/* Wallet, sous la HUD */}
      <div className="wallet-panel">
        {publicKey ? (
          <>
            <span>Wallet : {publicKey.toBase58().slice(0,4)}…{publicKey.toBase58().slice(-4)}</span>
            <span>TOMATO : {loadingBal ? "…" : (tomatoBalance ?? 0).toLocaleString(undefined,{maximumFractionDigits:6})}</span>
           
            <button onClick={async ()=>{ /* logique refresh */ }}>
              Rafraîchir
            </button>
          </>
        ) : (
          // Ton bouton / composant de connexion habituel
          <ConnectButton />
        )}
      </div>

      {/* Dialogue & choix — narration TOUJOURS visible */}
      <div className="dialogue" onClick={advanceIfSingleChoice}>
        <div className="dialogue-box">
          <div className="dialogue-speaker">Narration</div>
          <div className={`dialogue-text ${typing ? "typewriter" : ""}`}>
            {typedText}
          </div>
        </div>

        <div className="choices">
          {choices.map((c, i) => (
            <button key={i} onClick={() => {
              if (nextRef.current) {
                nextRef.current.currentTime = 0;
                nextRef.current.play().catch(() => {});
              }
              choose(c);
            }}>
              {c.hotkey}. {c.text}
              {typeof c.energy === "number" && c.energy !== 0
                ? ` (${c.energy > 0 ? "+" : ""}${c.energy} ⚡)` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* NOTE: bloc de choix dupliqué supprimé */}
    </div>
  );
}
