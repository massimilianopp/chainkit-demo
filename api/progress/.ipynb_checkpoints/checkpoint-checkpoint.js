// api/progress/checkpoint.js
export const config = { runtime: "nodejs" };

import { requireAuth } from "../../lib/requireAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    requireAuth(req);
    // No-op : l'état long terme reste reconstruit via l’historique on-chain
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res
      .status(401)
      .json({ ok: false, error: e?.message || "Unauthorized" });
  }
}
