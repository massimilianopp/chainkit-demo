// src/WalletLayer.jsx
import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

// ⚡ Mets ta clé Helius ici :
const HELIUS_API_KEY = "f0561ea6-133f-4caa-9af8-227aec470e30";

// RPC mainnet via Helius (recommandé)
const endpoint = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export default function WalletLayer({ children }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {/* Bouton de connexion en haut à droite */}
          <div
            style={{
              position: "fixed",
              top: 12,
              right: 12,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(0,0,0,.6)",
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.15)",
              backdropFilter: "blur(4px)",
            }}
          >
            <WalletMultiButton />
            <span style={{ fontSize: 12, opacity: 0.8 }}>Mainnet • Helius</span>
          </div>

          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
