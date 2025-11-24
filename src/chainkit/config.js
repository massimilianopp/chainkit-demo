// src/chainkit/config.js

import { PublicKey } from "@solana/web3.js";

const _config = {
  apiBase: "",                 // ex: "/api" ou "https://monbackend.com"
  primaryMint: null,           // new PublicKey(...)
};

export function initChainKit(options = {}) {
  if (options.apiBase !== undefined) {
    _config.apiBase = options.apiBase.replace(/\/+$/, ""); // retire "/" final
  }
  if (options.primaryMint) {
    _config.primaryMint =
      options.primaryMint instanceof PublicKey
        ? options.primaryMint
        : new PublicKey(options.primaryMint);
  }
}

export function getConfig() {
  return { ..._config };
}

