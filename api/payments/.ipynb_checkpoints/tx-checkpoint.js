export const config = { runtime: "nodejs" };
function noCache(res){ res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); res.setHeader("Pragma","no-cache"); res.setHeader("Expires","0"); }
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import { requireAuth } from "../../lib/requireAuth.js"; import { sql } from "../../lib/db.js"; import { connection } from "../../lib/solana.js";
export default async function handler(req,res){
  if (req.method !== "GET") { noCache(res); return res.status(405).json({ ok:false, error:"Method not allowed" }); }
  try{
    const userPk = requireAuth(req); const wallet = userPk.toBase58();
    const { reference, account } = req.query || {};
    if (!reference || !account) { noCache(res); return res.status(400).json({ ok:false, error:"Missing reference or account" }); }
    if (wallet !== account) { noCache(res); return res.status(400).json({ ok:false, error:"JWT/account mismatch" }); }
    const rows = await sql`select id,wallet,chapter_id,amount_raw,mint,merchant,status from purchases where id=${reference}::uuid limit 1`;
    const intent = rows?.[0]; if (!intent) { noCache(res); return res.status(404).json({ ok:false, error:"Intent not found" }); }
    if (intent.status !== "PENDING") { noCache(res); return res.status(400).json({ ok:false, error:`Intent status is ${intent.status}` }); }
    const playerPk=new PublicKey(wallet), mintPk=new PublicKey(intent.mint), merchantPk=new PublicKey(intent.merchant);
    const playerAta=await getAssociatedTokenAddress(mintPk,playerPk); const merchantAta=await getAssociatedTokenAddress(mintPk,merchantPk);
    const ix = createTransferInstruction(playerAta, merchantAta, playerPk, Number(intent.amount_raw));
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const tx = new Transaction({ feePayer: playerPk, recentBlockhash: blockhash }).add(ix);
    const b64 = tx.serialize({ requireAllSignatures:false, verifySignatures:false }).toString("base64");
    noCache(res); return res.status(200).json({ ok:true, transaction: b64 });
  }catch(e){ noCache(res); return res.status(500).json({ ok:false, error: e?.message || String(e) }); }
}
