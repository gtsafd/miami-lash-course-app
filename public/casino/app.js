const API = "/api/casino";
let token = localStorage.getItem("nc_token") || "";
let adminToken = localStorage.getItem("nc_admin") || "";
let player = null;
let config = null;
let currentGame = "slots";
let coinSide = "heads";
let roulChip = 5;
let roulBets = {};
let busy = false;
let roulRot = 0;
let fortuneRot = 0;
let lang = localStorage.getItem("nc_lang") || "en";
const SPEED = 1.35;

const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
const EURO_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_SET = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const rcolor = (n) => (n === 0 ? "green" : RED_SET.has(n) ? "red" : "black");
const colorHex = { green: "#1c8f5f", red: "#c0233f", black: "#1b2438" };

const I18N = {
  en: {
    "gate.title": "Virtual Casino",
    "gate.copy": "Slots, dice, coinflip, roulette, blackjack, wheel & crash — all on free virtual chips. No real money. Start with 1000 chips.",
    "gate.name": "Choose a player name",
    "gate.password": "Password",
    "gate.enter": "Enter the Casino",
    "gate.or": "or",
    "gate.telegramMissing": "Telegram login appears after TELEGRAM_BOT_USERNAME is configured.",
    "gate.note": "Virtual chips have no monetary value and cannot be purchased or cashed out.",
    "brand.subtitle": "Virtual Casino",
    "logout": "Exit",
    "tabs.slots": "Slots",
    "tabs.dice": "Dice",
    "tabs.coinflip": "Coinflip",
    "tabs.roulette": "Roulette",
    "tabs.blackjack": "Blackjack",
    "tabs.wheel": "Wheel",
    "tabs.crash": "Crash",
    "bonus.title": "🎁 Free Chips",
    "bonus.copy": "Claim a daily bonus, or a top-up if you go broke.",
    "bonus.claim": "Claim Bonus",
    "stats.title": "📊 Your Stats",
    "leaderboard.title": "🏆 Leaderboard",
    "history.title": "🧾 Recent Bets",
    "admin.title": "⚙ Casino Admin",
    "admin.copy": "Enter the admin password to configure odds & payouts.",
    "admin.pass": "Admin password",
    "admin.login": "Log in",
    "admin.close": "Close",
    "msg.needPassword": "Enter a name and password",
    "msg.notEnough": "Not enough chips",
    "msg.noBets": "No bets yet.",
    "msg.noPlayers": "No players yet.",
    "msg.loading": "Loading..."
  },
  ru: {
    "gate.title": "Виртуальное казино",
    "gate.copy": "Слоты, кости, монетка, рулетка, блэкджек, колесо и краш — только бесплатные виртуальные фишки. Без реальных денег. Старт: 1000 фишек.",
    "gate.name": "Имя игрока",
    "gate.password": "Пароль",
    "gate.enter": "Войти в казино",
    "gate.or": "или",
    "gate.telegramMissing": "Вход через Telegram появится после настройки TELEGRAM_BOT_USERNAME.",
    "gate.note": "Виртуальные фишки не имеют денежной стоимости, их нельзя купить или вывести.",
    "brand.subtitle": "Виртуальное казино",
    "logout": "Выйти",
    "tabs.slots": "Слоты",
    "tabs.dice": "Кости",
    "tabs.coinflip": "Монетка",
    "tabs.roulette": "Рулетка",
    "tabs.blackjack": "Блэкджек",
    "tabs.wheel": "Колесо",
    "tabs.crash": "Краш",
    "bonus.title": "🎁 Бесплатные фишки",
    "bonus.copy": "Забирай ежедневный бонус или пополнение, если фишки почти закончились.",
    "bonus.claim": "Забрать бонус",
    "stats.title": "📊 Твоя статистика",
    "leaderboard.title": "🏆 Таблица лидеров",
    "history.title": "🧾 Последние ставки",
    "admin.title": "⚙ Админка казино",
    "admin.copy": "Введи пароль админа, чтобы менять шансы и выплаты.",
    "admin.pass": "Пароль админа",
    "admin.login": "Войти",
    "admin.close": "Закрыть",
    "msg.needPassword": "Введи имя и пароль",
    "msg.notEnough": "Недостаточно фишек",
    "msg.noBets": "Ставок пока нет.",
    "msg.noPlayers": "Игроков пока нет.",
    "msg.loading": "Загрузка..."
  }
};

function t(key) { return I18N[lang]?.[key] || I18N.en[key] || key; }

function setLang(next) {
  lang = next === "ru" ? "ru" : "en";
  localStorage.setItem("nc_lang", lang);
  applyTranslations();
}

function setText(selector, key) {
  const el = document.querySelector(selector);
  if (el) el.textContent = t(key);
}

function applyTranslations() {
  document.documentElement.lang = lang;
  document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  setText(".gate-card h1", "gate.title");
  setText(".gate-card p", "gate.copy");
  $("nameInput").placeholder = t("gate.name");
  $("passwordInput").placeholder = t("gate.password");
  const divider = document.querySelector("#loginDivider span");
  if (divider) divider.textContent = t("gate.or");
  setText("#enterBtn", "gate.enter");
  setText(".muted-note", "gate.note");
  setText(".brand span", "brand.subtitle");
  setText("#logoutBtn", "logout");
  document.querySelector('[data-game="slots"]').lastChild.textContent = " " + t("tabs.slots");
  document.querySelector('[data-game="dice"]').lastChild.textContent = " " + t("tabs.dice");
  document.querySelector('[data-game="coinflip"]').lastChild.textContent = " " + t("tabs.coinflip");
  document.querySelector('[data-game="roulette"]').lastChild.textContent = " " + t("tabs.roulette");
  document.querySelector('[data-game="blackjack"]').lastChild.textContent = " " + t("tabs.blackjack");
  document.querySelector('[data-game="wheel"]').lastChild.textContent = " " + t("tabs.wheel");
  document.querySelector('[data-game="crash"]').lastChild.textContent = " " + t("tabs.crash");
  setText(".bonus-card h2", "bonus.title");
  setText(".bonus-card .sub", "bonus.copy");
  setText(".side .panel:nth-child(2) h2", "stats.title");
  setText(".side .panel:nth-child(3) h2", "leaderboard.title");
  setText(".side .panel:nth-child(4) h2", "history.title");
  setText("#adminModal h2", "admin.title");
  setText("#adminLoginView .sub", "admin.copy");
  $("adminPass").placeholder = t("admin.pass");
  setText("#adminLoginBtn", "admin.login");
  setText("#adminClose", "admin.close");
  if (player) renderBonus();
}

window.onTelegramAuth = async function onTelegramAuth(user) {
  try {
    const data = await api("/telegram", "POST", { telegram: user });
    token = data.token; localStorage.setItem("nc_token", token);
    setPlayer(data.player); showApp();
  } catch (e) { toast(e.message, "lose"); }
};

function mountTelegramLogin() {
  const wrap = $("telegramLogin");
  const username = config?.auth?.telegramBotUsername;
  wrap.innerHTML = "";
  if (!username) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.dataset.telegramLogin = username.replace(/^@/, "");
  script.dataset.size = "large";
  script.dataset.radius = "12";
  script.dataset.requestAccess = "write";
  script.dataset.onauth = "onTelegramAuth(user)";
  wrap.appendChild(script);
}

async function api(path, method = "GET", body, useAdmin) {
  const auth = useAdmin ? adminToken : token;
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + auth } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Error"), { status: res.status, data });
  return data;
}

function toast(msg, kind) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + (kind || "");
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = "toast"), 2600);
}

function setPlayer(p) {
  const prev = player ? player.balance : null;
  player = p;
  const bal = $("balance");
  bal.textContent = fmt(p.balance);
  if (prev !== null && p.balance !== prev) { bal.classList.remove("bump"); void bal.offsetWidth; bal.classList.add("bump"); }
  $("whoName").textContent = p.name;
  $("stGames").textContent = fmt(p.stats.gamesPlayed);
  $("stWagered").textContent = fmt(p.stats.wagered);
  $("stWon").textContent = fmt(p.stats.won);
  $("stBig").textContent = fmt(p.stats.biggestWin);
  renderHistory(p.history);
  renderBonus();
  if (p.blackjack) renderBlackjack(p.blackjack);
}

/* ---------- auth ---------- */
async function enter() {
  try {
    const name = $("nameInput").value.trim();
    const password = $("passwordInput").value;
    if (!name || !password) return toast(t("msg.needPassword"), "lose");
    const data = await api("/session", "POST", { name, password });
    token = data.token; localStorage.setItem("nc_token", token);
    setPlayer(data.player); showApp();
  } catch (e) { toast(e.message, "lose"); }
}
function showApp() { $("gate").classList.add("hidden"); $("app").classList.remove("hidden"); loadLeaderboard(); }
function logout() { localStorage.removeItem("nc_token"); token = ""; player = null; $("app").classList.add("hidden"); $("gate").classList.remove("hidden"); }

async function boot() {
  try { config = (await api("/config")).config; } catch { config = null; }
  applyConfig();
  if (token) {
    try { setPlayer((await api("/me")).player); showApp(); return; }
    catch { localStorage.removeItem("nc_token"); token = ""; }
  }
}

/* ---------- config-driven UI ---------- */
function applyConfig() {
  if (!config) return;
  // slots paytable
  const tr = config.slots.triples;
  $("slotsPaytable").innerHTML = [...SLOT_SYMBOLS].reverse()
    .map((s) => `<span>${s}${s}${s} <b>${tr[s]}×</b></span>`).join("") +
    `<span>🍒🍒 <b>${config.slots.twoCherry}×</b></span><span>🍒 <b>${config.slots.oneCherry}×</b></span>`;
  buildRoulette();
  buildFortune();
  mountTelegramLogin();
  updateDiceView();
}

/* ---------- bonus ---------- */
function renderBonus() {
  const btn = $("bonusBtn");
  const cd = (config?.economy.dailyCooldownHours ?? 20) * 3600000;
  const dailyReadyAt = (player.lastDailyBonus || 0) + cd;
  const rescueReadyAt = (player.lastRescueBonus || 0) + cd;
  const now = Date.now();
  if (now >= dailyReadyAt) { btn.disabled = false; btn.textContent = lang === "ru" ? `Ежедневный бонус (+${fmt(config?.economy.dailyBonus ?? 500)})` : `Claim Daily Bonus (+${fmt(config?.economy.dailyBonus ?? 500)})`; $("bonusTimer").textContent = lang === "ru" ? "Доступно сейчас!" : "Available now!"; }
  else if (player.balance < (config?.economy.rescueThreshold ?? 50) && now >= rescueReadyAt) { btn.disabled = false; btn.textContent = lang === "ru" ? `Спасательные фишки (+${fmt(config?.economy.rescueBonus ?? 250)})` : `Claim Rescue Chips (+${fmt(config?.economy.rescueBonus ?? 250)})`; $("bonusTimer").textContent = lang === "ru" ? "У тебя мало фишек." : "You're low on chips."; }
  else {
    btn.disabled = true;
    btn.textContent = lang === "ru" ? "Бонус недоступен" : "Bonus locked";
    const readyAt = player.balance < (config?.economy.rescueThreshold ?? 50) ? rescueReadyAt : dailyReadyAt;
    const ms = readyAt - now;
    $("bonusTimer").textContent = lang === "ru" ? `Следующий бонус через ${Math.floor(ms/3600000)}ч ${Math.floor((ms%3600000)/60000)}м` : `Next bonus in ${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`;
  }
}
async function claimBonus() {
  try { const d = await api("/bonus", "POST", {}); setPlayer(d.player); toast(`+${fmt(d.amount)} chips!`, "win"); }
  catch (e) { toast(e.status === 429 ? "Bonus not ready yet" : e.message, e.status === 429 ? "" : "lose"); }
}

/* ---------- tabs & bets ---------- */
function switchGame(game) {
  currentGame = game;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.game === game));
  document.querySelectorAll(".game").forEach((g) => g.classList.toggle("hidden", g.dataset.game !== game));
}
function betValue(game) { return Math.max(1, Math.floor(Number(document.querySelector(`.betInput[data-bet="${game}"]`).value) || 0)); }
function setBet(game, v) { document.querySelector(`.betInput[data-bet="${game}"]`).value = Math.max(1, Math.floor(v)); }
function wireQuickChips() {
  document.querySelectorAll(".chips-quick").forEach((box) => {
    const game = box.dataset.target;
    box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.set === "max") setBet(game, player ? player.balance : 1);
      else setBet(game, betValue(game) + Number(b.dataset.add));
    }));
  });
}
function affordable(bet) { if (bet > player.balance) { toast(t("msg.notEnough"), "lose"); return false; } return true; }

/* ---------- slots ---------- */
function spinReel(reelEl, finalSymbol, duration) {
  return new Promise((resolve) => {
    const strip = reelEl.querySelector(".reel-strip");
    const H = 110;
    const count = 32 + Math.floor(Math.random() * 8);
    let cells = "";
    for (let i = 0; i < count; i++) cells += `<div class="reel-sym">${SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]}</div>`;
    cells += `<div class="reel-sym">${finalSymbol}</div>`;
    strip.innerHTML = cells;
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";
    void strip.offsetHeight;
    strip.style.transition = `transform ${duration}ms cubic-bezier(.16,.84,.27,1)`;
    strip.style.transform = `translateY(${-count * H}px)`;
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    strip.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, duration + 120);
  });
}
async function spinSlots() {
  if (busy) return;
  const bet = betValue("slots");
  if (!affordable(bet)) return;
  busy = true; $("spinBtn").disabled = true; $("slotsResult").textContent = "";
  try {
    const data = await api("/play/slots", "POST", { bet });
    const o = data.outcome;
    const reels = [$("reel0"), $("reel1"), $("reel2")];
    await Promise.all(reels.map((r, i) => spinReel(r, o.reels[i], Math.round((1900 + i * 650) * SPEED))));
    setPlayer(data.player);
    if (o.win) reels.forEach((r) => { r.classList.remove("winflash"); void r.offsetWidth; r.classList.add("winflash"); });
    showOutcome("slotsResult", o, o.win ? `You won ${fmt(o.payout)}!` : (o.payout === o.bet ? "Bet returned" : "No match"));
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("spinBtn").disabled = false;
}

/* ---------- dice ---------- */
function updateDiceView() {
  const t = Number($("diceSlider").value);
  const edge = config?.dice.houseEdgePercent ?? 1;
  $("diceTargetView").textContent = t.toFixed(2);
  $("diceMult").textContent = (Math.floor(((100 - edge) / t) * 100) / 100).toFixed(2) + "×";
  $("diceChance").textContent = t.toFixed(0) + "%";
}
async function rollDice() {
  if (busy) return;
  const bet = betValue("dice");
  if (!affordable(bet)) return;
  busy = true; $("rollBtn").disabled = true;
  try {
    const data = await api("/play/dice", "POST", { bet, target: Number($("diceSlider").value) });
    const o = data.outcome;
    $("diceRoll").textContent = o.roll.toFixed(2);
    $("diceRoll").className = o.win ? "win" : "lose";
    setPlayer(data.player);
    showOutcome("diceResult", o, `Rolled ${o.roll.toFixed(2)} — ${o.win ? "win " + fmt(o.payout) : "loss"}`);
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("rollBtn").disabled = false;
}

/* ---------- coinflip ---------- */
async function flipCoin() {
  if (busy) return;
  const bet = betValue("coinflip");
  if (!affordable(bet)) return;
  busy = true; $("flipBtn").disabled = true; $("coinResult").textContent = "";
  const inner = $("coinInner");
  try {
    const data = await api("/play/coinflip", "POST", { bet, side: coinSide });
    const o = data.outcome;
    // base spin + half turn if result is tails so the right face shows
    const base = 1980 + (o.result === "tails" ? 180 : 0);
    inner.style.transition = "none"; inner.style.transform = "rotateY(0deg)"; void inner.offsetWidth;
    inner.style.transition = `transform ${Math.round(1700 * SPEED)}ms cubic-bezier(.3,.1,.2,1)`;
    inner.style.transform = `rotateY(${base}deg)`;
    await wait(Math.round(1750 * SPEED));
    setPlayer(data.player);
    showOutcome("coinResult", o, `${o.result.toUpperCase()} — ${o.win ? "you won " + fmt(o.payout) : "you lost"}`);
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("flipBtn").disabled = false;
}

/* ---------- roulette ---------- */
function buildRoulette() {
  const disc = $("roulDisc");
  const n = EURO_ORDER.length, seg = 360 / n, R = 112;
  let stops = [];
  EURO_ORDER.forEach((num, i) => stops.push(`${colorHex[rcolor(num)]} ${i * seg}deg ${(i + 1) * seg}deg`));
  disc.style.background = `conic-gradient(${stops.join(",")})`;
  disc.querySelectorAll(".wheel-num-label").forEach((e) => e.remove());
  EURO_ORDER.forEach((num, i) => {
    const a = i * seg + seg / 2;
    const el = document.createElement("div");
    el.className = "wheel-num-label";
    el.textContent = num;
    el.style.transform = `translate(-50%,-50%) rotate(${a}deg) translateY(-${R}px) rotate(${-a}deg)`;
    disc.appendChild(el);
  });
  // betting board
  const wrap = $("roulBets");
  const cells = [];
  for (let num = 0; num <= 36; num++) cells.push({ key: "s" + num, type: "straight", value: num, label: String(num), cls: num === 0 ? "" : (RED_SET.has(num) ? "r" : "b") });
  const outside = [["red","Red","r"],["black","Black","b"],["even","Even",""],["odd","Odd",""],["low","1-18",""],["high","19-36",""],["dozen","1st 12","",1],["dozen","2nd 12","",2],["dozen","3rd 12","",3],["column","Col 1","",1],["column","Col 2","",2],["column","Col 3","",3]];
  outside.forEach(([type,label,cls,val]) => cells.push({ key: type + (val||""), type, value: val ?? type, label, cls }));
  wrap.innerHTML = "";
  cells.forEach((c) => {
    const b = document.createElement("button");
    b.className = c.cls; b.dataset.key = c.key;
    b.innerHTML = `${c.label}<span class="stake hidden"></span>`;
    b.addEventListener("click", () => placeRoulChip(c, b));
    wrap.appendChild(b);
  });
}
function placeRoulChip(c, btn) {
  const ex = roulBets[c.key] || { type: c.type, value: c.value, amount: 0 };
  ex.amount += roulChip; roulBets[c.key] = ex;
  const s = btn.querySelector(".stake"); s.textContent = ex.amount; s.classList.remove("hidden");
  updateRoulTotal();
}
function updateRoulTotal() { $("roulTotal").textContent = fmt(Object.values(roulBets).reduce((a, b) => a + b.amount, 0)); }
function clearRoul() { roulBets = {}; document.querySelectorAll("#roulBets .stake").forEach((s) => { s.textContent = ""; s.classList.add("hidden"); }); updateRoulTotal(); }
async function spinRoulette() {
  if (busy) return;
  const bets = Object.values(roulBets);
  if (!bets.length) return toast("Place at least one bet", "");
  const total = bets.reduce((a, b) => a + b.amount, 0);
  if (!affordable(total)) return;
  busy = true; $("roulSpinBtn").disabled = true; $("roulResult").textContent = "";
  try {
    const data = await api("/play/roulette", "POST", { bets });
    const o = data.outcome;
    const n = EURO_ORDER.length, seg = 360 / n;
    const idx = EURO_ORDER.indexOf(o.result);
    const targetDeg = ((-(idx * seg + seg / 2)) % 360 + 360) % 360;
    roulRot = Math.ceil((roulRot + 5 * 360 - targetDeg) / 360) * 360 + targetDeg;
    $("roulDisc").style.transform = `rotate(${roulRot}deg)`;
    await wait(Math.round(6100 * SPEED));
    $("roulHub").textContent = o.result;
    $("roulHub").style.color = o.color === "black" ? "#fff" : colorHex[o.color];
    setPlayer(data.player);
    showOutcome("roulResult", o, `${o.result} ${o.color} — ${o.win ? "won " + fmt(o.payout) : "no win"}`);
    clearRoul();
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("roulSpinBtn").disabled = false;
}

/* ---------- wheel of fortune ---------- */
function buildFortune() {
  const disc = $("fortuneDisc");
  const segs = config?.wheel.segments || [];
  const n = segs.length || 1, seg = 360 / n, R = 96;
  let stops = segs.map((s, i) => `${s.color} ${i * seg}deg ${(i + 1) * seg}deg`);
  disc.style.background = `conic-gradient(${stops.join(",")})`;
  disc.querySelectorAll(".fortune-label").forEach((e) => e.remove());
  segs.forEach((s, i) => {
    const a = i * seg + seg / 2;
    const el = document.createElement("div");
    el.className = "fortune-label"; el.textContent = s.label;
    el.style.color = "#0b0f1a";
    el.style.transform = `translate(-50%,-50%) rotate(${a}deg) translateY(-${R}px) rotate(${-a}deg)`;
    disc.appendChild(el);
  });
}
async function spinFortune() {
  if (busy) return;
  const bet = betValue("wheel");
  if (!affordable(bet)) return;
  busy = true; $("wheelSpinBtn").disabled = true; $("wheelResult").textContent = "";
  try {
    const data = await api("/play/wheel", "POST", { bet });
    const o = data.outcome;
    const segs = config.wheel.segments, n = segs.length, seg = 360 / n;
    const targetDeg = ((-(o.index * seg + seg / 2)) % 360 + 360) % 360;
    fortuneRot = Math.ceil((fortuneRot + 5 * 360 - targetDeg) / 360) * 360 + targetDeg;
    $("fortuneDisc").style.transform = `rotate(${fortuneRot}deg)`;
    await wait(Math.round(6100 * SPEED));
    setPlayer(data.player);
    showOutcome("wheelResult", o, `${o.label} — ${o.win ? "won " + fmt(o.payout) : (o.multiplier === 1 ? "bet returned" : "no win")}`);
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("wheelSpinBtn").disabled = false;
}

/* ---------- crash ---------- */
async function playCrash() {
  if (busy) return;
  const bet = betValue("crash");
  if (!affordable(bet)) return;
  let target = Math.round(Number($("crashTarget").value) * 100) / 100;
  if (!Number.isFinite(target) || target < 1.01) target = 1.01;
  busy = true; $("crashBtn").disabled = true; $("crashResult").textContent = "";
  $("crashTag").textContent = `Target: ${target.toFixed(2)}×`;
  const mult = $("crashMult"), rocket = $("crashRocket");
  mult.classList.remove("boom"); mult.textContent = "1.00×";
  try {
    const data = await api("/play/crash", "POST", { bet, target });
    const o = data.outcome;
    const endM = o.win ? target : o.crashPoint;
    const dur = Math.round(Math.min(6500, Math.max(1200, 1100 + 950 * Math.log(endM))) * SPEED);
    await animateCrash(endM, dur, mult, rocket);
    if (o.win) { mult.textContent = `${target.toFixed(2)}×`; }
    else { mult.classList.add("boom"); mult.textContent = `💥 ${o.crashPoint.toFixed(2)}×`; rocket.textContent = "💥"; }
    setPlayer(data.player);
    showOutcome("crashResult", o, o.win ? `Cashed out at ${target.toFixed(2)}× — won ${fmt(o.payout)}` : `Crashed at ${o.crashPoint.toFixed(2)}× — lost ${fmt(bet)}`);
    await wait(700); rocket.textContent = "🚀";
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("crashBtn").disabled = false;
}
function animateCrash(endM, dur, mult, rocket) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      let p = Math.min(1, (now - start) / dur);
      const ease = Math.pow(p, 1.7);
      const m = 1 + (endM - 1) * ease;
      mult.textContent = `${m.toFixed(2)}×`;
      rocket.style.left = (8 + ease * 78) + "%";
      rocket.style.bottom = (4 + ease * 72) + "%";
      if (p < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

/* ---------- blackjack ---------- */
function cardEl(c) {
  const d = document.createElement("div");
  if (c.hidden) { d.className = "card back"; return d; }
  const red = c.s === "♥" || c.s === "♦";
  d.className = "card" + (red ? " red" : "");
  d.innerHTML = `<span>${c.r}${c.s}</span><span class="b">${c.r}${c.s}</span>`;
  return d;
}
function renderBlackjack(bj) {
  const dc = $("dealerCards"), pc = $("playerCards");
  dc.innerHTML = ""; pc.innerHTML = "";
  bj.dealerHand.forEach((c) => dc.appendChild(cardEl(c)));
  bj.playerHand.forEach((c) => pc.appendChild(cardEl(c)));
  $("dealerVal").textContent = bj.dealerHidden ? bj.dealerValue + " + ?" : bj.dealerValue;
  $("playerVal").textContent = bj.playerValue;
  const playing = bj.status === "playing";
  $("bjActions").classList.toggle("hidden", !playing);
  $("bjBetRow").classList.toggle("hidden", playing);
  $("doubleBtn").disabled = !bj.canDouble;
  if (bj.status === "done") {
    const map = { win: ["You win!", "win"], blackjack: ["Blackjack!", "win"], lose: ["Dealer wins", "lose"], push: ["Push — bet returned", "neutral"] };
    const [msg, cls] = map[bj.result] || ["", "neutral"];
    const r = $("bjResult"); r.textContent = msg; r.className = "result-line " + cls;
    if (cls === "win") toast(msg + " +" + fmt(bj.payout), "win"); else if (cls === "lose") toast(msg, "lose");
  }
}
async function bjAction(path, body) {
  if (busy) return; busy = true;
  try { const d = await api("/blackjack/" + path, "POST", body); setPlayer(d.player); renderBlackjack(d.blackjack); }
  catch (e) { toast(e.message, "lose"); }
  busy = false;
}
function dealBlackjack() { const bet = betValue("blackjack"); if (!affordable(bet)) return; $("bjResult").textContent = ""; bjAction("deal", { bet }); }

/* ---------- shared ---------- */
function showOutcome(elId, o, msg) {
  const el = $(elId);
  el.textContent = msg;
  el.className = "result-line " + (o.win ? "win" : (o.net === 0 ? "neutral" : "lose"));
  if (o.win) toast(msg, "win");
  loadLeaderboard();
}
function renderHistory(hist) {
  const wrap = $("history");
  if (!hist || !hist.length) { wrap.innerHTML = '<div class="neutral" style="font-size:13px;">No bets yet.</div>'; return; }
  wrap.innerHTML = hist.slice(0, 12).map((h) => {
    const sign = h.net > 0 ? "+" : ""; const cls = h.net > 0 ? "pos" : (h.net < 0 ? "neg" : "");
    return `<div class="hist-row"><span class="g">${h.game}</span><span class="n ${cls}">${sign}${fmt(h.net)}</span></div>`;
  }).join("");
}
async function loadLeaderboard() {
  try {
    const data = await api("/leaderboard");
    const wrap = $("leaderboard");
    if (!data.leaderboard.length) { wrap.innerHTML = '<div class="neutral" style="font-size:13px;">No players yet.</div>'; return; }
    wrap.innerHTML = data.leaderboard.map((p, i) => `<div class="lb-row"><span><span class="lb-rank">${i+1}</span>${escapeHtml(p.name)}</span><span style="color:var(--gold);font-weight:700;">🪙 ${fmt(p.balance)}</span></div>`).join("");
  } catch {}
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------- admin ---------- */
function openAdmin() {
  $("adminModal").classList.remove("hidden");
  if (adminToken) loadAdmin(); else { $("adminLoginView").classList.remove("hidden"); $("adminPanel").classList.add("hidden"); }
}
function closeAdmin() { $("adminModal").classList.add("hidden"); }
async function adminLogin() {
  $("adminLoginErr").textContent = "";
  try {
    const d = await api("/admin/login", "POST", { password: $("adminPass").value });
    adminToken = d.token; localStorage.setItem("nc_admin", adminToken);
    loadAdmin();
  } catch (e) { $("adminLoginErr").textContent = e.message; }
}
async function loadAdmin() {
  try {
    const d = await api("/admin/state", "GET", null, true);
    $("adminLoginView").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    renderAdmin(d.config, d.stats);
  } catch (e) {
    adminToken = ""; localStorage.removeItem("nc_admin");
    $("adminLoginView").classList.remove("hidden"); $("adminPanel").classList.add("hidden");
    if (e.status !== 401) $("adminLoginErr").textContent = e.message;
  }
}
function numInput(k, val, step) { return `<label>${k.split(".").pop()}<input type="number" data-k="${k}" value="${val}" step="${step || 1}" /></label>`; }
function renderAdmin(c, stats) {
  const p = $("adminPanel");
  let wheelRows = c.wheel.segments.map((s, i) => `
    <div class="wheel-edit-row" data-seg="${i}">
      <input type="text" data-seg-f="label" value="${escapeHtml(s.label)}" placeholder="label" />
      <input type="number" data-seg-f="multiplier" value="${s.multiplier}" step="0.1" placeholder="mult" />
      <input type="number" data-seg-f="weight" value="${s.weight}" placeholder="weight" />
      <input type="color" data-seg-f="color" value="${s.color}" />
      <button class="btn danger sm" data-seg-del="${i}">✕</button>
    </div>`).join("");
  const slotRows = SLOT_SYMBOLS.map((s) => `<label>${s} weight<input type="number" data-k="slots.weights.${s}" value="${c.slots.weights[s]}" /></label><label>${s} 3×pay<input type="number" data-k="slots.triples.${s}" value="${c.slots.triples[s]}" /></label>`).join("");
  p.innerHTML = `
    <div class="admin-stats">
      <div><b>${fmt(stats.players)}</b><span>Players</span></div>
      <div><b>${fmt(stats.totalChips)}</b><span>Total chips</span></div>
      <div><b>${fmt(stats.totalWagered)}</b><span>Total wagered</span></div>
    </div>
    <div class="admin-sec"><h3>Economy</h3><div class="admin-grid">
      ${numInput("economy.startingBalance", c.economy.startingBalance)}
      ${numInput("economy.minBet", c.economy.minBet)}
      ${numInput("economy.maxBet", c.economy.maxBet)}
      ${numInput("economy.dailyBonus", c.economy.dailyBonus)}
      ${numInput("economy.dailyCooldownHours", c.economy.dailyCooldownHours)}
      ${numInput("economy.rescueBonus", c.economy.rescueBonus)}
      ${numInput("economy.rescueThreshold", c.economy.rescueThreshold)}
    </div></div>
    <div class="admin-sec"><h3>Coinflip / Dice / Crash / Blackjack chances</h3><div class="admin-grid">
      ${numInput("coinflip.winChancePercent", c.coinflip.winChancePercent)}
      ${numInput("coinflip.winMultiplier", c.coinflip.winMultiplier, 0.01)}
      ${numInput("dice.houseEdgePercent", c.dice.houseEdgePercent, 0.1)}
      ${numInput("crash.houseEdgePercent", c.crash.houseEdgePercent, 0.1)}
      ${numInput("crash.maxMultiplier", c.crash.maxMultiplier)}
      ${numInput("blackjack.blackjackPayout", c.blackjack.blackjackPayout, 0.1)}
    </div></div>
    <div class="admin-sec"><h3>Slots weights &amp; payouts</h3><div class="admin-grid">${slotRows}
      ${numInput("slots.twoCherry", c.slots.twoCherry)}${numInput("slots.oneCherry", c.slots.oneCherry)}
    </div></div>
    <div class="admin-sec"><h3>Wheel of Fortune segments</h3><div id="wheelEdit">${wheelRows}</div>
      <button class="btn ghost sm" id="addSegBtn">+ Add segment</button>
      <p class="sub" style="margin:8px 0 0;">Higher weight = more likely. Multiplier 0 = lose, 2 = double, etc.</p>
    </div>
    <div class="admin-actions">
      <button class="btn" id="adminSaveBtn">Save changes</button>
      <button class="btn ghost" id="adminResetBtn">Reset to defaults</button>
      <button class="adm-link" id="adminLogoutBtn">Log out of admin</button>
    </div>`;
  $("addSegBtn").addEventListener("click", () => addSegRow());
  $("adminSaveBtn").addEventListener("click", saveAdmin);
  $("adminResetBtn").addEventListener("click", resetAdmin);
  $("adminLogoutBtn").addEventListener("click", () => { adminToken = ""; localStorage.removeItem("nc_admin"); $("adminPanel").classList.add("hidden"); $("adminLoginView").classList.remove("hidden"); });
  p.querySelectorAll("[data-seg-del]").forEach((b) => b.addEventListener("click", () => { b.closest(".wheel-edit-row").remove(); }));
}
function addSegRow() {
  const wrap = $("wheelEdit");
  const div = document.createElement("div");
  div.className = "wheel-edit-row";
  div.innerHTML = `<input type="text" data-seg-f="label" value="2x" /><input type="number" data-seg-f="multiplier" value="2" step="0.1" /><input type="number" data-seg-f="weight" value="10" /><input type="color" data-seg-f="color" value="#9d7bff" /><button class="btn danger sm">✕</button>`;
  div.querySelector("button").addEventListener("click", () => div.remove());
  wrap.appendChild(div);
}
function collectConfig() {
  const cfg = JSON.parse(JSON.stringify(config)); // start from current public config
  // ensure nested objects exist
  cfg.economy = cfg.economy || {}; cfg.coinflip = cfg.coinflip || {}; cfg.dice = cfg.dice || {};
  cfg.crash = cfg.crash || {}; cfg.blackjack = cfg.blackjack || {}; cfg.slots = cfg.slots || { weights: {}, triples: {} };
  document.querySelectorAll("#adminPanel [data-k]").forEach((inp) => {
    const path = inp.dataset.k.split("."); let obj = cfg;
    for (let i = 0; i < path.length - 1; i++) { obj[path[i]] = obj[path[i]] || {}; obj = obj[path[i]]; }
    obj[path[path.length - 1]] = Number(inp.value);
  });
  cfg.wheel = { segments: [...document.querySelectorAll("#wheelEdit .wheel-edit-row")].map((row) => ({
    label: row.querySelector('[data-seg-f="label"]').value,
    multiplier: Number(row.querySelector('[data-seg-f="multiplier"]').value),
    weight: Number(row.querySelector('[data-seg-f="weight"]').value),
    color: row.querySelector('[data-seg-f="color"]').value
  })) };
  return cfg;
}
async function saveAdmin() {
  try {
    const d = await api("/admin/config", "PUT", { config: collectConfig() }, true);
    config = (await api("/config")).config;
    applyConfig();
    renderAdmin(d.config, (await api("/admin/state", "GET", null, true)).stats);
    toast("Settings saved", "win");
  } catch (e) { toast(e.message, "lose"); }
}
async function resetAdmin() {
  try { const d = await api("/admin/reset", "POST", {}, true); config = (await api("/config")).config; applyConfig(); renderAdmin(d.config, (await api("/admin/state", "GET", null, true)).stats); toast("Reset to defaults", "win"); }
  catch (e) { toast(e.message, "lose"); }
}

/* ---------- wiring ---------- */
$("enterBtn").addEventListener("click", enter);
$("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });
$("passwordInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });
$("logoutBtn").addEventListener("click", logout);
$("bonusBtn").addEventListener("click", claimBonus);
$("tabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) switchGame(t.dataset.game); });
$("spinBtn").addEventListener("click", spinSlots);
$("rollBtn").addEventListener("click", rollDice);
$("diceSlider").addEventListener("input", updateDiceView);
$("flipBtn").addEventListener("click", flipCoin);
document.querySelectorAll(".side-toggle button").forEach((b) => b.addEventListener("click", () => { coinSide = b.dataset.side; document.querySelectorAll(".side-toggle button").forEach((x) => x.classList.toggle("active", x === b)); }));
$("roulSpinBtn").addEventListener("click", spinRoulette);
$("roulClearBtn").addEventListener("click", clearRoul);
document.querySelectorAll(".chip-pick").forEach((b) => b.addEventListener("click", () => { roulChip = Number(b.dataset.chip); document.querySelectorAll(".chip-pick").forEach((x) => x.classList.toggle("active", x === b)); }));
$("dealBtn").addEventListener("click", dealBlackjack);
$("hitBtn").addEventListener("click", () => bjAction("hit"));
$("standBtn").addEventListener("click", () => bjAction("stand"));
$("doubleBtn").addEventListener("click", () => bjAction("double"));
$("wheelSpinBtn").addEventListener("click", spinFortune);
$("crashBtn").addEventListener("click", playCrash);
$("crashTarget").addEventListener("input", () => { const v = Number($("crashTarget").value); $("crashTag").textContent = `Target: ${(Number.isFinite(v) ? v : 0).toFixed(2)}×`; });
$("adminBtn").addEventListener("click", openAdmin);
$("adminClose").addEventListener("click", closeAdmin);
$("adminLoginBtn").addEventListener("click", adminLogin);
$("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") adminLogin(); });
document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));

applyTranslations();
wireQuickChips();
boot();
setInterval(() => { if (player) renderBonus(); }, 30000);
