// lib/_config.js
const { PublicKey } = require("@solana/web3.js");

function ensureHttps(url) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function baseUrlFromReq(req) {
  const proto = "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || process.env.VERCEL_URL;
  return `${proto}://${host}`;
}

module.exports = {
  baseUrlFromReq,
  PRICE_UI: 100_000,
  DECIMALS: 6,
  MERCHANT_WALLET: new PublicKey(process.env.MERCHANT_WALLET),
  TOMATO_MINT: new PublicKey(process.env.TOMATO_MINT),
  RPC_URL: ensureHttps(process.env.SOLANA_RPC_URL), // <-- protection
};
