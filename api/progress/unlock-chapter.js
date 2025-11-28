// api/progress/unlock-chapter.js
export const config = { runtime: "nodejs" };

import { requireAuth } from "../../lib/requireAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    requireAuth(req);
    const { chapterId } = req.body || {};
    const chapter = Number(chapterId);
    if (!Number.isInteger(chapter) || chapter <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid chapterId" });
    }

    // No-op : l’accès est déterminé par /api/player/unlocked (on-chain + DB)
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res
      .status(401)
      .json({ ok: false, error: e?.message || "Unauthorized" });
  }
}
