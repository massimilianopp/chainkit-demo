import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";
const JWT_SECRET = process.env.JWT_SECRET;
export function requireAuth(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  const payload = jwt.verify(m[1], JWT_SECRET);
  const wallet = payload.wallet || payload.sub;
  if (!wallet) throw Object.assign(new Error("Bad token payload"), { statusCode: 401 });
  return new PublicKey(wallet);
}
