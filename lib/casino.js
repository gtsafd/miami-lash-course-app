const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const storePath = path.join(dataDir, "casino.json");

const tokenSecret = process.env.TOKEN_SECRET || "change-this-token-secret";
const githubToken = process.env.GITHUB_TOKEN || "";
const githubRepo = process.env.GITHUB_REPO || "";
const githubBranch = process.env.GITHUB_BRANCH || "main";
const githubStorePath = process.env.GITHUB_CASINO_STORE_PATH || "private/casino.json";

const STARTING_BALANCE = 1000;
const MIN_BET = 1;
const MAX_BET = 100000;
const DAILY_BONUS = 500;
const DAILY_BONUS_COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20 hours
const RESCUE_BONUS = 250; // refill when broke
const RESCUE_THRESHOLD = 50;
const HISTORY_LIMIT = 25;

const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
// Weighted reel strip: rarer symbols appear less often.
const SLOT_STRIP = [
  ...Array(28).fill("🍒"),
  ...Array(24).fill("🍋"),
  ...Array(18).fill("🔔"),
  ...Array(14).fill("⭐"),
  ...Array(9).fill("💎"),
  ...Array(5).fill("7️⃣")
];
// Multiplier for three-of-a-kind (applied to total bet).
const SLOT_TRIPLES = { "🍒": 4, "🍋": 6, "🔔": 12, "⭐": 25, "💎": 60, "7️⃣": 150 };

async function handleApi(req, res) {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});

    const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "POST" && pathname === "/api/casino/session") return startSession(req, res);
    if (req.method === "GET" && pathname === "/api/casino/me") return me(req, res);
    if (req.method === "POST" && pathname === "/api/casino/bonus") return claimBonus(req, res);
    if (req.method === "GET" && pathname === "/api/casino/leaderboard") return leaderboard(req, res);

    if (req.method === "POST" && pathname === "/api/casino/play/coinflip") return playCoinflip(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/dice") return playDice(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/slots") return playSlots(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/roulette") return playRoulette(req, res);

    if (req.method === "POST" && pathname === "/api/casino/blackjack/deal") return blackjackDeal(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/hit") return blackjackHit(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/stand") return blackjackStand(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/double") return blackjackDouble(req, res);

    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Server error" });
  }
}

/* ---------------------------------- auth ---------------------------------- */

async function startSession(req, res) {
  const body = await readJson(req);
  const store = await readStore();

  // Resume an existing player if a valid token is supplied.
  const auth = requirePlayer(req);
  if (auth.ok) {
    const existing = store.players.find((p) => p.id === auth.payload.id);
    if (existing) {
      const rename = cleanName(body.name);
      if (rename) existing.name = rename;
      await writeStore(store);
      return json(res, 200, { token: getBearer(req), player: publicPlayer(existing) });
    }
  }

  const name = cleanName(body.name) || `Player-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const player = {
    id: crypto.randomUUID(),
    name,
    balance: STARTING_BALANCE,
    createdAt: new Date().toISOString(),
    lastDailyBonus: 0,
    stats: { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    history: [],
    bj: null
  };
  store.players.push(player);
  await writeStore(store);
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

async function me(req, res) {
  const auth = requirePlayer(req);
  if (!auth.ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  const player = store.players.find((p) => p.id === auth.payload.id);
  if (!player) return json(res, 401, { error: "Unauthorized" });
  json(res, 200, { player: publicPlayer(player) });
}

async function claimBonus(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const now = Date.now();

  if (now - (player.lastDailyBonus || 0) >= DAILY_BONUS_COOLDOWN_MS) {
    player.balance += DAILY_BONUS;
    player.lastDailyBonus = now;
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), amount: DAILY_BONUS, kind: "daily" });
  }

  if (player.balance < RESCUE_THRESHOLD) {
    player.balance += RESCUE_BONUS;
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), amount: RESCUE_BONUS, kind: "rescue" });
  }

  const nextAt = (player.lastDailyBonus || 0) + DAILY_BONUS_COOLDOWN_MS;
  json(res, 429, { error: "Bonus not ready yet", nextAt });
}

async function leaderboard(req, res) {
  const store = await readStore();
  const top = [...store.players]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10)
    .map((p) => ({ name: p.name, balance: p.balance, biggestWin: p.stats?.biggestWin || 0 }));
  json(res, 200, { leaderboard: top });
}

/* ---------------------------------- games --------------------------------- */

async function playCoinflip(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet);
  const side = body.side === "tails" ? "tails" : "heads";
  if (bet === null) return badBet(res);
  if (bet > player.balance) return json(res, 400, { error: "Not enough chips" });

  const result = rngInt(0, 2) === 0 ? "heads" : "tails";
  const win = result === side;
  const payout = win ? bet * 2 : 0;
  applyRound(player, "coinflip", bet, payout, `${side} · landed ${result}`);

  await writeStore(store);
  json(res, 200, {
    player: publicPlayer(player),
    outcome: { result, side, win, bet, payout, net: payout - bet }
  });
}

async function playDice(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet);
  // target: win if roll (0..99.99) < target. Range 2..98.
  let target = Math.round(Number(body.target) * 100) / 100;
  if (!Number.isFinite(target)) target = 50;
  target = Math.min(98, Math.max(2, target));
  if (bet === null) return badBet(res);
  if (bet > player.balance) return json(res, 400, { error: "Not enough chips" });

  const roll = rngInt(0, 10000) / 100; // 0.00 .. 99.99
  const win = roll < target;
  const multiplier = Math.floor((99 / target) * 100) / 100; // 1% house edge
  const payout = win ? Math.floor(bet * multiplier) : 0;
  applyRound(player, "dice", bet, payout, `roll ${roll.toFixed(2)} < ${target} → ${win ? "win" : "loss"}`);

  await writeStore(store);
  json(res, 200, {
    player: publicPlayer(player),
    outcome: { roll, target, multiplier, win, bet, payout, net: payout - bet }
  });
}

async function playSlots(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet);
  if (bet === null) return badBet(res);
  if (bet > player.balance) return json(res, 400, { error: "Not enough chips" });

  const reels = [0, 1, 2].map(() => SLOT_STRIP[rngInt(0, SLOT_STRIP.length)]);
  let payout = 0;
  let line = "none";
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    payout = bet * SLOT_TRIPLES[reels[0]];
    line = "triple";
  } else {
    const cherries = reels.filter((s) => s === "🍒").length;
    if (cherries === 2) {
      payout = bet * 2;
      line = "two-cherry";
    } else if (cherries === 1) {
      payout = bet; // money back
      line = "one-cherry";
    }
  }
  applyRound(player, "slots", bet, payout, `${reels.join(" ")} · ${line}`);

  await writeStore(store);
  json(res, 200, {
    player: publicPlayer(player),
    outcome: { reels, line, bet, payout, net: payout - bet, win: payout > bet }
  });
}

async function playRoulette(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const body = await readJson(req);
  const bets = Array.isArray(body.bets) ? body.bets : [];
  if (!bets.length) return json(res, 400, { error: "Place at least one bet" });

  let total = 0;
  const placed = [];
  for (const b of bets) {
    const amount = parseBet(b.amount);
    if (amount === null) return badBet(res);
    const norm = normalizeRouletteBet(b.type, b.value);
    if (!norm) return json(res, 400, { error: "Invalid bet type" });
    total += amount;
    placed.push({ ...norm, amount });
  }
  if (total > player.balance) return json(res, 400, { error: "Not enough chips" });
  if (total < MIN_BET) return badBet(res);

  const result = rngInt(0, 37); // 0..36 European wheel
  let payout = 0;
  const details = placed.map((b) => {
    const win = rouletteWins(b, result);
    const winnings = win ? b.amount * (b.payout + 1) : 0; // includes stake
    payout += winnings;
    return { type: b.type, value: b.value, amount: b.amount, win, winnings };
  });

  applyRound(player, "roulette", total, payout, `landed ${result} ${rouletteColor(result)}`);
  await writeStore(store);
  json(res, 200, {
    player: publicPlayer(player),
    outcome: { result, color: rouletteColor(result), bet: total, payout, net: payout - total, win: payout > total, details }
  });
}

/* -------------------------------- blackjack -------------------------------- */

async function blackjackDeal(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet);
  if (bet === null) return badBet(res);
  if (player.bj && player.bj.status === "playing") return json(res, 400, { error: "Finish your current hand first" });
  if (bet > player.balance) return json(res, 400, { error: "Not enough chips" });

  player.balance -= bet;
  player.stats.wagered += bet;

  const deck = freshDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  player.bj = { deck, playerHand, dealerHand, bet, status: "playing", doubled: false };

  const pv = handValue(playerHand);
  const dv = handValue(dealerHand);
  if (pv === 21 || dv === 21) {
    return finishBlackjack(store, player, res); // natural(s) resolve immediately
  }
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: blackjackView(player.bj) });
}

async function blackjackHit(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  if (!player.bj || player.bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  player.bj.playerHand.push(player.bj.deck.pop());
  if (handValue(player.bj.playerHand) >= 21) return finishBlackjack(store, player, res);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: blackjackView(player.bj) });
}

async function blackjackDouble(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const bj = player.bj;
  if (!bj || bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  if (bj.playerHand.length !== 2) return json(res, 400, { error: "Can only double on first two cards" });
  if (bj.bet > player.balance) return json(res, 400, { error: "Not enough chips to double" });
  player.balance -= bj.bet;
  player.stats.wagered += bj.bet;
  bj.bet *= 2;
  bj.doubled = true;
  bj.playerHand.push(bj.deck.pop());
  return finishBlackjack(store, player, res);
}

async function blackjackStand(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  if (!player.bj || player.bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  return finishBlackjack(store, player, res);
}

async function finishBlackjack(store, player, res) {
  const bj = player.bj;
  const playerVal = handValue(bj.playerHand);

  // Dealer draws to 17 (stands on all 17) unless the player already busted.
  if (playerVal <= 21) {
    while (handValue(bj.dealerHand) < 17) bj.dealerHand.push(bj.deck.pop());
  }
  const dealerVal = handValue(bj.dealerHand);
  const playerBJ = bj.playerHand.length === 2 && playerVal === 21;
  const dealerBJ = bj.dealerHand.length === 2 && dealerVal === 21;

  let result;
  let payout = 0; // amount returned to player (includes stake)
  if (playerVal > 21) {
    result = "lose";
  } else if (playerBJ && !dealerBJ) {
    result = "blackjack";
    payout = Math.floor(bj.bet * 2.5); // 3:2
  } else if (dealerBJ && !playerBJ) {
    result = "lose";
  } else if (dealerVal > 21 || playerVal > dealerVal) {
    result = "win";
    payout = bj.bet * 2;
  } else if (playerVal < dealerVal) {
    result = "lose";
  } else {
    result = "push";
    payout = bj.bet; // stake back
  }

  player.balance += payout;
  bj.status = "done";
  bj.result = result;
  bj.payout = payout;

  const net = payout - bj.bet;
  player.stats.gamesPlayed += 1;
  if (net > 0) {
    player.stats.won += net;
    if (net > player.stats.biggestWin) player.stats.biggestWin = net;
  }
  pushHistory(player, {
    game: "blackjack",
    bet: bj.bet,
    payout,
    net,
    detail: `${result} · you ${playerVal} / dealer ${dealerVal}`
  });

  const view = blackjackView(bj, true);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: view });
}

/* -------------------------------- helpers --------------------------------- */

function applyRound(player, game, bet, payout, detail) {
  player.balance += payout - bet; // bet was not yet deducted for these games
  player.stats.gamesPlayed += 1;
  player.stats.wagered += bet;
  const net = payout - bet;
  if (net > 0) {
    player.stats.won += net;
    if (net > player.stats.biggestWin) player.stats.biggestWin = net;
  }
  pushHistory(player, { game, bet, payout, net, detail });
}

function pushHistory(player, entry) {
  player.history.unshift({ ...entry, at: new Date().toISOString() });
  if (player.history.length > HISTORY_LIMIT) player.history.length = HISTORY_LIMIT;
}

function parseBet(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_BET || n > MAX_BET) return null;
  return n;
}

function badBet(res) {
  return json(res, 400, { error: `Bet must be between ${MIN_BET} and ${MAX_BET} chips` });
}

function cleanName(value) {
  const name = String(value || "").trim().slice(0, 24);
  return /[^\s]/.test(name) ? name : "";
}

/* roulette logic */
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function rouletteColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}
function normalizeRouletteBet(type, value) {
  switch (type) {
    case "straight": {
      const n = Math.floor(Number(value));
      if (!Number.isFinite(n) || n < 0 || n > 36) return null;
      return { type, value: n, payout: 35 };
    }
    case "red":
    case "black":
    case "even":
    case "odd":
    case "low":
    case "high":
      return { type, value: type, payout: 1 };
    case "dozen": {
      const d = Math.floor(Number(value));
      if (![1, 2, 3].includes(d)) return null;
      return { type, value: d, payout: 2 };
    }
    case "column": {
      const c = Math.floor(Number(value));
      if (![1, 2, 3].includes(c)) return null;
      return { type, value: c, payout: 2 };
    }
    default:
      return null;
  }
}
function rouletteWins(bet, n) {
  if (n === 0) return bet.type === "straight" && bet.value === 0;
  switch (bet.type) {
    case "straight": return bet.value === n;
    case "red": return rouletteColor(n) === "red";
    case "black": return rouletteColor(n) === "black";
    case "even": return n % 2 === 0;
    case "odd": return n % 2 === 1;
    case "low": return n >= 1 && n <= 18;
    case "high": return n >= 19 && n <= 36;
    case "dozen": return Math.ceil(n / 12) === bet.value;
    case "column": return n % 3 === (bet.value % 3);
    default: return false;
  }
}

/* blackjack cards */
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
function freshDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  // Fisher–Yates with secure RNG
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rngInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function cardValue(r) {
  if (r === "A") return 11;
  if (r === "K" || r === "Q" || r === "J") return 10;
  return Number(r);
}
function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += cardValue(c.r);
    if (c.r === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}
function blackjackView(bj, reveal = false) {
  const playerVal = handValue(bj.playerHand);
  const view = {
    status: bj.status,
    bet: bj.bet,
    doubled: bj.doubled,
    playerHand: bj.playerHand,
    playerValue: playerVal,
    canDouble: bj.status === "playing" && bj.playerHand.length === 2
  };
  if (bj.status === "playing" && !reveal) {
    view.dealerHand = [bj.dealerHand[0], { hidden: true }];
    view.dealerValue = cardValue(bj.dealerHand[0].r === "A" ? "A" : bj.dealerHand[0].r);
    view.dealerHidden = true;
  } else {
    view.dealerHand = bj.dealerHand;
    view.dealerValue = handValue(bj.dealerHand);
    view.dealerHidden = false;
    view.result = bj.result;
    view.payout = bj.payout;
  }
  return view;
}

/* secure RNG: integer in [min, max) */
function rngInt(min, max) {
  return crypto.randomInt(min, max);
}

/* ----------------------------- player context ----------------------------- */

async function loadPlayer(req, res) {
  const auth = requirePlayer(req);
  if (!auth.ok) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  const store = await readStore();
  const player = store.players.find((p) => p.id === auth.payload.id);
  if (!player) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  if (!player.stats) player.stats = { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 };
  if (!Array.isArray(player.history)) player.history = [];
  return { store, player };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    balance: player.balance,
    lastDailyBonus: player.lastDailyBonus || 0,
    bonusReadyAt: (player.lastDailyBonus || 0) + DAILY_BONUS_COOLDOWN_MS,
    canRescue: player.balance < RESCUE_THRESHOLD,
    stats: player.stats || { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    history: player.history || [],
    blackjack: player.bj && player.bj.status === "playing" ? blackjackView(player.bj) : null
  };
}

function requirePlayer(req) {
  const payload = verifyToken(getBearer(req));
  return payload?.type === "player" ? { ok: true, payload } : { ok: false };
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", tokenSecret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/* -------------------------------- storage --------------------------------- */

async function readStore() {
  if (githubToken && githubRepo) return readGithubStore();
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, JSON.stringify(defaultStore(), null, 2));
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  if (!Array.isArray(store.players)) store.players = [];
  return store;
}

async function writeStore(store) {
  if (githubToken && githubRepo) return writeGithubStore(store);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

async function readGithubStore() {
  const current = await githubRequest("GET");
  if (current.status === 404) {
    const store = defaultStore();
    await writeGithubStore(store);
    return store;
  }
  if (!current.ok) throw new Error(`GitHub store read failed: ${current.status}`);
  const data = await current.json();
  const store = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  if (!Array.isArray(store.players)) store.players = [];
  return store;
}

async function writeGithubStore(store) {
  const current = await githubRequest("GET");
  const sha = current.ok ? (await current.json()).sha : undefined;
  const body = {
    message: "Update casino data",
    content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"),
    branch: githubBranch,
    ...(sha ? { sha } : {})
  };
  const saved = await githubRequest("PUT", body);
  if (!saved.ok) throw new Error(`GitHub store write failed: ${saved.status} ${await saved.text()}`);
}

function githubRequest(method, body) {
  return fetch(`https://api.github.com/repos/${githubRepo}/contents/${githubStorePath}${method === "GET" ? `?ref=${githubBranch}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  });
  res.end(status === 204 ? "" : JSON.stringify(payload));
}

function defaultStore() {
  return { players: [] };
}

module.exports = {
  handleCasinoApi: handleApi,
  // exported for tests
  _internal: { handValue, freshDeck, rouletteWins, rouletteColor, normalizeRouletteBet }
};
