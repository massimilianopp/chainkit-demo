// api/auth/me.js
export const config = { runtime: "nodejs" };

import { requireAuth } from "../../lib/requireAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const userPk = requireAuth(req);
    return res.status(200).json({ ok: true, wallet: userPk.toBase58() });
  } catch (e) {
    return res.status(401).json({ ok: false, error: e?.message || "Unauthorized" });
  }
}
