import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";
import jwt from "jsonwebtoken";

const pool = globalThis.pgPool || new Pool({ connectionString: process.env.DATABASE_URL });
if (!globalThis.pgPool) (globalThis as any).pgPool = pool;

// Helper pour lire le wallet depuis le JWT
function getWalletFromAuth(req: NextApiRequest) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    return (payload as any)?.wallet || (payload as any)?.sub || null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const wallet = getWalletFromAuth(req);
    if (!wallet) return res.status(401).json({ ok: false, error: "unauthorized" });

    const healXp = Math.max(0, parseInt((req.body?.xp ?? 0).toString(), 10) || 0);

    const q = `
      INSERT INTO heal_leaderboard (wallet, heal_xp, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (wallet) DO UPDATE
        SET heal_xp = GREATEST(heal_leaderboard.heal_xp, EXCLUDED.heal_xp),
            updated_at = CASE WHEN EXCLUDED.heal_xp > heal_leaderboard.heal_xp THEN NOW() ELSE heal_leaderboard.updated_at END
      RETURNING wallet, heal_xp;
    `;
    const { rows } = await pool.query(q, [wallet, healXp]);
    return res.json({ ok: true, row: rows[0] });
  }

  if (req.method === "GET") {
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const includeMe = (req.query.me as string)?.toLowerCase() === "true";

    const topQ = `
      SELECT wallet, heal_xp, RANK() OVER (ORDER BY heal_xp DESC, updated_at ASC) AS rank
      FROM heal_leaderboard
      ORDER BY heal_xp DESC, updated_at ASC
      LIMIT $1;
    `;
    const top = await pool.query(topQ, [limit]);

    let me: any = null;
    if (includeMe) {
      const wallet = getWalletFromAuth(req);
      if (wallet) {
        const meQ = `
          SELECT wallet, heal_xp, RANK() OVER (ORDER BY heal_xp DESC, updated_at ASC) AS rank
          FROM heal_leaderboard
          WHERE wallet = $1;
        `;
        const r = await pool.query(meQ, [wallet]);
        me = r.rows[0] || null;
      }
    }

    return res.json({ ok: true, rows: top.rows, me });
  }

  return res.status(405).json({ ok: false, error: "method not allowed" });
}
