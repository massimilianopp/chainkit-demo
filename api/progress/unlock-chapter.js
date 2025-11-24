// api/progress/unlock-chapter.js
export const config = { runtime: "nodejs" };

import { requireAuth } from "../../lib/requireAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }
  try {
    requireAuth(req); // valide le JWT
    const { chapterId } = req.body || {};
    if (!chapterId) return res.status(400).json({ ok:false, error:"chapterId required" });

    // No-op: plus d’écriture DB. L’accès persiste on-chain via /api/player/unlocked
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(401).json({ ok:false, error: e?.message || "Unauthorized" });
  }
}
