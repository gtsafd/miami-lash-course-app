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
const adminPassword = process.env.CASINO_ADMIN_PASSWORD || "";
const githubToken = process.env.GITHUB_TOKEN || "";
const githubRepo = process.env.GITHUB_REPO || "";
const githubBranch = process.env.GITHUB_BRANCH || "main";
const githubStorePath = process.env.GITHUB_CASINO_STORE_PATH || "private/casino.json";

const HISTORY_LIMIT = 25;
const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
const PLINKO_ROWS = 12;

/* --------------------------- configurable defaults ------------------------- */

function defaultConfig() {
  return {
    economy: { startingBalance: 1000, minBet: 1, maxBet: 100000, dailyBonus: 500, dailyCooldownHours: 20, rescueBonus: 250, rescueThreshold: 50 },
    coinflip: { winChancePercent: 50, winMultiplier: 2 },
    dice: { houseEdgePercent: 1 },
    slots: {
      weights: { "🍒": 28, "🍋": 24, "🔔": 18, "⭐": 14, "💎": 9, "7️⃣": 5 },
      triples: { "🍒": 4, "🍋": 6, "🔔": 12, "⭐": 25, "💎": 60, "7️⃣": 150 },
      twoCherry: 2, oneCherry: 1
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
    crash: { houseEdgePercent: 3, maxMultiplier: 1000 },
    blackjack: { blackjackPayout: 1.5 },
    mines: { houseEdgePercent: 2, maxMines: 24 },
    plinko: {
      rows: PLINKO_ROWS,
      risks: {
        low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
        medium: [22, 5, 2, 1.4, 1, 0.6, 0.4, 0.6, 1, 1.4, 2, 5, 22],
        high: [58, 10, 3, 1.4, 0.6, 0.3, 0.2, 0.3, 0.6, 1.4, 3, 10, 58]
      }
    }
  };
}

function mergeConfig(stored) {
  const def = defaultConfig();
  if (!stored || typeof stored !== "object") return def;
  const out = {};
  for (const key of Object.keys(def)) {
    if (key === "wheel") {
      out.wheel = stored.wheel && Array.isArray(stored.wheel.segments) && stored.wheel.segments.length ? { segments: stored.wheel.segments } : def.wheel;
    } else if (key === "slots") {
      out.slots = {
        weights: { ...def.slots.weights, ...(stored.slots?.weights || {}) },
        triples: { ...def.slots.triples, ...(stored.slots?.triples || {}) },
        twoCherry: num(stored.slots?.twoCherry, def.slots.twoCherry),
        oneCherry: num(stored.slots?.oneCherry, def.slots.oneCherry)
      };
    } else if (key === "plinko") {
      const r = stored.plinko?.risks || {};
      out.plinko = {
        rows: PLINKO_ROWS,
        risks: {
          low: validRisk(r.low) || def.plinko.risks.low,
          medium: validRisk(r.medium) || def.plinko.risks.medium,
          high: validRisk(r.high) || def.plinko.risks.high
        }
      };
    } else {
      out[key] = { ...def[key], ...(stored[key] || {}) };
    }
  }
  return out;
}
function validRisk(arr) {
  if (!Array.isArray(arr) || arr.length !== PLINKO_ROWS + 1) return null;
  if (!arr.every((n) => Number.isFinite(Number(n)) && n >= 0)) return null;
  return arr.map(Number);
}
function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

/* -------------------------------- routing --------------------------------- */

async function handleApi(req, res) {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});
    const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "POST" && pathname === "/api/casino/register") return register(req, res);
    if (req.method === "POST" && pathname === "/api/casino/login") return login(req, res);
    if (req.method === "POST" && pathname === "/api/casino/session") return guestSession(req, res);
    if (req.method === "GET" && pathname === "/api/casino/me") return me(req, res);
    if (req.method === "GET" && pathname === "/api/casino/config") return publicConfig(req, res);
    if (req.method === "POST" && pathname === "/api/casino/bonus") return claimBonus(req, res);
    if (req.method === "GET" && pathname === "/api/casino/leaderboard") return leaderboard(req, res);

    if (req.method === "POST" && pathname === "/api/casino/play/coinflip") return playCoinflip(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/dice") return playDice(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/slots") return playSlots(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/roulette") return playRoulette(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/wheel") return playWheel(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/crash") return playCrash(req, res);
    if (req.method === "POST" && pathname === "/api/casino/play/plinko") return playPlinko(req, res);

    if (req.method === "POST" && pathname === "/api/casino/mines/start") return minesStart(req, res);
    if (req.method === "POST" && pathname === "/api/casino/mines/reveal") return minesReveal(req, res);
    if (req.method === "POST" && pathname === "/api/casino/mines/cashout") return minesCashout(req, res);

    if (req.method === "POST" && pathname === "/api/casino/blackjack/deal") return blackjackDeal(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/hit") return blackjackHit(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/stand") return blackjackStand(req, res);
    if (req.method === "POST" && pathname === "/api/casino/blackjack/double") return blackjackDouble(req, res);

    if (req.method === "POST" && pathname === "/api/casino/admin/login") return adminLogin(req, res);
    if (req.method === "GET" && pathname === "/api/casino/admin/state") return adminState(req, res);
    if (req.method === "PUT" && pathname === "/api/casino/admin/config") return adminSaveConfig(req, res);
    if (req.method === "POST" && pathname === "/api/casino/admin/reset") return adminReset(req, res);

    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Server error" });
  }
}

/* ---------------------------------- auth ---------------------------------- */

function newPlayer(name, cfg, passHash) {
  return {
    id: crypto.randomUUID(),
    name,
    nameKey: name.toLowerCase(),
    passHash: passHash || "",
    balance: cfg.economy.startingBalance,
    createdAt: new Date().toISOString(),
    lastDailyBonus: 0,
    stats: { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    history: [],
    bj: null,
    mines: null
  };
}

async function register(req, res) {
  const body = await readJson(req);
  const name = cleanName(body.name);
  const password = String(body.password || "");
  if (!name || name.length < 3) return json(res, 400, { error: "Name must be at least 3 characters" });
  if (password.length < 4) return json(res, 400, { error: "Password must be at least 4 characters" });
  const store = await readStore();
  const cfg = mergeConfig(store.config);
  if (store.players.some((p) => (p.nameKey || p.name?.toLowerCase()) === name.toLowerCase())) {
    return json(res, 409, { error: "That name is already taken" });
  }
  const player = newPlayer(name, cfg, hashPassword(password));
  store.players.push(player);
  await writeStore(store);
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

async function login(req, res) {
  const body = await readJson(req);
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const store = await readStore();
  const player = store.players.find((p) => (p.nameKey || p.name?.toLowerCase()) === name.toLowerCase());
  if (!player || !player.passHash || !verifyPassword(password, player.passHash)) {
    return json(res, 403, { error: "Wrong name or password" });
  }
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

// Backwards-compatible anonymous guest (no password). Kept for quick play.
async function guestSession(req, res) {
  const body = await readJson(req);
  const store = await readStore();
  const cfg = mergeConfig(store.config);
  const auth = requirePlayer(req);
  if (auth.ok) {
    const existing = store.players.find((p) => p.id === auth.payload.id);
    if (existing) { await writeStore(store); return json(res, 200, { token: getBearer(req), player: publicPlayer(existing) }); }
  }
  const name = cleanName(body.name) || `Guest-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  const player = newPlayer(name, cfg, "");
  store.players.push(player);
  await writeStore(store);
  json(res, 200, { token: signToken({ type: "player", id: player.id }), player: publicPlayer(player) });
}

async function me(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  json(res, 200, { player: publicPlayer(ctx.player) });
}

async function publicConfig(req, res) {
  const store = await readStore();
  const cfg = mergeConfig(store.config);
  json(res, 200, {
    config: {
      economy: cfg.economy, coinflip: cfg.coinflip, dice: cfg.dice, slots: cfg.slots,
      wheel: cfg.wheel, crash: { maxMultiplier: cfg.crash.maxMultiplier }, blackjack: cfg.blackjack,
      mines: cfg.mines, plinko: cfg.plinko
    }
  });
}

async function claimBonus(req, res) {
  const ctx = await loadPlayer(req, res);
  if (!ctx) return;
  const { store, player, cfg } = ctx;
  const now = Date.now();
  const cooldown = cfg.economy.dailyCooldownHours * 3600000;
  if (now - (player.lastDailyBonus || 0) >= cooldown) {
    player.balance += cfg.economy.dailyBonus; player.lastDailyBonus = now;
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), amount: cfg.economy.dailyBonus, kind: "daily" });
  }
  if (player.balance < cfg.economy.rescueThreshold) {
    player.balance += cfg.economy.rescueBonus;
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), amount: cfg.economy.rescueBonus, kind: "rescue" });
  }
  json(res, 429, { error: "Bonus not ready yet", nextAt: (player.lastDailyBonus || 0) + cooldown });
}

async function leaderboard(req, res) {
  const store = await readStore();
  const top = [...store.players].sort((a, b) => b.balance - a.balance).slice(0, 10)
    .map((p) => ({ name: p.name, balance: p.balance, biggestWin: p.stats?.biggestWin || 0 }));
  json(res, 200, { leaderboard: top });
}

/* ---------------------------------- games --------------------------------- */

async function playCoinflip(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
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
  const ctx = await loadPlayer(req, res); if (!ctx) return;
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
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);
  const strip = buildSlotStrip(cfg);
  const reels = [0, 1, 2].map(() => strip[rngInt(0, strip.length)]);
  let payout = 0, line = "none";
  if (reels[0] === reels[1] && reels[1] === reels[2]) { payout = bet * (cfg.slots.triples[reels[0]] || 0); line = "triple"; }
  else { const ch = reels.filter((s) => s === "🍒").length; if (ch === 2) { payout = bet * cfg.slots.twoCherry; line = "two-cherry"; } else if (ch === 1) { payout = bet * cfg.slots.oneCherry; line = "one-cherry"; } }
  applyRound(player, "slots", bet, payout, `${reels.join(" ")} · ${line}`);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { reels, line, bet, payout, net: payout - bet, win: payout > bet } });
}

async function playRoulette(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bets = Array.isArray(body.bets) ? body.bets : [];
  if (!bets.length) return json(res, 400, { error: "Place at least one bet" });
  let total = 0; const placed = [];
  for (const b of bets) {
    const amount = parseBet(b.amount, cfg);
    if (amount === null) return badBet(res, cfg);
    const norm = normalizeRouletteBet(b.type, b.value);
    if (!norm) return json(res, 400, { error: "Invalid bet type" });
    total += amount; placed.push({ ...norm, amount });
  }
  if (total > player.balance) return notEnough(res);
  const result = rngInt(0, 37);
  let payout = 0;
  const details = placed.map((b) => { const win = rouletteWins(b, result); const w = win ? b.amount * (b.payout + 1) : 0; payout += w; return { type: b.type, value: b.value, amount: b.amount, win, winnings: w }; });
  applyRound(player, "roulette", total, payout, `landed ${result} ${rouletteColor(result)}`);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { result, color: rouletteColor(result), bet: total, payout, net: payout - total, win: payout > total, details } });
}

async function playWheel(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);
  const segments = cfg.wheel.segments;
  const index = weightedPick(segments.map((s) => Math.max(0, Number(s.weight) || 0)));
  const seg = segments[index];
  const multiplier = Number(seg.multiplier) || 0;
  const payout = Math.floor(bet * multiplier);
  applyRound(player, "wheel", bet, payout, `${seg.label} (${multiplier}x)`);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { index, label: seg.label, multiplier, bet, payout, net: payout - bet, win: payout > bet } });
}

async function playCrash(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  let target = Math.round(Number(body.target) * 100) / 100;
  if (!Number.isFinite(target) || target < 1.01) target = 2;
  target = Math.min(cfg.crash.maxMultiplier, target);
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);
  const crashPoint = crashPointForEdge(cfg.crash.houseEdgePercent, cfg.crash.maxMultiplier);
  const win = target <= crashPoint;
  const payout = win ? Math.floor(bet * target) : 0;
  applyRound(player, "crash", bet, payout, `target ${target}x · crashed ${crashPoint}x`);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { crashPoint, target, win, bet, payout, net: payout - bet } });
}

async function playPlinko(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  const risk = ["low", "medium", "high"].includes(body.risk) ? body.risk : "medium";
  if (bet === null) return badBet(res, cfg);
  if (bet > player.balance) return notEnough(res);
  const rows = cfg.plinko.rows;
  const path = [];
  let bin = 0;
  for (let i = 0; i < rows; i++) { const right = rngInt(0, 2) === 1; if (right) bin++; path.push(right ? "R" : "L"); }
  const table = cfg.plinko.risks[risk];
  const multiplier = Number(table[bin]) || 0;
  const payout = Math.floor(bet * multiplier);
  applyRound(player, "plinko", bet, payout, `${risk} · bin ${bin} (${multiplier}x)`);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), outcome: { path, bin, multiplier, risk, bet, payout, net: payout - bet, win: payout > bet } });
}

/* ---------------------------------- mines --------------------------------- */

async function minesStart(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  let mines = Math.floor(Number(body.mines));
  if (!Number.isFinite(mines)) mines = 3;
  mines = Math.min(cfg.mines.maxMines, Math.max(1, mines));
  if (bet === null) return badBet(res, cfg);
  if (player.mines && player.mines.status === "playing") return json(res, 400, { error: "Finish your current mines game first" });
  if (bet > player.balance) return notEnough(res);

  player.balance -= bet;
  player.stats.wagered += bet;
  const positions = new Set();
  while (positions.size < mines) positions.add(rngInt(0, 25));
  player.mines = { bet, mines, grid: [...Array(25)].map((_, i) => positions.has(i)), revealed: [], status: "playing" };
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), mines: minesView(player.mines, cfg) });
}

async function minesReveal(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const mg = player.mines;
  if (!mg || mg.status !== "playing") return json(res, 400, { error: "No mines game in progress" });
  const idx = Math.floor(Number(body.index));
  if (!Number.isFinite(idx) || idx < 0 || idx > 24) return json(res, 400, { error: "Invalid tile" });
  if (mg.revealed.includes(idx)) return json(res, 400, { error: "Tile already revealed" });

  if (mg.grid[idx]) {
    mg.status = "lost"; mg.hit = idx;
    player.stats.gamesPlayed += 1;
    pushHistory(player, { game: "mines", bet: mg.bet, payout: 0, net: -mg.bet, detail: `hit a mine after ${mg.revealed.length} safe` });
    await writeStore(store);
    return json(res, 200, { player: publicPlayer(player), mines: minesView(mg, cfg) });
  }
  mg.revealed.push(idx);
  const safeTotal = 25 - mg.mines;
  if (mg.revealed.length >= safeTotal) return finishMinesWin(store, player, cfg, res);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), mines: minesView(mg, cfg) });
}

async function minesCashout(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const mg = player.mines;
  if (!mg || mg.status !== "playing") return json(res, 400, { error: "No mines game in progress" });
  if (!mg.revealed.length) return json(res, 400, { error: "Reveal at least one tile first" });
  return finishMinesWin(store, player, cfg, res);
}

async function finishMinesWin(store, player, cfg, res) {
  const mg = player.mines;
  const mult = minesMultiplier(25, mg.mines, mg.revealed.length, cfg.mines.houseEdgePercent);
  const payout = Math.floor(mg.bet * mult);
  player.balance += payout;
  mg.status = "won"; mg.payout = payout; mg.multiplier = mult;
  const net = payout - mg.bet;
  player.stats.gamesPlayed += 1;
  if (net > 0) { player.stats.won += net; if (net > player.stats.biggestWin) player.stats.biggestWin = net; }
  pushHistory(player, { game: "mines", bet: mg.bet, payout, net, detail: `cashed ${mg.revealed.length} safe @ ${mult}x` });
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), mines: minesView(mg, cfg) });
}

function minesMultiplier(total, mines, safeRevealed, edge) {
  let m = 1;
  for (let i = 0; i < safeRevealed; i++) m *= (total - i) / (total - mines - i);
  return Math.max(1, Math.floor(m * (1 - edge / 100) * 100) / 100);
}

function minesView(mg, cfg) {
  const over = mg.status !== "playing";
  const safeTotal = 25 - mg.mines;
  const cur = minesMultiplier(25, mg.mines, mg.revealed.length, cfg.mines.houseEdgePercent);
  const next = mg.revealed.length < safeTotal ? minesMultiplier(25, mg.mines, mg.revealed.length + 1, cfg.mines.houseEdgePercent) : cur;
  return {
    status: mg.status, bet: mg.bet, mines: mg.mines,
    revealed: mg.revealed, safeCount: mg.revealed.length, safeTotal,
    currentMultiplier: cur, nextMultiplier: next,
    cashoutValue: Math.floor(mg.bet * cur),
    grid: over ? mg.grid : null, hit: mg.hit ?? null,
    payout: mg.payout ?? null, multiplier: mg.multiplier ?? null
  };
}

/* -------------------------------- blackjack -------------------------------- */

async function blackjackDeal(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const body = await readJson(req);
  const bet = parseBet(body.bet, cfg);
  if (bet === null) return badBet(res, cfg);
  if (player.bj && player.bj.status === "playing") return json(res, 400, { error: "Finish your current hand first" });
  if (bet > player.balance) return notEnough(res);
  player.balance -= bet; player.stats.wagered += bet;
  const deck = freshDeck();
  player.bj = { deck, playerHand: [deck.pop(), deck.pop()], dealerHand: [deck.pop(), deck.pop()], bet, status: "playing", doubled: false };
  if (handValue(player.bj.playerHand) === 21 || handValue(player.bj.dealerHand) === 21) return finishBlackjack(store, player, cfg, res);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: blackjackView(player.bj) });
}
async function blackjackHit(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  if (!player.bj || player.bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  player.bj.playerHand.push(player.bj.deck.pop());
  if (handValue(player.bj.playerHand) >= 21) return finishBlackjack(store, player, cfg, res);
  await writeStore(store);
  json(res, 200, { player: publicPlayer(player), blackjack: blackjackView(player.bj) });
}
async function blackjackDouble(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  const bj = player.bj;
  if (!bj || bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  if (bj.playerHand.length !== 2) return json(res, 400, { error: "Can only double on first two cards" });
  if (bj.bet > player.balance) return json(res, 400, { error: "Not enough chips to double" });
  player.balance -= bj.bet; player.stats.wagered += bj.bet; bj.bet *= 2; bj.doubled = true;
  bj.playerHand.push(bj.deck.pop());
  return finishBlackjack(store, player, cfg, res);
}
async function blackjackStand(req, res) {
  const ctx = await loadPlayer(req, res); if (!ctx) return;
  const { store, player, cfg } = ctx;
  if (!player.bj || player.bj.status !== "playing") return json(res, 400, { error: "No hand in progress" });
  return finishBlackjack(store, player, cfg, res);
}
async function finishBlackjack(store, player, cfg, res) {
  const bj = player.bj;
  const playerVal = handValue(bj.playerHand);
  if (playerVal <= 21) while (handValue(bj.dealerHand) < 17) bj.dealerHand.push(bj.deck.pop());
  const dealerVal = handValue(bj.dealerHand);
  const playerBJ = bj.playerHand.length === 2 && playerVal === 21;
  const dealerBJ = bj.dealerHand.length === 2 && dealerVal === 21;
  let result, payout = 0;
  if (playerVal > 21) result = "lose";
  else if (playerBJ && !dealerBJ) { result = "blackjack"; payout = Math.floor(bj.bet * (1 + cfg.blackjack.blackjackPayout)); }
  else if (dealerBJ && !playerBJ) result = "lose";
  else if (dealerVal > 21 || playerVal > dealerVal) { result = "win"; payout = bj.bet * 2; }
  else if (playerVal < dealerVal) result = "lose";
  else { result = "push"; payout = bj.bet; }
  player.balance += payout; bj.status = "done"; bj.result = result; bj.payout = payout;
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
  if (!safeEqual(String(body.password || ""), adminPassword)) return json(res, 403, { error: "Wrong password" });
  json(res, 200, { token: signToken({ type: "casino-admin" }) });
}
async function adminState(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  const cfg = mergeConfig(store.config);
  json(res, 200, { config: cfg, stats: { players: store.players.length, totalChips: store.players.reduce((a, p) => a + (p.balance || 0), 0), totalWagered: store.players.reduce((a, p) => a + (p.stats?.wagered || 0), 0) } });
}
async function adminSaveConfig(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  if (!body.config || typeof body.config !== "object") return json(res, 400, { error: "Invalid config" });
  const store = await readStore();
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

function sanitizeConfig(input) {
  const merged = mergeConfig(input);
  const e = merged.economy;
  e.startingBalance = clamp(e.startingBalance, 0, 10_000_000);
  e.minBet = clamp(e.minBet, 1, 1_000_000);
  e.maxBet = clamp(e.maxBet, e.minBet, 100_000_000);
  e.dailyBonus = clamp(e.dailyBonus, 0, 10_000_000);
  e.dailyCooldownHours = clamp(e.dailyCooldownHours, 0, 168);
  e.rescueBonus = clamp(e.rescueBonus, 0, 10_000_000);
  e.rescueThreshold = clamp(e.rescueThreshold, 0, 1_000_000);
  merged.coinflip.winChancePercent = clamp(merged.coinflip.winChancePercent, 0, 100);
  merged.coinflip.winMultiplier = clamp(merged.coinflip.winMultiplier, 1, 1000);
  merged.dice.houseEdgePercent = clamp(merged.dice.houseEdgePercent, 0, 90);
  merged.crash.houseEdgePercent = clamp(merged.crash.houseEdgePercent, 0, 90);
  merged.crash.maxMultiplier = clamp(merged.crash.maxMultiplier, 2, 1_000_000);
  merged.blackjack.blackjackPayout = clamp(merged.blackjack.blackjackPayout, 0.1, 100);
  merged.mines.houseEdgePercent = clamp(merged.mines.houseEdgePercent, 0, 90);
  merged.mines.maxMines = clamp(merged.mines.maxMines, 1, 24);
  for (const s of SLOT_SYMBOLS) { merged.slots.weights[s] = clamp(merged.slots.weights[s], 0, 100000); merged.slots.triples[s] = clamp(merged.slots.triples[s], 0, 100000); }
  merged.slots.twoCherry = clamp(merged.slots.twoCherry, 0, 100000);
  merged.slots.oneCherry = clamp(merged.slots.oneCherry, 0, 100000);
  merged.wheel.segments = merged.wheel.segments.slice(0, 16).map((s) => ({ label: String(s.label || "?").slice(0, 8), multiplier: clamp(Number(s.multiplier), 0, 100000), weight: clamp(Number(s.weight), 0, 100000), color: /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#38445f" }));
  if (!merged.wheel.segments.some((s) => s.weight > 0)) merged.wheel = defaultConfig().wheel;
  return merged;
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override === undefined ? base : override;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(override)) {
    const o = override[key];
    out[key] = o && typeof o === "object" && !Array.isArray(o) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key]) ? deepMerge(out[key], o) : o;
  }
  return out;
}
function clamp(v, lo, hi) { const n = Number(v); if (!Number.isFinite(n)) return lo; return Math.min(hi, Math.max(lo, n)); }

/* -------------------------------- helpers --------------------------------- */

function applyRound(player, game, bet, payout, detail) {
  player.balance += payout - bet;
  player.stats.gamesPlayed += 1;
  player.stats.wagered += bet;
  const net = payout - bet;
  if (net > 0) { player.stats.won += net; if (net > player.stats.biggestWin) player.stats.biggestWin = net; }
  pushHistory(player, { game, bet, payout, net, detail });
}
function pushHistory(player, entry) { player.history.unshift({ ...entry, at: new Date().toISOString() }); if (player.history.length > HISTORY_LIMIT) player.history.length = HISTORY_LIMIT; }
function parseBet(value, cfg) { const n = Math.floor(Number(value)); if (!Number.isFinite(n) || n < cfg.economy.minBet || n > cfg.economy.maxBet) return null; return n; }
function badBet(res, cfg) { return json(res, 400, { error: `Bet must be between ${cfg.economy.minBet} and ${cfg.economy.maxBet} chips` }); }
function notEnough(res) { return json(res, 400, { error: "Not enough chips" }); }
function cleanName(value) { const name = String(value || "").trim().slice(0, 24); return /[^\s]/.test(name) ? name : ""; }
function buildSlotStrip(cfg) { const strip = []; for (const s of SLOT_SYMBOLS) { const w = Math.max(0, Math.floor(cfg.slots.weights[s] || 0)); for (let i = 0; i < w; i++) strip.push(s); } return strip.length ? strip : [...SLOT_SYMBOLS]; }
function weightedPick(weights) { const total = weights.reduce((a, b) => a + b, 0); if (total <= 0) return rngInt(0, weights.length); let r = rngInt(0, total); for (let i = 0; i < weights.length; i++) { if (r < weights[i]) return i; r -= weights[i]; } return weights.length - 1; }
function crashPointForEdge(edgePercent, maxMultiplier) {
  const edge = clamp(edgePercent, 0, 90) / 100;
  if (rngInt(0, 10000) < edge * 10000) return 1.0;
  const r = rngInt(1, 1_000_000) / 1_000_000;
  return Math.max(1.01, Math.min(maxMultiplier, Math.floor((1 / (1 - r)) * 100) / 100));
}

/* password hashing */
function hashPassword(pw) { const salt = crypto.randomBytes(16).toString("hex"); const hash = crypto.scryptSync(pw, salt, 32).toString("hex"); return `${salt}:${hash}`; }
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(pw, salt, 32);
  const known = Buffer.from(hash, "hex");
  return calc.length === known.length && crypto.timingSafeEqual(calc, known);
}

/* roulette */
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
function freshDeck() { const deck = []; for (const s of SUITS) for (const r of RANKS) deck.push({ r, s }); for (let i = deck.length - 1; i > 0; i--) { const j = rngInt(0, i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
function cardValue(r) { if (r === "A") return 11; if (r === "K" || r === "Q" || r === "J") return 10; return Number(r); }
function handValue(hand) { let total = 0, aces = 0; for (const c of hand) { total += cardValue(c.r); if (c.r === "A") aces += 1; } while (total > 21 && aces > 0) { total -= 10; aces -= 1; } return total; }
function blackjackView(bj, reveal = false) {
  const playerVal = handValue(bj.playerHand);
  const view = { status: bj.status, bet: bj.bet, doubled: bj.doubled, playerHand: bj.playerHand, playerValue: playerVal, canDouble: bj.status === "playing" && bj.playerHand.length === 2 };
  if (bj.status === "playing" && !reveal) { view.dealerHand = [bj.dealerHand[0], { hidden: true }]; view.dealerValue = cardValue(bj.dealerHand[0].r); view.dealerHidden = true; }
  else { view.dealerHand = bj.dealerHand; view.dealerValue = handValue(bj.dealerHand); view.dealerHidden = false; view.result = bj.result; view.payout = bj.payout; }
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
    id: player.id, name: player.name, balance: player.balance,
    guest: !player.passHash,
    lastDailyBonus: player.lastDailyBonus || 0,
    stats: player.stats || { gamesPlayed: 0, wagered: 0, won: 0, biggestWin: 0 },
    history: player.history || [],
    blackjack: player.bj && player.bj.status === "playing" ? blackjackView(player.bj) : null,
    mines: player.mines && player.mines.status === "playing" ? minesView(player.mines, mergeConfig()) : null
  };
}
function requirePlayer(req) { const p = verifyToken(getBearer(req)); return p?.type === "player" ? { ok: true, payload: p } : { ok: false }; }
function requireAdmin(req) { const p = verifyToken(getBearer(req)); return p?.type === "casino-admin" ? { ok: true, payload: p } : { ok: false }; }
function getBearer(req) { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7) : ""; }
function signToken(payload) { const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url"); const sig = crypto.createHmac("sha256", tokenSecret).update(body).digest("base64url"); return `${body}.${sig}`; }
function verifyToken(token) { if (!token || !token.includes(".")) return null; const [body, sig] = token.split("."); const expected = crypto.createHmac("sha256", tokenSecret).update(body).digest("base64url"); if (!safeEqual(sig, expected)) return null; try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; } }
function safeEqual(a, b) { const l = Buffer.from(String(a)), r = Buffer.from(String(b)); if (l.length !== r.length) return false; return crypto.timingSafeEqual(l, r); }

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
  if (current.status === 404) { const store = defaultStore(); await writeGithubStore(store); return store; }
  if (!current.ok) throw new Error(`GitHub store read failed: ${current.status}`);
  const data = await current.json();
  const store = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  if (!Array.isArray(store.players)) store.players = [];
  store._sha = data.sha;
  return store;
}
async function writeGithubStore(store) {
  const sha = store._sha;
  delete store._sha;
  const body = { message: "Update casino data", content: Buffer.from(JSON.stringify(store, null, 2)).toString("base64"), branch: githubBranch, ...(sha ? { sha } : {}) };
  let saved = await githubRequest("PUT", body);
  if (saved.status === 409) { // sha conflict: refetch and retry once
    const cur = await githubRequest("GET");
    if (cur.ok) { body.sha = (await cur.json()).sha; saved = await githubRequest("PUT", body); }
  }
  if (!saved.ok) throw new Error(`GitHub store write failed: ${saved.status} ${await saved.text()}`);
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
    req.on("data", (c) => { body += c; if (body.length > 1_000_000) { req.destroy(); reject(new Error("Request too large")); } });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Cache-Control": "no-store" });
  res.end(status === 204 ? "" : JSON.stringify(payload));
}
function defaultStore() { return { players: [], config: defaultConfig() }; }

module.exports = {
  handleCasinoApi: handleApi,
  _internal: { handValue, freshDeck, rouletteWins, rouletteColor, normalizeRouletteBet, crashPointForEdge, weightedPick, mergeConfig, sanitizeConfig, defaultConfig, minesMultiplier, hashPassword, verifyPassword }
};
