# Tomatocoin Game + ChainKit SDK

Tomatocoin Game est un RPG Web3 construit sur Solana. Le jeu démontre l’utilisation de ChainKit, un SDK permettant d’intégrer facilement Solana dans n’importe quel jeu : connexion wallet, achats in-game, paiements Solana Pay, récompenses et sauvegarde du progrès.

Ce repository contient le jeu complet, le SDK et le backend.

## Structure du projet

src/
  chainkit/            (SDK ChainKit)
  App.jsx              (logique du jeu + intégration)
  game/                (histoire, scènes, nodes)
  ui/                  (interface)
  components/
  hooks/
api/                   (backend : SIWS, paiements, rewards, checkpoints)
lib/                   (utils Solana, DB)
public/                (assets)
vite.config.mjs
vercel.json
package.json

## ChainKit SDK

Fonctions principales disponibles dans src/chainkit/ :

- initChainKit(options)
- ensureToken()
- readSplBalanceParsed(...)
- purchaseChapter(id, options)
- claimReward(eventKey, amountUi)
- apiSaveCheckpoint(jwt, nodeId)
- apiGetMe(jwt)

Le SDK permet d’intégrer Solana dans un jeu sans écrire de code blockchain.

## Fonctionnalités du jeu

- Déblocage de chapitres payants
- Paiements via Solana Pay
- Récompenses en tokens SPL
- Connexion automatique du wallet
- Sauvegarde du progrès côté serveur
- Inventaire, XP, scènes, dialogues et audio

Tomatocoin Game sert d’exemple officiel pour l’intégration de ChainKit.

## Développement

Installation :
npm install

Lancement :
npm run dev

Build :
npm run build

## Backend (répertoire api/)

Endpoints disponibles :
- /api/auth/nonce
- /api/auth/siws
- /api/player/me
- /api/player/unlocked
- /api/progress/checkpoint
- /api/payments/intent
- /api/payments/tx
- /api/payments/record
- /api/rewards/claim

## Pourquoi ce repo est utile

- Jeu Web3 complet
- SDK réutilisable
- Backend prêt à l’emploi
- Architecture claire
- Exemple concret et pédagogique pour le Web3 gaming

## Licence

MIT (open source)
Possibilité de licence commerciale pour un usage professionnel.

## Maintainer

Massimiliano (@offtomatocoin)
