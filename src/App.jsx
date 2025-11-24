import {
  initChainKit,
  readSplBalanceParsed,
  purchaseChapter,
  ensureToken,
  apiSaveCheckpoint,
  apiGetMe,
  apiGetUnlocked,
  claimReward,
  reconnect as chainReconnect,
} from "./chainkit";

// ============================================================================
//  Tomatocoin Game — Version SDK Propre
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { QRCodeCanvas as QRCode } from "qrcode.react";

import script from "./game/script.json";
import "./styles.css";
import DialogueBubbles from "./components/DialogueBubbles";
import OrientationGate from "./ui/orientation/OrientationGate";
import "./mobile-landscape.css";

function storageKey(base, pubkey) {
  const id = pubkey ? pubkey.toBase58() : "guest";
  return `${base}::${id}`;
}

const DEV_UNLOCK = import.meta.env.VITE_DEV_UNLOCK === "true";
const TOMATO_MINT = new PublicKey(
  "CdczQNrp2DZ9c89LSjCyRF6VmS4VtTCBkNSjXtpvmoon"
);

initChainKit({
  apiBase: "/api",
  primaryMint: TOMATO_MINT,
});

// ============================================================================
//  Assets
// ============================================================================

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
  pathsnow: "/assets/pathsnow.png",
  fortifiedcamp: "/assets/fortifiedcamp.png",
  campnight: "/assets/campnight.png",
  palisade: "/assets/palisade.png",
  campexit: "/assets/campexit.png",
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
  cart: "/assets/cart.png",
  tomatolacart: "/assets/tomatolacart.png",
  tomatolaincart: "/assets/tomatolaincart.png",
  cartnight: "/assets/cartnight.png",
  tentfire: "/assets/tentfire.png",
  escape: "/assets/escape.png",
  captive: "/assets/captive.png",
};

const SFX = {
  tomatoFound: "/audio/sfx_tomato_found.mp3",
  deerStruggle: "/audio/sfx_deer_struggle.mp3",
  fireLoop: "/audio/sfx_fire_loop.mp3",
  bearRoar: "/audio/sfx_bear_roar.mp3",
  whistle: "/audio/sfx_whistle.mp3",
  magicspells: "/audio/sfx_magic_spells.mp3",
  fire: "/audio/sfx_fire.mp3",
};

const SND = {
  bgm: "/audio/bgm.mp3",
  click: "/audio/click.mp3",
  next: "/audio/advance.mp3",
};

// ============================================================================
//  App
// ============================================================================

export default function App() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const sfxRefs = useRef({});
  const bgmRef = useRef(null);
  const clickRef = useRef(null);
  const nextRef = useRef(null);

  const [hp, setHp] = useState(100);
  const CHAPTERS = script.__chapters || null;

  const CHAPTER_LOCKED_IMAGES = {
    c2: BG.mountain,
    c3: BG.forest,
    default: BG.field,
  };

  useEffect(() => {
    if (connection) window.connection = connection;
  }, [connection]);

  // ========================================================================
  // unlocked chapters
  // ========================================================================
  const [unlocked, setUnlocked] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("unlockedChapters") || "[]");
      if (DEV_UNLOCK) {
        return Array.from(
          new Set([...(CHAPTERS || []).map((c) => c.id), ...u])
        );
      }
      return Array.from(new Set(["c1", ...u]));
    } catch {
      return DEV_UNLOCK ? (CHAPTERS || []).map((c) => c.id) : ["c1"];
    }
  });

  const [nodeId, setNodeId] = useState(() => {
    const saved = localStorage.getItem("node");
    if (saved) return saved;
    const ul = JSON.parse(localStorage.getItem("unlockedChapters") || "[]");
    const first = ul && ul.length ? ul[0] : "c1";
    const entry =
      CHAPTERS?.find((c) => c.id === first)?.entry ?? "c1_start";
    return entry;
  });

  // ========================================================================
  // Rewards (persistés localement)
  // ========================================================================
  const REWARDS_KEY = "claimedRewards_v1";
  const [claimedRewards, setClaimedRewards] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(REWARDS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  const isRewardClaimed = (key) => claimedRewards.has(key);

  const markRewardClaimed = (key) => {
    setClaimedRewards((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(REWARDS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const REWARD_EVENTS = {
    c2_temple_inside: { key: "reward_c2_temple_inside_v1", amount: 1000 },
  };

  async function maybeClaimRewardForNode(nodeId) {
    const cfg = REWARD_EVENTS[nodeId];
    if (!cfg) return;
    if (isRewardClaimed(cfg.key)) return;

    const out = await claimReward(cfg.key, cfg.amount);
    if (out?.ok) markRewardClaimed(cfg.key);
  }

  // ========================================================================
  // Wallet change => purge local
  // ========================================================================
  useEffect(() => {
    const current = publicKey?.toBase58() || "";
    const prev = localStorage.getItem("lastWallet") || "";

    if (!current) return;

    if (current !== prev) {
      localStorage.removeItem("unlockedChapters");
      localStorage.removeItem("node");
      localStorage.removeItem("jwt");
      localStorage.removeItem("claimedOnchainRewards_v1");
      localStorage.removeItem("inventory");

      setUnlocked([]);
      setHp(100);

      localStorage.setItem("lastWallet", current);
    }
  }, [publicKey]);

  // ========================================================================
  // UI / Scenes logic
  // ========================================================================
  const node = script[nodeId] || {};
  const currentChapId = (nodeId.match(/^(c\d+)_/) || [])[1] || null;

  const [showChapters, setShowChapters] = useState(false);
  const [tomatoBalance, setTomatoBalance] = useState(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [volume, setVolume] = useState(
    () => Number(localStorage.getItem("volume") || 0.6)
  );
  const [typedText, setTypedText] = useState("");
  const [typing, setTyping] = useState(true);
  const [rewardToast, setRewardToast] = useState(null);
  const [payUrl, setPayUrl] = useState(null);
  const [newItemBanner, setNewItemBanner] = useState(null);

  const addItemOnce = (item) =>
    setInventory((prev) => {
      if (prev.includes(item)) return prev;
      showNewItemBanner(item);
      return [...prev, item];
    });

  const showNewItemBanner = (itemName) => {
    setNewItemBanner(itemName);
    setTimeout(() => setNewItemBanner(null), 3000);
  };

  const [inventory, setInventory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("inventory") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("inventory", JSON.stringify(inventory));
  }, [inventory]);

  // ========================================================================
  // Audio
  // ========================================================================
  useEffect(() => {
    bgmRef.current = new Audio(SND.bgm);
    bgmRef.current.loop = true;
    bgmRef.current.volume = volume;

    clickRef.current = new Audio(SND.click);
    clickRef.current.volume = Math.min(1, volume + 0.1);

    nextRef.current = new Audio(SND.next);
    nextRef.current.volume = Math.min(1, volume + 0.05);

    const unlock = () => {
      bgmRef.current?.play().catch(() => {});
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

  useEffect(() => {
    localStorage.setItem(
      "volume",
      String(volume)
    );
    if (bgmRef.current) bgmRef.current.volume = volume;
    if (clickRef.current) clickRef.current.volume = Math.min(1, volume + 0.1);
    if (nextRef.current) nextRef.current.volume = Math.min(1, volume + 0.05);
  }, [volume]);

  useEffect(() => {
    Object.entries(SFX).forEach(([key, path]) => {
      const audio = new Audio(path);
      if (key === "fireLoop") audio.loop = true;
      audio.volume = volume;
      sfxRefs.current[key] = audio;
    });
  }, []);

  const playSfxAndPauseBgm = (key) => {
    const audio = sfxRefs.current[key];
    if (!audio) return;

    if (bgmRef.current) bgmRef.current.pause();

    try {
      audio.currentTime = 0;
      audio.play();
      audio.onended = () => {
        try {
          bgmRef.current?.play();
        } catch {}
      };
    } catch {}
  };

  useEffect(() => {
    const sfxKey = node.sfx;

    let hadLoop = false;
    Object.values(sfxRefs.current).forEach((audio) => {
      if (audio?.loop && !audio.paused) {
        audio.pause();
        hadLoop = true;
      }
    });

    if (hadLoop && bgmRef.current) {
      try {
        bgmRef.current.play();
      } catch {}
    }

    if (sfxKey) playSfxAndPauseBgm(sfxKey);
  }, [nodeId]);

  // ========================================================================
  // read balance
  // ========================================================================
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!publicKey) {
        setTomatoBalance(null);
        return;
      }
      setLoadingBal(true);

      const tomato = await readSplBalanceParsed(
        connection,
        publicKey,
        TOMATO_MINT
      );

      if (!stop) setTomatoBalance(tomato);
      setLoadingBal(false);
    })();
    return () => {
      stop = true;
    };
  }, [publicKey, connection]);

  // ========================================================================
  // init from backend
  // ========================================================================
  useEffect(() => {
    (async () => {
      try {
        const t = localStorage.getItem("jwt");
        if (!t) return;

        const me = await apiGetMe(t);
        if (me?.last_checkpoint && script[me.last_checkpoint]) {
          setNodeId(me.last_checkpoint);
          localStorage.setItem("node", me.last_checkpoint);
        }

        const ul = await apiGetUnlocked(t);
        if (Array.isArray(ul.unlocked) && ul.unlocked.length) {
          setUnlocked((prev) =>
            Array.from(new Set([...prev, ...ul.unlocked]))
          );

          if (!nodeId && ul.unlocked.length) {
            const entry =
              CHAPTERS?.find((c) => c.id === ul.unlocked[0])?.entry ??
              "c1_start";
            setNodeId(entry);
            localStorage.setItem("node", entry);
          }
        }
      } catch (e) {
        console.debug("init:", e?.message || e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========================================================================
  // typewriter
  // ========================================================================
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

  // ========================================================================
  // XP heal system (pas modifié, fonctionne très bien)
  // ========================================================================
  const LEVEL_STEP = 100;

  const [healXp, setHealXp] = useState(0);
  const [claimedHealXpNodes, setClaimedHealXpNodes] = useState(
    new Set()
  );

  useEffect(() => {
    const key = storageKey("healXp_v1", publicKey);
    const legacy = localStorage.getItem("healXp_v1");
    if (legacy !== null && localStorage.getItem(key) === null) {
      localStorage.setItem(key, legacy);
    }
    try {
      setHealXp(Number(localStorage.getItem(key) || 0));
    } catch {
      setHealXp(0);
    }
  }, [publicKey]);

  useEffect(() => {
    const key = storageKey("healXp_v1", publicKey);
    localStorage.setItem(key, String(healXp));
  }, [healXp, publicKey]);

  useEffect(() => {
    const key = storageKey("healXp_claimed_v1", publicKey);

    const legacy = localStorage.getItem("healXp_claimed_v1");
    if (legacy !== null && localStorage.getItem(key) === null) {
      localStorage.setItem(key, legacy);
    }

    try {
      const raw = localStorage.getItem(key);
      setClaimedHealXpNodes(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setClaimedHealXpNodes(new Set());
    }
  }, [publicKey]);

  useEffect(() => {
    const key = storageKey("healXp_claimed_v1", publicKey);
    localStorage.setItem(key, JSON.stringify([...claimedHealXpNodes]));
  }, [claimedHealXpNodes, publicKey]);

  const healLevel = Math.floor(healXp / LEVEL_STEP);
  const healCur = healXp % LEVEL_STEP;
  const healToNext = LEVEL_STEP;

  useEffect(() => {
    if (!nodeId) return;
    const n = script[nodeId];
    if (!n) return;

    if (n.randomEvent) return;

    if (Number.isFinite(n.healXp) && n.healXp !== 0) {
      if (claimedHealXpNodes.has(nodeId)) return;

      const delta = Math.trunc(n.healXp);
      setHealXp((prev) => {
        const before = Math.floor(prev / LEVEL_STEP);
        const next = Math.max(0, prev + delta);
        const after = Math.floor(next / LEVEL_STEP);

        if (after > before) {
          setRewardToast(`✨ Healing Lv ${after} atteint !`);
          setTimeout(() => setRewardToast(null), 1800);
        } else {
          setRewardToast(`${delta > 0 ? "+" : ""}${delta} XP guérison`);
          setTimeout(() => setRewardToast(null), 1200);
        }
        return next;
      });

      setClaimedHealXpNodes((prev) => {
        const s = new Set(prev);
        s.add(nodeId);
        return s;
      });
    }
  }, [nodeId, script, claimedHealXpNodes, LEVEL_STEP]);

  // ========================================================================
  // random events
  // ========================================================================
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

    if (lastRandomEventNodeRef.current === nodeId) return;
    lastRandomEventNodeRef.current = nodeId;

    let {
      successChance = 0.5,
      successNext,
      failNext,
      delayMs = 0,
    } = re;

    successChance = Math.max(
      0,
      Math.min(1, Number(successChance) || 0)
    );

    if (!successNext || !script[successNext]) return;
    if (!failNext || !script[failNext]) return;

    const t = setTimeout(() => {
      const roll = Math.random();
      const next = roll < successChance ? successNext : failNext;
      setNodeId(next);
      localStorage.setItem("node", next);
      (async () => {
        try {
          const tok = await ensureToken();
          await apiSaveCheckpoint(tok, next);
        } catch {}
      })();
    }, Math.max(0, Number(delayMs) || 0));

    return () => clearTimeout(t);
  }, [nodeId, script]);

  // ========================================================================
  // HP logic
  // ========================================================================
  useEffect(() => {
    if (nodeId === "c1_start") {
      setHp(100);
    }

    if (nodeId === "c2_bear") {
      setHp((prev) => Math.max(0, prev - 50));
    }
  }, [nodeId]);

  // ========================================================================
  // Choices & progression
  // ========================================================================
  const choices = useMemo(
    () =>
      (node.choices || []).map((c, idx) => ({
        ...c,
        hotkey: String(idx + 1),
      })),
    [node]
  );

  const canAccessChapter = (chapterId) =>
    chapterId === "c1" || unlocked.includes(chapterId);

  async function choose(c) {
    if (clickRef.current) {
      try {
        clickRef.current.currentTime = 0;
        await clickRef.current.play();
      } catch {}
    }

    setNodeId(c.next);
    localStorage.setItem("node", c.next);

    try {
      const t = await ensureToken();
      await apiSaveCheckpoint(t, c.next);
    } catch {}
  }

  const advanceIfSingleChoice = () => {
    if (!typing && choices.length === 1) {
      if (nextRef.current) {
        try {
          nextRef.current.currentTime = 0;
          nextRef.current.play();
        } catch {}
      }
      choose(choices[0]);
    } else if (typing) {
      setTypedText(node.text || "");
      setTyping(false);
    }
  };

  // ========================================================================
  // Unlock chapter via SDK
  // ========================================================================
  async function onUnlockChapter(chapterId) {
    if (!chapterId) return;
    if (onUnlockChapter._busy) return;
    onUnlockChapter._busy = true;

    try {
      setShowChapters(false);

      await purchaseChapter(chapterId, {
        setUnlocked,
        setToast: setRewardToast,
        setPayUrl,
      });

      const meta = CHAPTERS.find((c) => c.id === chapterId);
      const entry = meta?.entry || `${chapterId}_start`;
      goToChapter(entry);
    } catch (e) {
      console.error("[unlock] error:", e);
      setRewardToast(`Payment: ${e?.message || e}`);
      setTimeout(() => setRewardToast(null), 2500);
    } finally {
      onUnlockChapter._busy = false;
    }
  }

  function goToChapter(chapterId) {
    const meta = CHAPTERS.find((c) => c.id === chapterId);
    const entry = meta?.entry || `${chapterId}_start`;
    if (!entry || !script[entry]) return;

    setNodeId(entry);
    localStorage.setItem("node", entry);

    (async () => {
      try {
        const t = await ensureToken();
        await apiSaveCheckpoint(t, entry);
      } catch {}
    })();
    setShowChapters(false);
  }

  // ========================================================================
  // Chapter banners
  // ========================================================================
  const [chapterBanner, setChapterBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  useEffect(() => {
    if (!nodeId || !CHAPTERS) return;

    const chap = (nodeId.match(/^(c\d+)_/) || [])[1];
    if (!chap) return;

    const meta = CHAPTERS.find((c) => c.id === chap);
    const entry = meta?.entry || null;

    if (entry && nodeId === entry) {
      const title = meta?.title || chap.toUpperCase();
      const text = `📜 ${title} — Beginning of the chapter`;
      setChapterBanner(text);

      if (bannerTimerRef.current)
        clearTimeout(bannerTimerRef.current);

      bannerTimerRef.current = setTimeout(
        () => setChapterBanner(null),
        3000
      );
    }

    return () => {
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    };
  }, [nodeId, CHAPTERS]);

  // ========================================================================
  // Render
  // ========================================================================

  // 2) locked chapter
  if (!currentChapId || !canAccessChapter(currentChapId)) {
    return (
      <OrientationGate>
        <div className="screen" style={{ background: "#0d0d0f", color: "#fff" }}>
          <div className="hud" style={{ marginBottom: 16 }}>
            <div className="hud-left">
              <span>
                Wallet:{" "}
                <code>
                  {publicKey?.toBase58().slice(0, 4)}…
                  {publicKey?.toBase58().slice(-4)}
                </code>
              </span>
              <span>
                {" "}
                TOMATO:{" "}
                {loadingBal
                  ? "…"
                  : (tomatoBalance ?? 0).toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
              </span>
            </div>
            <div className="hud-right">
              <div className="buttons-col">
                <button className="btn" onClick={chainReconnect}>
                  Reconnection
                </button>
              </div>
              <div className="volume-mini">
                <span aria-hidden="true">🔊</span>
                <input
                  className="mini"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="locked-wrap">
            <div className="locked-card">
              <div className="locked-hero">
                <img
                  src={
                    CHAPTER_LOCKED_IMAGES[currentChapId] ||
                    CHAPTER_LOCKED_IMAGES.default
                  }
                  alt={`Chapitre ${currentChapId || ""}`}
                />
                <div className="locked-veil">🔒 Locked chapter</div>
              </div>

              <h1>Locked chapter</h1>
              <p>
                Pay <b>100 000 TOMATO</b> to unlock this chapter.
              </p>

              {currentChapId && (
                <button
                  className="btn"
                  onClick={() => onUnlockChapter(currentChapId)}
                >
                  Débloquer {currentChapId} (100 000 TOMATO)
                </button>
              )}

              <div style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={() => setShowChapters(true)}
                >
                  See chapters
                </button>
              </div>
            </div>
          </div>

          {/* Chapters modal */}
          {showChapters && (
            <div className="modal">
              <div className="modal-body">
                <h3>Chapters</h3>
                <ul className="chapters">
                  {(CHAPTERS || []).map((ch) => (
                    <li
                      key={ch.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <button
                        className="btn"
                        disabled={!canAccessChapter(ch.id)}
                        onClick={async () => {
                          goToChapter(ch.id);
                        }}
                      >
                        {ch.title || ch.id}{" "}
                        {!canAccessChapter(ch.id) && (
                          <span style={{ opacity: 0.6 }}> (locked)</span>
                        )}
                      </button>
                      {!canAccessChapter(ch.id) && (
                        <button
                          className="btn"
                          onClick={() => onUnlockChapter(ch.id)}
                        >
                          Unlock (100 000 TOMATO)
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <div style={{ textAlign: "right" }}>
                  <button
                    className="btn"
                    onClick={() => setShowChapters(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Solana Pay QR */}
          {payUrl && (
            <div className="modal">
              <div className="modal-body" style={{ textAlign: "center" }}>
                <h3>Scan with your wallet</h3>
                <p>Open Phantom/Solflare and scan this QR to pay.</p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 8,
                  }}
                >
                  <QRCode value={payUrl} size={220} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <a className="btn" href={payUrl}>
                    Open in the wallet
                  </a>
                  <button
                    className="btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => setPayUrl(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {rewardToast && (
            <div className="reward-toast">{rewardToast}</div>
          )}
        </div>
      </OrientationGate>
    );
  }

  // ========================================================================
  // Render "game"
  // ========================================================================
  return (
    <OrientationGate>
      <div
        className={`game node-${nodeId}`}
        onClick={advanceIfSingleChoice}
      >
        {chapterBanner && (
          <div
            className="chapter-banner"
            onClick={() => setChapterBanner(null)}
          >
            {chapterBanner}
          </div>
        )}

        {/* HUD left */}
        <div className="hud-leftbox">
          <div className="stat-block">
            <span>❤️ PV: {hp}/100</span>
            <div className="hp-bar sm">
              <div
                className="hp-fill"
                style={{ width: `${hp}%` }}
              />
            </div>
          </div>

          <div className="stat-block">
            <span>
              🍅 TOMATO:{" "}
              {loadingBal
                ? "…"
                : (tomatoBalance ?? 0).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
            </span>
          </div>

          <div className="stat-block">
            <div className="heal-header">
              <span>✨ Healing Lv {healLevel}</span>
              <span>
                {healCur}/{healToNext} XP
              </span>
            </div>
            <div className="xp-bar sm">
              <div
                className="xp-fill"
                style={{
                  width: `${Math.round(
                    (healCur / healToNext) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="inventory mini">
            {inventory.length === 0 ? (
              <span className="inv-empty">Inventory : —</span>
            ) : (
              inventory.map((it) => (
                <div key={it} className="inv-item">
                  {it === "tomato" && (
                    <img src={SPR.tomato} alt="Tomato" />
                  )}
                  {it === "bag" && (
                    <span className="inv-emoji" title="Bag">
                      🎒
                    </span>
                  )}
                  {it === "coat" && (
                    <span className="inv-emoji" title="Coat">
                      🧥
                    </span>
                  )}
                  {it === "grimoire" && (
                    <span className="inv-emoji" title="Grimoire">
                      📜
                    </span>
                  )}
                  {it === "bow" && (
                    <img src={SPR.bow} alt="Bow" />
                  )}
                  <span className="inv-label">
                    {it === "tomato"
                      ? "Tomato"
                      : it.charAt(0).toUpperCase() + it.slice(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* New item banner */}
        {newItemBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
            🍅 Nouvel objet : <b>{newItemBanner}</b> ajouté !
          </div>
        )}

        {/* HUD right */}
        <div className="hud-right-panel">
          <div className="buttons-col">
            {CHAPTERS && (
              <button
                className="btn"
                onClick={() => setShowChapters(true)}
              >
                Chapters
              </button>
            )}
            <button className="btn" onClick={chainReconnect}>
              Reconnection
            </button>
          </div>

          <div className="volume-mini">
            <span aria-hidden="true">🔊</span>
            <input
              className="mini"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Background */}
        <div className="background">
          <img
            src={BG[node.background] || BG.field}
            alt="background"
          />
        </div>

        {/* Characters */}
        <div className="characters">
          {(node.characters || []).map((id) => (
            <img
              key={id}
              src={SPR[id]}
              alt={id}
              className={`char ${id}`}
            />
          ))}
          {node.tomato && (
            <img
              src={SPR.tomato}
              alt="tomato"
              className="tomato"
            />
          )}
        </div>

        {/* Dialogue bubbles */}
        {Array.isArray(node.dialogues) &&
          node.dialogues.length > 0 && (
            <DialogueBubbles
              dialogues={node.dialogues}
              onComplete={() => {}}
              defaultDurationMs={3500}
            />
          )}

        {/* Narration + choices */}
        <div
          className={`dialogue ${
            !node.text?.trim() ? "no-narration" : ""
          }`}
        >
          {node.text?.trim() && (
            <div className="dialogue-box">
              <div className="dialogue-speaker">Narration</div>
              <div
                className={`dialogue-text ${
                  typing ? "typewriter" : ""
                }`}
              >
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

        {/* Chapters modal */}
        {showChapters && (
          <div className="modal">
            <div className="modal-body">
              <h3>Aller à…</h3>
              <ul className="chapters">
                {(CHAPTERS || []).map((ch) => (
                  <li
                    key={ch.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="btn"
                      disabled={!canAccessChapter(ch.id)}
                      onClick={() => goToChapter(ch.id)}
                    >
                      {ch.title || ch.id}{" "}
                      {!canAccessChapter(ch.id) && (
                        <span style={{ opacity: 0.6 }}>
                          {" "}
                          (verrouillé)
                        </span>
                      )}
                    </button>
                    {!canAccessChapter(ch.id) && (
                      <button
                        className="btn"
                        onClick={() => onUnlockChapter(ch.id)}
                      >
                        Unlock (100 000 TOMATO)
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div style={{ textAlign: "right" }}>
                <button
                  className="btn"
                  onClick={() => setShowChapters(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Solana Pay QR */}
        {payUrl && (
          <div className="modal">
            <div className="modal-body" style={{ textAlign: "center" }}>
              <h3>Scan with your wallet</h3>
              <p>Open Phantom/Solflare and scan this QR to pay.</p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 8,
                }}
              >
                <QRCode value={payUrl} size={220} />
              </div>
              <div style={{ marginTop: 12 }}>
                <a className="btn" href={payUrl}>
                  Open in the wallet
                </a>
                <button
                  className="btn"
                  style={{ marginLeft: 8 }}
                  onClick={() => setPayUrl(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {rewardToast && (
          <div className="reward-toast">{rewardToast}</div>
        )}
      </div>
    </OrientationGate>
  );
}
