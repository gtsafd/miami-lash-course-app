# 🎰 Neon Chips — Virtual Casino

A fun, **play-money** online casino. Bet virtual chips on five classic games — no
real money is ever involved. Chips have no monetary value and cannot be bought,
sold, or cashed out.

> ⚠️ This is an entertainment / social-casino style app. It is **not** a
> real-money gambling product.

## Games

| Game | How it works | Max payout |
| --- | --- | --- |
| 🎰 **Slots** | 3 reels, weighted symbols. Match three to win. | 150× (7️⃣7️⃣7️⃣) |
| 🎲 **Dice** | Roll-under: pick a target, lower target pays more (1% house edge). | up to ~49× |
| 🪙 **Coinflip** | Fair 50/50, win doubles your bet. | 2× |
| 🎡 **Roulette** | European single-zero wheel, stack chips on multiple bets. | 35:1 straight |
| 🃏 **Blackjack** | Beat the dealer to 21. Blackjack pays 3:2, dealer stands on 17, double allowed. | 3:2 |

## Features

- Pick a name and get **1000 starting chips** — your session persists in the browser.
- **Daily bonus** (+500 chips every 20h) and a **rescue top-up** (+250) when you go broke.
- Live **balance**, **stats** (games played, wagered, net won, biggest win) and a **recent-bets** log.
- Global **leaderboard** of the richest players.
- All game outcomes are computed **server-side** with `crypto.randomInt` — the
  browser never decides whether you win.
- Works as an installable PWA, light backend, zero build step, JSON storage.

## Run locally

```bash
TOKEN_SECRET='long-random-secret' node server.js
```

Then open:

```text
http://127.0.0.1:5188
```

(`npm run dev` also works and serves on the same port.)

## API

All game endpoints require a player `Bearer` token issued by `/api/session`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/session` | Create a player (or resume with a token) and get a token. |
| GET | `/api/me` | Current player + balance + stats. |
| POST | `/api/bonus` | Claim daily / rescue bonus. |
| GET | `/api/leaderboard` | Top 10 players by balance. |
| POST | `/api/play/coinflip` | `{ bet, side }` |
| POST | `/api/play/dice` | `{ bet, target }` |
| POST | `/api/play/slots` | `{ bet }` |
| POST | `/api/play/roulette` | `{ bets: [{ type, value, amount }] }` |
| POST | `/api/blackjack/deal` | `{ bet }` — start a hand |
| POST | `/api/blackjack/hit` | draw a card |
| POST | `/api/blackjack/stand` | dealer plays, resolve |
| POST | `/api/blackjack/double` | double the bet, draw one, resolve |

## Storage & deployment

Player state is stored in `data/store.json` locally. For a serverless/Vercel
deployment you can persist to a private GitHub repo instead by setting:

```text
TOKEN_SECRET=long-random-secret
GITHUB_TOKEN=github-token-with-repo-access
GITHUB_REPO=owner/private-data-repo
GITHUB_BRANCH=main
GITHUB_STORE_PATH=private/store.json
```

`server.js` serves the static frontend and routes `/api/*` to the casino
backend in `lib/app.js`. `api/index.js` is the Vercel serverless entry point.
