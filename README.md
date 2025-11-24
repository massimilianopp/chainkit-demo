# 🍅 Tomatocoin Game + ChainKit SDK  
**A complete Web3 RPG and a generic Solana integration toolkit for games.**

Tomatocoin Game is a story-driven Web3 RPG built on Solana.  
It demonstrates the integration of **ChainKit**, a plug-and-play SDK enabling any game to:

- connect a Solana wallet (Phantom / Solflare)
- unlock paid levels with SPL tokens
- sign transactions via Solana Pay
- reward players with tokens
- store player progress using SIWS + JWT

This repository contains **the full game**, **the full SDK**, and **the backend**.

---

# 📦 Project Structure


src/
chainkit/ ← the ChainKit SDK
App.jsx ← full game logic + ChainKit usage example
game/ ← scripts, story, nodes
ui/ ← UI components
components/
hooks/
api/ ← backend API (SIWS, payments, checkpoints, rewards)
lib/ ← Solana utils, DB, rate limiting, SIWS helpers
public/ ← assets
vite.config.mjs
vercel.json
package.json



---

# 🔌 ChainKit SDK (included in `/src/chainkit/`)

ChainKit is a lightweight SDK that allows any game to integrate Solana features with **zero blockchain knowledge**.

### 🚀 Features

- **Wallet Login** (SIWS)
- **JWT session management**
- **Token balance reading**
- **Level / item purchases via Solana Pay**
- **VersionedTransaction (v0) support**
- **Player rewards (SPL transfers)**
- **Backend utilities for verification**
- **Cloud save (checkpoints)**

### 🧩 Main API Functions

```js
initChainKit({ apiBase, primaryMint });
ensureToken();                         // connect Phantom
readSplBalanceParsed(...);             // get token balance
purchaseChapter(chapterId, options);   // in-game purchase
claimReward(eventKey, amountUi);       // reward player
apiSaveCheckpoint(jwt, nodeId);        // cloud save
apiGetMe(jwt);                         // load progress

🎮 Tomatocoin Game (Example Project)

This project includes a fully playable game that demonstrates ChainKit in action:
pay-to-unlock chapters
token rewards for special events
automatic wallet connection
in-game Solana Pay integration
server-side checkpoint saving
custom animations, scenes, and inventory
full audio system
typewriter dialogues
level-up logic (healing XP)
This is the reference integration for developers using ChainKit.


🛠 Development

Install dependencies
npm install


Run locally
npm run dev


Build for production
npm run build


🌐 Backend (located in /api/)

Contains the complete backend for:

SIWS authentication
/api/auth/nonce
/api/auth/siws

Player state
/api/player/me
/api/player/unlocked

Progress saving
/api/progress/checkpoint

Payments
/api/payments/intent
/api/payments/tx (VersionedTransaction v0)
/api/payments/record

Rewards

/api/rewards/claim

All backend code is compatible with Vercel functions.



🔐 Authentication (SIWS + JWT)

ChainKit requests a SIWS nonce

User signs it in Phantom

Backend verifies it

A JWT is issued

The JWT is reused for all game progress & backend requests

This makes player progress secure and wallet-dependent.



💸 Purchases (Solana Pay)

When the player unlocks a chapter:

ChainKit calls /api/payments/intent

The backend records a PENDING purchase

The game receives a Solana Pay URL

Phantom opens with the exact amount

/api/payments/tx constructs a VersionedTransaction (v0)

User signs

Backend verifies and records the purchase

The game unlocks the chapter




🎁 Rewards (SPL token transfers)

ChainKit allows the game to grant rewards tied to specific events:

await claimReward("victory_boss", 2000);

The backend validates and transfers SPL tokens to the player.



🧩 Why This Repo Is Valuable

Full real-world Web3 game (Tomatocoin Game)

Complete SDK (ChainKit)

Fully functional backend API

Modern Solana implementation (Versioned TX, Solana Pay)

Clean architecture

Ready for reuse or extension

Educational for blockchain + game dev

Perfect for students, devs, and teams wanting to explore Web3 gaming.



📄 License

MIT License for open-source usage.
Commercial licensing available for studios or enterprise users.

(Contact the maintainer for details.)



