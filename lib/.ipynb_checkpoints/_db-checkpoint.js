// Connexion Postgres (Neon)
const { Pool } = require("pg");

// Pool singleton pour éviter les connexions multiples
let _pool;
function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}

module.exports = { getPool };
