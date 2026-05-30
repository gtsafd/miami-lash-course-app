const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
// On read-only hosts (e.g. Vercel) the bundle dir is not writable, so fall back
// to the OS temp dir. Persistent setups should configure GitHub storage instead.
const dataDir = process.env.VERCEL ? path.join(os.tmpdir(), "casino-data") : path.join(root, "data");
const storePath = path.join(dataDir, "casino.json");

const tokenSecret = process.env.TOKEN_SECRET || "change-this-token-secret";
const adminUsername = process.env.CASINO_ADMIN_USERNAME || "Alex";
const adminPassword = process.env.CASINO_ADMIN_PASSWORD || ""; // empty => admin disabled
const githubToken = process.env.GITHUB_TOKEN || "";
const githubRepo = process.env.GITHUB_REPO || "";
const githubBranch = process.env.GITHUB_BRANCH || "main";
const githubStorePath = process.env.GITHUB_CASINO_STORE_PATH || "private/casino.json";
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME || "";
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const casinoUrl = process.env.CASINO_URL || "https://kozakalex.com/casino/";

const HISTORY_LIMIT = 25;
const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];

/* --------------------------- configurable defaults ------------------------- */

function defaultConfig() {
  return {
    economy: {
      startingBalance: 1000,
      minBet: 1,
      maxBet: 100000,
      dailyBonus: 500,
      dailyCooldownHours: 20,
      rescueBonus: 250,
      rescueThreshold: 50
    },
    coinflip: { winChancePercent: 49, winMultiplier: 1.98 },
    dice: { houseEdgePercent: 2 },
    slots: {
      weights: { "🍒": 28, "🍋": 24, "🔔": 18, "⭐": 14, "💎": 9, "7️⃣": 5 },
      triples: { "🍒": 4, "🍋": 6, "🔔": 12, "⭐": 25, "💎": 60, "7️⃣": 150 },
      twoCherry: 2,
      oneCherry: 1
    },
    roulette: { enabled: true },
    wheel: {
      segments: [
        { label: "0x", multiplier: 0, weight: 30, color: "#38445f" },
        { label: "1.5x", multiplier: 1.5, weight: 25, color: "#2fe6a0" },
        { label: "2x", multiplier: 2, weight: 18, color: "#9d7bff" },
        { label: "3x", multiplier: 3, weight: 13, color: "#ffce54" },
        { label: "5x", multiplier: 5, weight: 8, color: "#ff8c42" },
        { label: "10x", multiplier: 10, weight: 4, color: "#ff5c7c" },
        { label: "50x", multiplier: 50, weight: 2, color: "#ff2d6f" }
      ]
    },
    crash: { houseEdgePercent: 7, maxMultiplier: 1000 },
    blackjack: { blackjackPayout: 1.5 }
  };
}

// Deep-merge stored config over defaults so new fields appear automatically.
function mergeConfig(stored) {
  const def = defaultConfig();
  if (!stored || typeof stored !== "object") return def;
  const out = {};
  for (const key of Object.keys(def)) {
    if (key === "wheel") {
      out.wheel = stored.wheel && Array.isArray(stored.wheel.segments) && stored.wheel.segments.length
        ? { segments: stored.wheel.segments }
        : def.wheel;
    } else if (key === "slots") {
      out.slots = {
        weights: { ...def.slots.weights, ...(stored.slots?.weights || {}) },
        triples: { ...def.slots.triples, ...(stored.slots?.triples || {}) },
        twoCherry: num(stored.slots?.twoCherry, def.slots.twoCherry),
        oneCherry: num(stored.slots?.oneCherry, def.slots.oneCherry)
      };
    } else {
      out[key] = { ...def[key], ...(stored[key] || {}) };
    }
  }
  return out;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* -------------------------------- routing --------------------------------- */

async function handleApi(req, res) {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});
    const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "POST" && pathname === "/api/casino/session") return startSession(req, res);
    if (req.method === "POST" && pathname === "/api/casino/telegram") return telegramSession(req, res);
    if (req.method === "POST" && pathname === "/api/casino/telegram-webapp") return telegramWebAppSession(req, res);
    if (req.method === "POST" && pathname === "/api/casino/telegram-bot") return telegramBotWebhook(req, res);
    if (req.method === "GET" && pathname === "/api/casino/me") return me(req, res);
    if (req.method === "GET" && pathname === "/api/casino/config") return publicConfig(req, res);
    if (req.method === "POST" && pathname === "/api/casino/bonus") return claimBonus(req, res);
    if (req.method === "GET" && pathname === "/api/casino/leaderboard") return leaderboard(req, res);

    if (req.method === "POST" && pathname === "/api/casino/play/coinflip") return playCoinflip(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/dice") return playDice(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/slots") return playSlots(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/roulette") return playRoulette(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/crash/start") return crashStart(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/crash/state") return crashState(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/crash/cashout") return crashCashout(req, res);

    if (req.method === "POST" && pathname === "/api/casino/blackjack/deal") return blackjackDeal(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/hit") return blackjackHit(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/stand") return blackjackStand(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/double") return blackjackDouble(req, res);

    if (req.method === "POST" && pathname === "/api/casino/admin/login") return adminLogin(req, res);
    if (req.method === "GET" && pathname === "/api/casino/admin/state") return adminState(req, res);
    if (req.method === "PUT" && pathname === "/api/casino/admin/config") return adminSaveConfig(req, res);
    if (req.method === "POST" && pathname === "/api/casino/admin/reset") return adminReset(req, res);
    if (req.method === "PUT" && pathname === "/api/casino/admin/player") return adminUpdatePlayer(req, res);
    if (req.method === "DELETE" && pathname === "/api/casino/admin/player") return adminDeletePlayer(req, res);
    if (req.method === "POST" && pathname === "/api/casino/admin/players/reset-results") return adminResetPlayerResults(req, res);
    if (req.method === "POST" && pathname === "/api/casino/admin/players/delete-all") return adminDeleteAllPlayers(req, res);

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
  const cfg = mergeConfig(store.config);
  const name = cleanName(body.name);
  const password = String(body.password || "");

  const auth = requirePlayer(req);
  if (auth.ok) {
    const existing = store.players.find((p) => p.id === auth.payload.id);
    if (existing) {
      if (name) existing.name = name;
      if (password && !existing.passwordHash) setPlayerPassword(existing, password);
      await writeStore(store);
      return json(res, 200, { token: getBearer(req), player: publicPlayer(existing) });
    }
  }

  if (!name) return json(res, 400, { error: "Player name is required" });
  if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });

  const existing = store.players.find((p) => playerKey(p.name) === playerKey(name));
  if (existing) {
    if (!existing.passwordHash) {
      setPlayerPassword(existing, password);
      await writeStore(store);
      return json(res, 200, { token: signToken({ type: "player", id: existing.id }), player: publicPlayer(existing) });
    }
    if (!verifyPlayerPassword(existing, password)) return json(res, 403, { error: "Wrong password for this player" });
    await writeStore(store);
    return json(res, 200, { token: signToken({ type: "player", id: existing.id }), player: publicPlayer(existing) });
  }

  const player = {
    id: crypto.randomUUID(),
    name,
    nameKey: playerKey(name),
    balance: cfg.economy.startingBalance,
    createdAt: new Date().toISOString(),
    lastDailyBonus: 0,
    stats: { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    history: [],
    bj: null
  };
  setPlayerPassword(player, password);
  store.players.push(player);
  await writeStore(store);
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

async function telegramSession(req, res) {
  if (!telegramBotToken) return json(res, 503, { error: "Telegram login is not configured" });
  const body = await readJson(req);
  const auth = verifyTelegramAuth(body.telegram || {});
  if (!auth.ok) return json(res, 403, { error: auth.error });

  const store = await readStore();
  const cfg = mergeConfig(store.config);
  const player = upsertTelegramPlayer(store, cfg, auth.user);
  await writeStore(store);
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

async function telegramWebAppSession(req, res) {
  if (!telegramBotToken) return json(res, 503, { error: "Telegram login is not configured" });
  const body = await readJson(req);
  const auth = verifyTelegramWebApp(body.initData || "");
  if (!auth.ok) return json(res, 403, { error: auth.error });

  const store = await readStore();
  const cfg = mergeConfig(store.config);
  const player = upsertTelegramPlayer(store, cfg, auth.user);
  await writeStore(store);
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

async function telegramBotWebhook(req, res) {
  if (!telegramBotToken) return json(res, 503, { error: "Telegram bot is not configured" });
  if (telegramWebhookSecret && req.headers["x-telegram-bot-api-secret-token"] !== telegramWebhookSecret) {
    return json(res, 403, { error: "Forbidden" });
  }
  const body = await readJson(req);
  const message = body.message || body.edited_message;
  const chatId = message?.chat?.id;
  if (!chatId) return json(res, 200, { ok: true });

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: "Open Neon Chips inside Telegram for one-tap app login.",
    reply_markup: {
      inline_keyboard: [[{ text: "Open Miami Casino", web_app: { url: casinoUrl } }]]
    }
  });
  json(res, 200, { ok: true });
}

async function me(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  json(res, 200, { player: publicPlayer(ctx.player) });
}

async function publicConfig(req, res) {
  const store = await readStore();
  const cfg = mergeConfig(store.config);
  // Only expose what the client needs for UI (payouts, economy).
  json(res, 200, {
    config: {
      economy: cfg.economy,
      coinflip: cfg.coinflip,
      dice: cfg.dice,
      slots: cfg.slots,
      crash: { maxMultiplier: cfg.crash.maxMultiplier },
      blackjack: cfg.blackjack,
      auth: { telegramBotUsername }
    }
  });
}

async function claimBonus(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const now = Date.now();
  const cooldown = cfg.economy.dailyCooldownHours * 60 * 60 * 1000;
  const dailyReadyAt = (player.lastDailyBonus || 0) + cooldown;
  const rescueReadyAt = (player.lastRescueBonus || 0) + cooldown;

  if (now >= dailyReadyAt) {
    player.balance += cfg.economy.dailyBonus;
    player.lastDailyBonus = now;
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), amount: cfg.economy.dailyBonus, kind: "daily" });
  }
  if (player.balance < cfg.economy.rescueThreshold && now >= rescueReadyAt) {
    player.balance += cfg.economy.rescueBonus;
    player.lastRescueBonus = now;
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), amount: cfg.economy.rescueBonus, kind: "rescue" });
  }
  json(res, 429, { error: "Bonus not ready yet", nextAt: player.balance < cfg.economy.rescueThreshold ? rescueReadyAt : dailyReadyAt });
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
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  const side = body.side === "tails" ? "tails" : "heads";
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);

  const win = rngInt(0, 10000) < cfg.coinflip.winChancePercent * 100;
  const result = win ? side : side === "heads" ? "tails" : "heads";
  const payout = win ? Math.floor(bet * cfg.coinflip.winMultiplier) : 0;
  applyRound(player, "coinflip", bet, payout, `${side} · landed ${result}`);

  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { result, side, win, bet, payout, net: payout - bet } });
}

async function playDice(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  let target = Math.round(Number(body.target) * 100) / 100;
  if (!Number.isFinite(target)) target = 50;
  target = Math.min(98, Math.max(2, target));
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);

  const roll = rngInt(0, 10000) / 100;
  const win = roll < target;
  const multiplier = Math.floor(((100 - cfg.dice.houseEdgePercent) / target) * 100) / 100;
  const payout = win ? Math.floor(bet * multiplier) : 0;
  applyRound(player, "dice", bet, payout, `roll ${roll.toFixed(2)} < ${target}`);

  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { roll, target, multiplier, win, bet, payout, net: payout - bet } });
}

async function playSlots(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);

  const strip = buildSlotStrip(cfg);
  const reels = [0, 1, 2].map(() => strip[rngInt(0, strip.length)]);
  let payout = 0;
  let line = "none";
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    payout = bet * (cfg.slots.triples[reels[0]] || 0);
    line = "triple";
  } else {
    const cherries = reels.filter((s) => s === "🍒").length;
    if (cherries === 2) { payout = bet * cfg.slots.twoCherry; line = "two-cherry"; }
    else if (cherries === 1) { payout = bet * cfg.slots.oneCherry; line = "one-cherry"; }
  }
  applyRound(player, "slots", bet, payout, `${reels.join(" ")} · ${line}`);

  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { reels, line, bet, payout, net: payout - bet, win: payout > bet } });
}

async function playRoulette(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bets = Array.isArray(body.bets) ? body.bets : [];
  if (!bets.length) return json(res, 400, { error: "Place at least one bet" });

  let total = 0;
  const placed = [];
  for (const b of bets) {
    const amount = parseBet(b.amount, cfg);
    if (amount === null) return badBet(res, cfg);
    const norm = normalizeRouletteBet(b.type, b.value);
    if (!norm) return json(res, 400, { error: "Invalid bet type" });
    total += amount;
    placed.push({ ...norm, amount });
  }
  if (total > player.balance) return notEnough(res);

  const result = rngInt(0, 37);
  let payout = 0;
  const details = placed.map((b) => {
    const win = rouletteWins(b, result);
    const winnings = win ? b.amount * (b.payout + 1) : 0;
    payout += winnings;
    return { type: b.type, value: b.value, amount: b.amount, win, winnings };
  });
  applyRound(player, "roulette", total, payout, `landed ${result} ${rouletteColor(result)}`);

  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { result, color: rouletteColor(result), bet: total, payout, net: payout - total, win: payout > total, details } });
}

async function crashStart(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  finalizeExpiredCrash(player);
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);

  const crashPoint = crashPointForEdge(cfg.crash.houseEdgePercent, cfg.crash.maxMultiplier);
  const startedAt = Date.now();
  player.balance -= bet;
  player.stats.wagered += bet;
  player.crashRound = { bet, crashPoint, startedAt, status: "flying" };
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), round: publicCrashRound(player.crashRound) });
}

async function crashState(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const round = player.crashRound;
  if (round && round.status === "flying" && crashMultiplierAt(round.startedAt) >= round.crashPoint) {
    const crashPoint = round.crashPoint;
    finishCrashLoss(player, round);
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), round: { status: "crashed", bet: round.bet, multiplier: crashPoint, crashPoint } });
  }
  json(res, 200, { player: publicPlayer(player), round: publicCrashRound(player.crashRound) });
}

async function crashCashout(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player } = ctx;
  const round = player.crashRound;
  if (!round || round.status !== "flying") return json(res, 400, { error: "No active crash round" });

  const multiplier = crashMultiplierAt(round.startedAt);
  if (multiplier >= round.crashPoint) {
    finishCrashLoss(player, round);
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), outcome: { crashed: true, crashPoint: round.crashPoint, bet: round.bet, payout: 0, net: -round.bet } });
  }

  const cashout = Math.floor(multiplier * 100) / 100;
  const payout = Math.floor(round.bet * cashout);
  player.balance += payout;
  player.stats.gamesPlayed += 1;
  const net = payout - round.bet;
  if (net > 0) { player.stats.won += net; if (net > player.stats.biggestWin) player.stats.biggestWin = net; }
  pushHistory(player, { game: "crash", bet: round.bet, payout, net, detail: `cashed ${cashout}x · crashed ${round.crashPoint}x` });
  player.crashRound = null;
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { crashed: false, multiplier: cashout, bet: round.bet, payout, net } });
}

/* -------------------------------- blackjack -------------------------------- */

async function blackjackDeal(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  if (bet === null) return badBet(res, cfg);
  if (player.bj && player.bj.status === "playing") return json(res, 400, { error: "Finish your current hand first" });
  if (bet > player.balance) return notEnough(res);

  player.balance -= bet;
  player.stats.wagered += bet;
  const deck = freshDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  player.bj = { deck, playerHand, dealerHand, bet, status: "playing", doubled: false };

  if (handValue(playerHand) === 21 || handValue(dealerHand) === 21) return finishBlackjack(store, player, cfg, res);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: blackjackView(player.bj) });
}

async function blackjackHit(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  if (!player.bj || player.bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  player.bj.playerHand.push(player.bj.deck.pop());
  if (handValue(player.bj.playerHand) >= 21) return finishBlackjack(store, player, cfg, res);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: blackjackView(player.bj) });
}

async function blackjackDouble(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const bj = player.bj;
  if (!bj || bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  if (bj.playerHand.length !== 2) return json(res, 400, { error: "Can only double on first two cards" });
  if (bj.bet > player.balance) return json(res, 400, { error: "Not enough chips to double" });
  player.balance -= bj.bet;
  player.stats.wagered += bj.bet;
  bj.bet *= 2;
  bj.doubled = true;
  bj.playerHand.push(bj.deck.pop());
  return finishBlackjack(store, player, cfg, res);
}

async function blackjackStand(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  if (!player.bj || player.bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  return finishBlackjack(store, player, cfg, res);
}

async function finishBlackjack(store, player, cfg, res) {
  const bj = player.bj;
  const playerVal = handValue(bj.playerHand);
  if (playerVal <= 21) {
    while (handValue(bj.dealerHand) < 17) bj.dealerHand.push(bj.deck.pop());
  }
  const dealerVal = handValue(bj.dealerHand);
  const playerBJ = bj.playerHand.length === 2 && playerVal === 21;
  const dealerBJ = bj.dealerHand.length === 2 && dealerVal === 21;

  let result;
  let payout = 0;
  if (playerVal > 21) result = "lose";
  else if (playerBJ && !dealerBJ) { result = "blackjack"; payout = Math.floor(bj.bet * (1 + cfg.blackjack.blackjackPayout)); }
  else if (dealerBJ && !playerBJ) result = "lose";
  else if (dealerVal > 21 || playerVal > dealerVal) { result = "win"; payout = bj.bet * 2; }
  else if (playerVal < dealerVal) result = "lose";
  else { result = "push"; payout = bj.bet; }

  player.balance += payout;
  bj.status = "done";
  bj.result = result;
  bj.payout = payout;

  const net = payout - bj.bet;
  player.stats.gamesPlayed += 1;
  if (net > 0) { player.stats.won += net; if (net > player.stats.biggestWin) player.stats.biggestWin = net; }
  pushHistory(player, { game: "blackjack", bet: bj.bet, payout, net, detail: `${result} · you ${playerVal} / dealer ${dealerVal}` });

  const view = blackjackView(bj, true);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: view });
}

/* ---------------------------------- admin --------------------------------- */

async function adminLogin(req, res) {
  if (!adminPassword) return json(res, 403, { error: "Admin is not configured (set CASINO_ADMIN_PASSWORD)" });
  const body = await readJson(req);
  const username = String(body.username || "");
  if (!safeEqual(username, adminUsername) || !safeEqual(String(body.password || ""), adminPassword)) {
    return json(res, 403, { error: "Wrong login or password" });
  }
  json(res, 200, { token: signToken({ type: "casino-admin" }) });
}

async function adminState(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  const cfg = mergeConfig(store.config);
  json(res, 200, {
    config: cfg,
    stats: adminStats(store),
    players: store.players.map(adminPlayerView)
  });
}

async function adminSaveConfig(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  if (!body.config || typeof body.config !== "object") return json(res, 400, { error: "Invalid config" });
  const store = await readStore();
  // Overlay the incoming values onto the current config so a partial save
  // never wipes unspecified fields back to defaults.
  store.config = sanitizeConfig(deepMerge(mergeConfig(store.config), body.config));
  await writeStore(store);
  json(res, 200, { config: mergeConfig(store.config) });
}

async function adminReset(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  store.config = defaultConfig();
  await writeStore(store);
  json(res, 200, { config: store.config });
}

async function adminUpdatePlayer(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  const store = await readStore();
  const player = store.players.find((p) => p.id === String(body.id || ""));
  if (!player) return json(res, 404, { error: "Player not found" });

  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (!name) return json(res, 400, { error: "Player name is required" });
    const key = playerKey(name);
    const taken = store.players.some((p) => p.id !== player.id && playerKey(p.name) === key);
    if (taken) return json(res, 409, { error: "Player name already exists" });
    player.name = name;
    player.nameKey = key;
  }
  if (body.balance !== undefined) player.balance = clampInt(body.balance, 0, 100_000_000);
  if (body.lastDailyBonus !== undefined) player.lastDailyBonus = clampInt(body.lastDailyBonus, 0, Number.MAX_SAFE_INTEGER);
  if (body.lastRescueBonus !== undefined) player.lastRescueBonus = clampInt(body.lastRescueBonus, 0, Number.MAX_SAFE_INTEGER);
  player.stats = {
    gamesPlayed: clampInt(body.stats?.gamesPlayed ?? player.stats?.gamesPlayed ?? 0, 0, 100_000_000),
    wagered: clampInt(body.stats?.wagered ?? player.stats?.wagered ?? 0, 0, 100_000_000_000),
    won: clampInt(body.stats?.won ?? player.stats?.won ?? 0, 0, 100_000_000_000),
    biggestWin: clampInt(body.stats?.biggestWin ?? player.stats?.biggestWin ?? 0, 0, 100_000_000_000)
  };
  if (body.clearHistory) player.history = [];
  if (body.clearBlackjack) player.bj = null;
  if (body.password) setPlayerPassword(player, String(body.password));

  await writeStore(store);
  json(res, 200, { player: adminPlayerView(player), stats: adminStats(store), players: store.players.map(adminPlayerView) });
}

async function adminDeletePlayer(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  const store = await readStore();
  const before = store.players.length;
  store.players = store.players.filter((p) => p.id !== String(body.id || ""));
  if (store.players.length === before) return json(res, 404, { error: "Player not found" });
  await writeStore(store);
  json(res, 200, { ok: true, stats: adminStats(store), players: store.players.map(adminPlayerView) });
}

async function adminResetPlayerResults(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null;
  for (const player of store.players) {
    if (ids && !ids.has(player.id)) continue;
    resetPlayerResults(player, Boolean(body.resetBalance), mergeConfig(store.config));
  }
  await writeStore(store);
  json(res, 200, { ok: true, stats: adminStats(store), players: store.players.map(adminPlayerView) });
}

async function adminDeleteAllPlayers(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  store.players = [];
  await writeStore(store);
  json(res, 200, { ok: true, stats: adminStats(store), players: [] });
}

// Clamp incoming config to safe ranges before persisting.
function sanitizeConfig(input) {
  const merged = mergeConfig(input);
  const e = merged.economy;
  e.startingBalance = clamp(e.startingBalance, 0, 10_000_000);
  e.minBet = clamp(e.minBet, 1, 1_000_000);
  e.maxBet = clamp(e.maxBet, e.minBet, 100_000_000);
  e.dailyBonus = clamp(e.dailyBonus, 0, 10_000_000);
  e.dailyCooldownHours = clamp(e.dailyCooldownHours, 1, 168);
  e.rescueBonus = clamp(e.rescueBonus, 0, 10_000_000);
  e.rescueThreshold = clamp(e.rescueThreshold, 0, 1_000_000);
  merged.coinflip.winChancePercent = clamp(merged.coinflip.winChancePercent, 1, 49);
  merged.coinflip.winMultiplier = clamp(merged.coinflip.winMultiplier, 1.01, 1.98);
  if ((merged.coinflip.winChancePercent / 100) * merged.coinflip.winMultiplier > 0.97) {
    merged.coinflip.winMultiplier = Math.floor((0.97 / (merged.coinflip.winChancePercent / 100)) * 100) / 100;
  }
  merged.dice.houseEdgePercent = clamp(merged.dice.houseEdgePercent, 1, 15);
  merged.crash.houseEdgePercent = clamp(merged.crash.houseEdgePercent, 1, 20);
  merged.crash.maxMultiplier = clamp(merged.crash.maxMultiplier, 2, 1000);
  merged.blackjack.blackjackPayout = clamp(merged.blackjack.blackjackPayout, 1.2, 1.5);
  for (const s of SLOT_SYMBOLS) {
    merged.slots.weights[s] = clamp(merged.slots.weights[s], 1, 100000);
    merged.slots.triples[s] = clamp(merged.slots.triples[s], 0, 150);
  }
  merged.slots.twoCherry = clamp(merged.slots.twoCherry, 0, 3);
  merged.slots.oneCherry = clamp(merged.slots.oneCherry, 0, 1);
  capSlotRtp(merged.slots, 0.94);
  merged.wheel.segments = merged.wheel.segments.slice(0, 16).map((s) => ({
    label: String(s.label || "?").slice(0, 8),
    multiplier: clamp(Number(s.multiplier), 0, 50),
    weight: clamp(Number(s.weight), 1, 100000),
    color: /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#38445f"
  }));
  if (!merged.wheel.segments.some((s) => s.weight > 0)) merged.wheel = defaultConfig().wheel;
  capWheelRtp(merged.wheel, 0.94);
  return merged;
}

function capWheelRtp(wheel, maxRtp) {
  const total = wheel.segments.reduce((sum, s) => sum + s.weight, 0);
  if (!total) return;
  const rtp = wheel.segments.reduce((sum, s) => sum + s.multiplier * s.weight, 0) / total;
  if (rtp <= maxRtp) return;
  const scale = maxRtp / rtp;
  wheel.segments = wheel.segments.map((s) => ({ ...s, multiplier: Math.floor(s.multiplier * scale * 100) / 100 }));
}

function capSlotRtp(slots, maxRtp) {
  const total = SLOT_SYMBOLS.reduce((sum, s) => sum + Math.max(0, Number(slots.weights[s]) || 0), 0);
  if (!total) return;
  let rtp = 0;
  for (const s of SLOT_SYMBOLS) {
    const p = (Math.max(0, Number(slots.weights[s]) || 0) / total) ** 3;
    rtp += p * (Number(slots.triples[s]) || 0);
  }
  const pc = Math.max(0, Number(slots.weights["🍒"]) || 0) / total;
  rtp += (3 * pc * (1 - pc) ** 2) * (Number(slots.oneCherry) || 0);
  rtp += (3 * pc ** 2 * (1 - pc)) * (Number(slots.twoCherry) || 0);
  if (rtp <= maxRtp) return;
  const scale = maxRtp / rtp;
  for (const s of SLOT_SYMBOLS) slots.triples[s] = Math.floor(slots.triples[s] * scale * 100) / 100;
  slots.twoCherry = Math.floor(slots.twoCherry * scale * 100) / 100;
  slots.oneCherry = Math.floor(slots.oneCherry * scale * 100) / 100;
}

// Deep-merge plain objects (arrays and primitives from `override` win).
function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override === undefined ? base : override;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    const o = override[key];
    out[key] = o && typeof o === "object" && !Array.isArray(o) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])
      ? deepMerge(out[key], o)
      : o;
  }
  return out;
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function clampInt(v, lo, hi) {
  return Math.floor(clamp(v, lo, hi));
}

function adminStats(store) {
  return {
    players: store.players.length,
    totalChips: store.players.reduce((a, p) => a + (p.balance || 0), 0),
    totalWagered: store.players.reduce((a, p) => a + (p.stats?.wagered || 0), 0)
  };
}

function adminPlayerView(player) {
  return {
    id: player.id,
    name: player.name,
    authProvider: player.telegramId ? "telegram" : "password",
    telegramUsername: player.telegramUsername || "",
    balance: player.balance || 0,
    createdAt: player.createdAt || "",
    lastDailyBonus: player.lastDailyBonus || 0,
    lastRescueBonus: player.lastRescueBonus || 0,
    stats: player.stats || { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    historyCount: Array.isArray(player.history) ? player.history.length : 0,
    hasBlackjack: Boolean(player.bj && player.bj.status === "playing")
  };
}

function resetPlayerResults(player, resetBalance, cfg) {
  player.stats = { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 };
  player.history = [];
  player.bj = null;
  if (resetBalance) player.balance = cfg.economy.startingBalance;
}

/* -------------------------------- helpers --------------------------------- */

function applyRound(player, game, bet, payout, detail) {
  player.balance += payout - bet;
  player.stats.gamesPlayed += 1;
  player.stats.wagered += bet;
  const net = payout - bet;
  if (net > 0) { player.stats.won += net; if (net > player.stats.biggestWin) player.stats.biggestWin = net; }
  pushHistory(player, { game, bet, payout, net, detail });
}

function pushHistory(player, entry) {
  player.history.unshift({ ...entry, at: new Date().toISOString() });
  if (player.history.length > HISTORY_LIMIT) player.history.length = HISTORY_LIMIT;
}

function parseBet(value, cfg) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < cfg.economy.minBet || n > cfg.economy.maxBet) return null;
  return n;
}
function badBet(res, cfg) {
  return json(res, 400, { error: `Bet must be between ${cfg.economy.minBet} and ${cfg.economy.maxBet} chips` });
}
function notEnough(res) { return json(res, 400, { error: "Not enough chips" }); }

function cleanName(value) {
  const name = String(value || "").trim().slice(0, 24);
  return /[^\s]/.test(name) ? name : "";
}

function playerKey(name) {
  return cleanName(name).toLowerCase();
}

function setPlayerPassword(player, password) {
  player.passwordSalt = crypto.randomBytes(16).toString("hex");
  player.passwordHash = hashPassword(password, player.passwordSalt);
  player.nameKey = playerKey(player.name);
}

function verifyPlayerPassword(player, password) {
  if (!player.passwordHash || !player.passwordSalt) return false;
  return safeEqual(player.passwordHash, hashPassword(password, player.passwordSalt));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

async function telegramApi(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Telegram API ${method} failed: ${text || response.status}`);
  }
  return response.json();
}

function upsertTelegramPlayer(store, cfg, telegram) {
  const telegramId = String(telegram.id);
  const fallback = [telegram.first_name, telegram.last_name].filter(Boolean).join(" ").trim() || telegram.username || `Telegram-${telegramId}`;
  const name = cleanName(fallback);
  let player = store.players.find((p) => String(p.telegramId || "") === telegramId);

  if (!player) {
    player = {
      id: crypto.randomUUID(),
      name,
      nameKey: playerKey(name),
      telegramId,
      telegramUsername: telegram.username || "",
      balance: cfg.economy.startingBalance,
      createdAt: new Date().toISOString(),
      lastDailyBonus: 0,
      lastRescueBonus: 0,
      stats: { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
      history: [],
      bj: null
    };
    store.players.push(player);
  } else {
    player.name = name || player.name;
    player.nameKey = playerKey(player.name);
    player.telegramUsername = telegram.username || player.telegramUsername || "";
  }
  return player;
}

function verifyTelegramAuth(data) {
  const fields = Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, String(value)])
  );
  if (!data.hash || !fields.id || !fields.auth_date) return { ok: false, error: "Telegram auth data is incomplete" };
  const age = Math.floor(Date.now() / 1000) - Number(fields.auth_date);
  if (!Number.isFinite(age) || age > 86400) return { ok: false, error: "Telegram login expired" };
  const checkString = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join("\n");
  const secret = crypto.createHash("sha256").update(telegramBotToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (!safeEqual(expected, String(data.hash))) return { ok: false, error: "Telegram login verification failed" };
  return { ok: true, user: fields };
}

function verifyTelegramWebApp(initData) {
  const params = new URLSearchParams(String(initData || ""));
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Telegram app data is incomplete" };
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (!Number.isFinite(age) || age > 86400) return { ok: false, error: "Telegram app login expired" };
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(telegramBotToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (!safeEqual(expected, hash)) return { ok: false, error: "Telegram app verification failed" };
  try {
    const user = JSON.parse(params.get("user") || "{}");
    if (!user.id) return { ok: false, error: "Telegram app user is missing" };
    return { ok: true, user };
  } catch {
    return { ok: false, error: "Telegram app user is invalid" };
  }
}

function buildSlotStrip(cfg) {
  const strip = [];
  for (const s of SLOT_SYMBOLS) {
    const w = Math.max(0, Math.floor(cfg.slots.weights[s] || 0));
    for (let i = 0; i < w; i++) strip.push(s);
  }
  return strip.length ? strip : [...SLOT_SYMBOLS];
}

function weightedPick(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return rngInt(0, weights.length);
  let r = rngInt(0, total);
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}

// Provably-fair-style crash point with a configurable house edge.
function crashPointForEdge(edgePercent, maxMultiplier) {
  const edge = clamp(edgePercent, 0, 90) / 100;
  // With probability = edge, instant crash at 1.00.
  if (rngInt(0, 10000) < edge * 10000) return 1.0;
  const r = rngInt(1, 1_000_000) / 1_000_000; // (0,1)
  const cp = Math.floor((1 / (1 - r)) * 100) / 100;
  return Math.max(1.01, Math.min(maxMultiplier, cp));
}

function crashMultiplierAt(startedAt) {
  const elapsed = Math.max(0, Date.now() - Number(startedAt || 0));
  const seconds = elapsed / 1000;
  return Math.floor((1 + Math.pow(seconds / 2.15, 1.42)) * 100) / 100;
}

function publicCrashRound(round) {
  if (!round || round.status !== "flying") return null;
  const multiplier = crashMultiplierAt(round.startedAt);
  const crashed = multiplier >= round.crashPoint;
  return {
    status: crashed ? "crashed" : "flying",
    bet: round.bet,
    startedAt: round.startedAt,
    multiplier: crashed ? round.crashPoint : multiplier,
    crashPoint: crashed ? round.crashPoint : undefined
  };
}

function finalizeExpiredCrash(player) {
  const round = player.crashRound;
  if (!round || round.status !== "flying") return false;
  if (crashMultiplierAt(round.startedAt) < round.crashPoint) return false;
  finishCrashLoss(player, round);
  return true;
}

function finishCrashLoss(player, round) {
  player.stats.gamesPlayed += 1;
  pushHistory(player, { game: "crash", bet: round.bet, payout: 0, net: -round.bet, detail: `crashed ${round.crashPoint}x` });
  player.crashRound = null;
}

/* roulette logic */
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function rouletteColor(n) { if (n === 0) return "green"; return RED_NUMBERS.has(n) ? "red" : "black"; }
function normalizeRouletteBet(type, value) {
  switch (type) {
    case "straight": { const n = Math.floor(Number(value)); if (!Number.isFinite(n) || n < 0 || n > 36) return null; return { type, value: n, payout: 35 }; }
    case "red": case "black": case "even": case "odd": case "low": case "high": return { type, value: type, payout: 1 };
    case "dozen": { const d = Math.floor(Number(value)); if (![1, 2, 3].includes(d)) return null; return { type, value: d, payout: 2 }; }
    case "column": { const c = Math.floor(Number(value)); if (![1, 2, 3].includes(c)) return null; return { type, value: c, payout: 2 }; }
    default: return null;
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
  for (let i = deck.length - 1; i > 0; i--) { const j = rngInt(0, i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function cardValue(r) { if (r === "A") return 11; if (r === "K" || r === "Q" || r === "J") return 10; return Number(r); }
function handValue(hand) {
  let total = 0, aces = 0;
  for (const c of hand) { total += cardValue(c.r); if (c.r === "A") aces += 1; }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}
function blackjackView(bj, reveal = false) {
  const playerVal = handValue(bj.playerHand);
  const view = { status: bj.status, bet: bj.bet, doubled: bj.doubled, playerHand: bj.playerHand, playerValue: playerVal, canDouble: bj.status === "playing" && bj.playerHand.length === 2 };
  if (bj.status === "playing" && !reveal) {
    view.dealerHand = [bj.dealerHand[0], { hidden: true }];
    view.dealerValue = cardValue(bj.dealerHand[0].r);
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

function rngInt(min, max) { return crypto.randomInt(min, max); }

/* ----------------------------- player context ----------------------------- */

async function loadPlayer(req, res) {
  const auth = requirePlayer(req);
  if (!auth.ok) { json(res, 401, { error: "Unauthorized" }); return null; }
  const store = await readStore();
  const player = store.players.find((p) => p.id === auth.payload.id);
  if (!player) { json(res, 401, { error: "Unauthorized" }); return null; }
  if (!player.stats) player.stats = { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 };
  if (!Array.isArray(player.history)) player.history = [];
  return { store, player, cfg: mergeConfig(store.config) };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    authProvider: player.telegramId ? "telegram" : "password",
    balance: player.balance,
    lastDailyBonus: player.lastDailyBonus || 0,
    lastRescueBonus: player.lastRescueBonus || 0,
    stats: player.stats || { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    history: player.history || [],
    blackjack: player.bj && player.bj.status === "playing" ? blackjackView(player.bj) : null,
    crashRound: publicCrashRound(player.crashRound)
  };
}

function requirePlayer(req) { const p = verifyToken(getBearer(req)); return p?.type === "player" ? { ok: true, payload: p } : { ok: false }; }
function requireAdmin(req) { const p = verifyToken(getBearer(req)); return p?.type === "casino-admin" ? { ok: true, payload: p } : { ok: false }; }
function getBearer(req) { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7) : ""; }

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
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a)), right = Buffer.from(String(b));
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
  migrateStore(store);
  return store;
}
async function writeStore(store) {
  if (githubToken && githubRepo) return writeGithubStore(store);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}
async function readGithubStore() {
  const current = await githubRequest("GET");
  if (current.status === 404) { const store = defaultStore(); await writeGithubStore(store); return store; }
  if (!current.ok) throw new Error(`GitHub store read failed: ${current.status}`);
  const data = await current.json();
  const store = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  if (!Array.isArray(store.players)) store.players = [];
  migrateStore(store);
  return store;
}
async function writeGithubStore(store) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await githubRequest("GET");
    const sha = current.ok ? (await current.json()).sha : undefined;
    const body = { message: "Update casino data", content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"), branch: githubBranch, ...(sha ? { sha } : {}) };
    const saved = await githubRequest("PUT", body);
    if (saved.ok) return;
    const detail = await saved.text();
    if (saved.status !== 409 || attempt === 2) throw new Error(`GitHub store write failed: ${saved.status} ${detail}`);
    await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
  }
}
function githubRequest(method, body) {
  return fetch(`https://api.github.com/repos/${githubRepo}/contents/${githubStorePath}${method === "GET" ? `?ref=${githubBranch}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 1_000_000) { req.destroy(); reject(new Error("Request too large")); } });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON")); } });
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

function defaultStore() { return { players: [], config: defaultConfig() }; }

function migrateStore(store) {
  for (const player of store.players) {
    if (!player.nameKey) player.nameKey = playerKey(player.name);
    if (!player.lastRescueBonus) player.lastRescueBonus = 0;
    if (!player.stats) player.stats = { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 };
    if (!Array.isArray(player.history)) player.history = [];
    finalizeExpiredCrash(player);
  }
  store.config = sanitizeConfig(store.config || defaultConfig());
  return store;
}

module.exports = {
  handleCasinoApi: handleApi,
  _internal: { handValue, freshDeck, rouletteWins, rouletteColor, normalizeRouletteBet, crashPointForEdge, crashMultiplierAt, weightedPick, mergeConfig, sanitizeConfig, defaultConfig }
};
