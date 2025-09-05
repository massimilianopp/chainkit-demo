import { useLayoutEffect, useRef, useState } from "react";

/**
 * Calcule une position absolue (dans containerRef) “collée” à un sprite ciblé.
 * - targetSelector: sélecteur CSS de l’<img> du sprite (ex ".char.familyatthetable")
 * - containerRef: ref du conteneur positionné (relative) qui englobe la scène
 * - anchorPct: {xPct, yPct} optionnel pour cibler une tête précise dans une image composite
 * - placement/offset/follow: réglages généraux
 */
export function useAnchoredPosition({
  targetSelector,
  containerRef,
  placement = "top",
  offset = { x: 0, y: -12 },
  follow = true,
  anchorPct = null,
}) {
  const [pos, setPos] = useState({ left: 0, top: 0, visible: false });
  const rafRef = useRef(null);
  const roRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const getTarget = () =>
      container.querySelector(targetSelector) || document.querySelector(targetSelector);

    const compute = () => {
      const target = getTarget();
      if (!target) { setPos((p) => ({ ...p, visible: false })); return; }

      const tr = target.getBoundingClientRect();
      const cr = container.getBoundingClientRect();

      let anchorX = tr.left + tr.width / 2;
      let anchorY = tr.top;

      if (anchorPct && typeof anchorPct.xPct === "number" && typeof anchorPct.yPct === "number") {
        anchorX = tr.left + tr.width  * anchorPct.xPct;
        anchorY = tr.top  + tr.height * anchorPct.yPct;
      } else {
        if (placement === "bottom")       anchorY = tr.bottom;
        if (placement === "left")  { anchorX = tr.left;  anchorY = tr.top + tr.height/2; }
        if (placement === "right") { anchorX = tr.right; anchorY = tr.top + tr.height/2; }
        if (placement === "top-left")     { anchorX = tr.left;  anchorY = tr.top; }
        if (placement === "top-right")    { anchorX = tr.right; anchorY = tr.top; }
        if (placement === "bottom-left")  { anchorX = tr.left;  anchorY = tr.bottom; }
        if (placement === "bottom-right") { anchorX = tr.right; anchorY = tr.bottom; }
      }

      const left = anchorX - cr.left + (offset.x || 0);
      const top  = anchorY - cr.top  + (offset.y || 0);

      setPos({ left, top, visible: true });
    };

    compute();

    const onEvt = () => compute();
    window.addEventListener("scroll", onEvt, true);
    window.addEventListener("resize", onEvt);

    if ("ResizeObserver" in window) {
      roRef.current = new ResizeObserver(compute);
      roRef.current.observe(container);
    }

    if (follow) {
      const loop = () => { compute(); rafRef.current = requestAnimationFrame(loop); };
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener("scroll", onEvt, true);
      window.removeEventListener("resize", onEvt);
      if (roRef.current) roRef.current.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetSelector, containerRef, placement, offset?.x, offset?.y, follow, anchorPct?.xPct, anchorPct?.yPct]);

  return pos; // { left, top, visible }
}
