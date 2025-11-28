// api/rewards/claim.js
export const config = { runtime: "nodejs" };

import crypto from "node:crypto";
import { requireAuth } from "../../lib/requireAuth.js";
import { sql } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const userPk = requireAuth(req);
    const wallet = userPk.toBase58();
    const { rewardId } = req.body || {};
    if (!rewardId) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing rewardId" });
    }

    const id = crypto.randomUUID();
    await sql/* sql */`
      insert into reward_claims (id, wallet, reward_id)
      values (${id}::uuid, ${wallet}, ${rewardId})
      on conflict (wallet, reward_id) do nothing
    `;

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
