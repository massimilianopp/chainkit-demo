// utils/verifySiws.js
const nacl = require("tweetnacl");
const bs58 = require("bs58");

function verifySiws({ wallet, message, signatureBase64 }) {
  if (!wallet || !message || !signatureBase64) return false;
  try {
    const pub = bs58.decode(wallet);
    const sig = Buffer.from(signatureBase64, "base64");
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch { return false; }
}
module.exports = { verifySiws };
