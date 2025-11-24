// ui/orientation/OrientationGate.jsx
// Orientation gate + 16:9 scaling wrapper for mobile landscape.
// Usage: wrap your app's main JSX with <OrientationGate>...</OrientationGate>

import React, { useEffect, useMemo, useState } from "react";

const isClient = typeof window !== "undefined";
const isMobileUA = () =>
  isClient && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function useIsPortrait() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    if (!isClient || !window.matchMedia) return;
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(!!mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return portrait;
}

function RotateOverlay({ onRequestStart }) {
  return (
    <div className="rotate-overlay">
      <div className="rotate-card">
        <div className="rotate-emoji">🔁</div>
        <h2 className="rotate-title">Tourne ton appareil</h2>
        <p className="rotate-sub">Le jeu est optimisé pour le mode paysage.</p>
        <button className="rotate-btn" onClick={onRequestStart}>Continuer</button>
      </div>
    </div>
  );
}

export default function OrientationGate({ children }) {
  const isPortrait = useIsPortrait();
  const [ready, setReady] = useState(false);

  const requestLandscape = async () => {
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    try { await window.screen?.orientation?.lock?.("landscape"); } catch {}
    setReady(true);
  };

  const mustBlock = useMemo(() => isMobileUA() && isPortrait, [isPortrait]);
  if (mustBlock && !ready) return <RotateOverlay onRequestStart={requestLandscape} />;

  return (
    <div className="game-safe">
      <div className="game-stage">
        {children}
      </div>
    </div>
  );
}