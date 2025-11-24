# Tomatocoin Game + ChainKit SDK

Tomatocoin Game is a Web3 RPG built on Solana.  
It demonstrates the use of ChainKit, a lightweight SDK that enables any game to integrate Solana features with no blockchain knowledge.

ChainKit provides:
- Wallet connection (Phantom, Solflare)
- Pay-to-unlock levels with SPL tokens
- Solana Pay transactions
- Token-based rewards
- Cloud-saved progress using SIWS + JWT

This repository contains the full game, the SDK, and the backend.

## Project Structure

src/
  chainkit/              (ChainKit SDK)
  App.jsx                (game logic + SDK integration)
  game/                  (story, nodes, events)
  ui/                    (UI components)
  components/
  hooks/
api/                     (backend: SIWS, payments, rewards, checkpoints)
lib/                     (Solana utilities, DB, rate limiting)
public/                  (assets)
vite.config.mjs          
vercel.json
package.json

## ChainKit SDK

Located in: src/chainkit/

Available functions:
- initChainKit(options)
- ensureToken()
- readSplBalanceParsed(connection, publicKey, mint)
- purchaseChapter(id, options)
- claimReward(eventKey, amountUi)
- apiSaveCheckpoint(jwt, nodeId)
- apiGetMe(jwt)

ChainKit enables game developers to integrate Solana without writing any blockchain code.

## Tomatocoin Game (Example Project)

This repository includes a fully playable Web3 RPG that shows how ChainKit works in a real game environment.

Features:
- Paid chapter unlocking
- Solana Pay integration
- Token rewards
- Wallet login
- Server-side checkpoint saving
- Inventory system
- XP and healing system
- Scenes, dialogues, audio, and story engine

This game acts as the reference implementation for developers wanting to use ChainKit.

## Development

Install dependencies:
npm install

Run locally:
npm run dev

Build for production:
npm run build

## Backend (directory: api/)

Available API endpoints:

Authentication:
- /api/auth/nonce
- /api/auth/siws

Player state:
- /api/player/me
- /api/player/unlocked

Progress:
- /api/progress/checkpoint

Payments:
- /api/payments/intent
- /api/payments/tx
- /api/payments/record

Rewards:
- /api/rewards/claim

The backend is compatible with Vercel Functions.

## Licensing

This project uses a dual-licensing model.

1. Non-commercial license (default)  
   Allowed: personal, educational, research, non-commercial use.  
   File: LICENSE  
   Commercial use is not permitted under this license.

2. Commercial license (paid)  
   Required for any company or professional use, including paid games or commercial projects.  
   File: LICENSE-COMMERCIAL.md  
   A license can be purchased directly from the maintainer.

See NOTICE.md for full licensing terms.

## Maintainer

Massimiliano (@offtomatocoin)
