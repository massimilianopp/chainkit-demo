import crypto from "node:crypto";
const STORE = globalThis.__nonceStore || (globalThis.__nonceStore = new Map());
export function issueNonce(account, ttlMs = 5 * 60 * 1000) {
  const nonce = crypto.randomUUID(); const key = `${account || "-"}:${nonce}`;
  STORE.set(key, Date.now() + ttlMs); return nonce;
}
export function consumeNonce(account, nonce) {
  const key = `${account || "-"}:${nonce}`; const exp = STORE.get(key);
  if (!exp) return false; STORE.delete(key); return Date.now() <= exp;
}
