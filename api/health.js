const { getPool } = require("./lib/_db");

module.exports = async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");
    const pool = getPool();
    const r = await pool.query("select 1 as ok");
    res.status(200).json({ ok: r.rows[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};
