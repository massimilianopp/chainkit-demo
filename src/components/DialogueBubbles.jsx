import { useEffect, useMemo, useRef, useState } from "react";
import { useAnchoredPosition } from "../hooks/useAnchoredPosition";
import { SPRITE_ANCHORS } from "../game/anchors";

/**
 * dialogues: [{ speaker, char, actor?, text, placement?, durationMs? }]
 * - char   = id du sprite dans SPR (=> classe .char.<char>)
 * - actor  = sous-personnage à viser dans une image composite (clé de SPRITE_ANCHORS[char])
 */
export default function DialogueBubbles({ dialogues = [], onComplete, defaultDurationMs = 3500 }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);

  const d = dialogues[idx] || null;

  const targetSelector = useMemo(() => {
    return d?.char ? `.char.${d.char}` : `.characters .char`;
  }, [d]);

  const anchorPct = useMemo(() => {
    if (!d?.char || !d?.actor) return null;
    const map = SPRITE_ANCHORS[d.char];
    return map ? map[d.actor] || null : null;
  }, [d]);

  const pos = useAnchoredPosition({
    targetSelector,
    containerRef,
    placement: d?.placement || "top",
    offset: { x: 0, y: -16 },
    follow: true,
    anchorPct,
  });

  // auto-advance
  useEffect(() => {
    if (!d) { onComplete?.(); return; }
    if (paused) return;
    const dur = d.durationMs ?? defaultDurationMs;
    const t = setTimeout(() => setIdx((i) => Math.min(i + 1, dialogues.length)), dur);
    return () => clearTimeout(t);
  }, [d, paused, dialogues.length, defaultDurationMs, onComplete]);

  // raccourcis
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setIdx((i) => Math.min(i+1, dialogues.length)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setIdx((i) => Math.max(i-1, 0)); }
      if (e.key.toLowerCase() === "p") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogues.length]);

  if (!dialogues.length || !d) return null;

  const tailClass =
    d?.placement?.startsWith("top") ? "tail-bottom" :
    d?.placement?.startsWith("bottom") ? "tail-top" :
    d?.placement === "left" ? "tail-right" : "tail-left";

  const transform =
    d?.placement?.includes("bottom") ? "translate(-50%, 0%)" :
    d?.placement === "left" ? "translate(-100%, -50%)" :
    d?.placement === "right" ? "translate(0%, -50%)" :
    "translate(-50%, -100%)";

  return (
    <div
      ref={containerRef}
      className="bubble-container"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {pos.visible && (
        <div
          className={`bubble-anchored ${tailClass}`}
          style={{ position: "absolute", left: pos.left, top: pos.top, transform, maxWidth: 420 }}
        >
          <div className="bubble-inner">
            <div className="bubble-speaker">{d.speaker}</div>
            <div className="bubble-text">{d.text}</div>
            <div className="bubble-meta">
              <span>{idx + 1}/{dialogues.length}</span>
              <button className="bubble-btn" onClick={() => setIdx((i) => Math.max(i-1, 0))} disabled={idx === 0}>←</button>
              <button className="bubble-btn" onClick={() => setIdx((i) => Math.min(i+1, dialogues.length))}>
                {idx < dialogues.length - 1 ? "→" : "✓"}
              </button>
              <button className="bubble-btn" onClick={() => setPaused((p) => !p)}>{paused ? "▶" : "⏸"}</button>
            </div>
            <div className="bubble-tail" />
          </div>
        </div>
      )}
    </div>
  );
}
