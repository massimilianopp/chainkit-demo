export const config = { runtime: "nodejs" };
function noCache(res){ res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); res.setHeader("Pragma","no-cache"); res.setHeader("Expires","0"); }
import { requireAuth } from "../../lib/requireAuth.js"; import { sql } from "../../lib/db.js";
export default async function handler(req,res){
  if (req.method !== "GET") { noCache(res); return res.status(405).json({ unlocked: [], error:"Method not allowed" }); }
  try{
    const userPk = requireAuth(req); const wallet = userPk.toBase58();
    const rows = await sql`select chapter_id from purchases where wallet=${wallet} and status='CONFIRMED' order by confirmed_at nulls last, created_at`;
    noCache(res); return res.status(200).json({ unlocked: rows.map(r => r.chapter_id) });
  }catch(e){ noCache(res); return res.status(500).json({ unlocked: [], error: e?.message || String(e) }); }
}
