// src/game/anchors.js
// Pour chaque sprite composite, indique des points d'ancrage (en % du rect du sprite)
// 0 = bord gauche/haut, 1 = bord droit/bas.
export const SPRITE_ANCHORS = {
  familyatthetable: {
    Pere:     { xPct: 0.99, yPct: 0.22 },
    Tomatola: { xPct: 0.75, yPct: 0.20 },
    Mere:     { xPct: 0.40, yPct: 0.20 },
    Frere:    { xPct: 0.45, yPct: 0.35 },
  },
  tomatolaandfathertomato: {
    Pere:     { xPct: 1.1, yPct: 0.5 },
    Tomatola: { xPct: 0.1, yPct: 0.3 },
  },

   tomatolatraveler: {
    Tomatola:     { xPct: 0.01, yPct: 0.4 },
    Traveler: { xPct: 1.7, yPct: 0.4 },
   },    

   wolftomatolateacher: {
    Tomatola:     { xPct: 0.2, yPct: 0.4 },
    Teacher: { xPct: 1, yPct: 0.5 },
   },   

   tomatolateacher: {
    Tomatola:     { xPct: 0.3, yPct: 0.4 },
    Teacher: { xPct: 0.9, yPct: 0.4 },
   },     
    

};
