// src/chainkit/balances.js

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

/**
 * Lis le solde SPL (uiAmount) pour un owner + mint
 */
async function readSplBalanceParsed(connection, ownerPk, mintPk) {
  try {
    const res = await connection.getParsedTokenAccountsByOwner(
      ownerPk,
      { programId: TOKEN_PROGRAM_ID },
      "confirmed"
    );
    if (!res?.value?.length) return 0;
    let total = 0;
    for (const it of res.value) {
      const info = it.account.data.parsed.info;
      if (info.mint === mintPk.toBase58()) {
        total += Number(info.tokenAmount?.uiAmount || 0);
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export { readSplBalanceParsed };

