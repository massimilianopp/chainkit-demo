// src/game/anchors.js
// Pour chaque sprite composite, indique des points d'ancrage (en % du rect du sprite)
// 0 = bord gauche/haut, 1 = bord droit/bas.
export const SPRITE_ANCHORS = {
  familyatthetable: {
    Pere:     { xPct: 0.99, yPct: 0.22 },
    Tomatola: { xPct: 0.75, yPct: 0.30 },
    Mere:     { xPct: 0.40, yPct: 0.20 },
    Frere:    { xPct: 0.45, yPct: 0.35 },
  },
  tomatolaandfathertomato: {
    Pere:     { xPct: 0.99, yPct: 0.22 },
    Tomatola: { xPct: 0.75, yPct: 0.30 },
  },


};
