import { Connection, PublicKey } from "@solana/web3.js";
export const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
export const MERCHANT_WALLET = new PublicKey(process.env.MERCHANT_WALLET);
export const TOMATO_MINT = new PublicKey("CdczQNrp2DZ9c89LSjCyRF6VmS4VtTCBkNSjXtpvmoon"); // ajuste si besoin
export const TOMATO_DECIMALS = 6;
export const CHAPTER_PRICE_UI = 100_000;
export const CHAPTER_PRICE_RAW = BigInt(CHAPTER_PRICE_UI) * BigInt(10 ** TOMATO_DECIMALS);
