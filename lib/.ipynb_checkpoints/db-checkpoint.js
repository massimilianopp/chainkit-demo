import { neon, neonConfig } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
neonConfig.fetch_connection_cache = true;
export const sql = neon(process.env.DATABASE_URL);
