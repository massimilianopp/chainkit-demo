// lib/requireAuth.js
import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET env var is required");
}

export function requireAuth(req) {
  const auth = req.headers.authorization || "";
  const [scheme, token] = auth.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new Error("Missing or invalid Authorization header");
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      // On garde ça assez permissif pour éviter de casser en dev
      // issuer / audience sont posés par siws.js
      ignoreExpiration: false,
    });
  } catch (e) {
    throw new Error("Invalid or expired token");
  }

  const wallet = payload.wallet || payload.sub;
  if (!wallet || typeof wallet !== "string") {
    throw new Error("Token missing wallet");
  }

  try {
    return new PublicKey(wallet);
  } catch {
    throw new Error("Invalid wallet in token");
  }
}
