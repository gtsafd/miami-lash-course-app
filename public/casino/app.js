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
let lang = localStorage.getItem("nc_lang") || "en";
const SPEED = 1.35;
let crashActive = false;
let crashPoll = null;
let crashAnim = null;

const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
let SLOT_V2_SYMBOLS = [
  { id: "coin", icon: "🟡", name: "Gold Coin", type: "normal", payout: [0, 0, 4, 12, 40, 120] },
  { id: "ruby", icon: "♦️", name: "Ruby", type: "normal", payout: [0, 0, 5, 15, 50, 150] },
  { id: "emerald", icon: "💚", name: "Emerald", type: "normal", payout: [0, 0, 6, 18, 60, 180] },
  { id: "sapphire", icon: "🔷", name: "Sapphire", type: "normal", payout: [0, 0, 8, 24, 80, 240] },
  { id: "crown", icon: "👑", name: "Crown", type: "normal", payout: [0, 0, 12, 40, 120, 400] },
  { id: "chest", icon: "🧰", name: "Chest", type: "normal", payout: [0, 0, 16, 60, 180, 600] },
  { id: "wild", icon: "⭐", name: "Wild Star", type: "wild", payout: [0, 0, 0, 0, 0, 0] },
  { id: "scatter", icon: "🧭", name: "Scatter Compass", type: "scatter", payout: [0, 0, 2, 10, 40, 100] }
];
let SLOT_V2_BY_ID = Object.fromEntries(SLOT_V2_SYMBOLS.map((s) => [s.id, s]));
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
    "gate.copy": "Slots, dice, coinflip, roulette, blackjack, mines, plinko & crash — all on free virtual chips. No real money. Start with 1000 chips.",
    "gate.name": "Choose a player name",
    "gate.password": "Password",
    "gate.enter": "Enter the Casino",
    "gate.or": "or",
    "gate.telegramMissing": "Telegram login appears after TELEGRAM_BOT_USERNAME is configured.",
    "gate.telegramApp": "For app confirmation without phone entry, open this casino from Telegram.",
    "gate.telegramOpen": "Open in Telegram",
    "gate.note": "Virtual chips have no monetary value and cannot be purchased or cashed out.",
    "brand.subtitle": "Virtual Casino",
    "logout": "Exit",
    "tabs.slots": "Slots",
    "tabs.slotsV2": "Slot V2",
    "tabs.dice": "Dice",
    "tabs.coinflip": "Coinflip",
    "tabs.roulette": "Roulette",
    "tabs.blackjack": "Blackjack",
    "tabs.mines": "Mines",
    "tabs.plinko": "Plinko",
    "tabs.crash": "Crash",
    "tabs.shop": "Shop",
    "common.bet": "Bet (chips)",
    "common.max": "Max",
    "game.slots.sub": "Match symbols across the reels. Rare symbols pay more, cherries can still return small wins.",
    "game.slots.spin": "Spin 🎰",
    "game.slotsV2.sub": "Modern 5-reel slot with paylines, wilds, scatters and free spins.",
    "game.slotsV2.spin": "SPIN",
    "game.slotsV2.free": "FREE SPINS",
    "game.slotsV2.mult": "MULTIPLIER",
    "game.slotsV2.balance": "Balance",
    "game.slotsV2.bet": "Bet",
    "game.slotsV2.win": "Win",
    "game.slotsV2.paytable": "Slot V2 Paytable",
    "game.slotsV2.bonusStrip": "BONUS CHESTS",
    "game.slotsV2.bonusStripSub": "3 compasses open the pick game",
    "game.slotsV2.buyBonus": "BUY BONUS",
    "game.slotsV2.buyBonusSub": "Instant free spins with boosted multiplier",
    "game.slotsV2.buy": "Buy",
    "game.slotsV2.bonusTitle": "Bonus Game",
    "game.slotsV2.bonusPick": "Pick a treasure chest",
    "game.slotsV2.bonusContinue": "Continue",
    "game.slotsV2.bonusTriggered": "Bonus triggered! Pick a chest.",
    "game.dice.sub": "Choose a target. Roll under it to win. Lower targets pay higher multipliers.",
    "game.dice.last": "Last Roll",
    "game.dice.target": "Target",
    "game.dice.multiplier": "Multiplier",
    "game.dice.chance": "Win Chance",
    "game.dice.roll": "Roll 🎲",
    "game.coin.sub": "Pick heads or tails. The server flips the coin with a house edge.",
    "game.coin.heads": "Heads",
    "game.coin.tails": "Tails",
    "game.coin.flip": "Flip 🪙",
    "game.roulette.sub": "Pick a chip value, click bets to stack chips, then spin the wheel.",
    "game.roulette.chip": "Chip",
    "game.roulette.total": "Total bet",
    "game.roulette.spin": "Spin 🎡",
    "game.roulette.clear": "Clear bets",
    "game.roulette.red": "Red",
    "game.roulette.black": "Black",
    "game.roulette.even": "Even",
    "game.roulette.odd": "Odd",
    "game.roulette.low": "1-18",
    "game.roulette.high": "19-36",
    "game.roulette.dozen1": "1st 12",
    "game.roulette.dozen2": "2nd 12",
    "game.roulette.dozen3": "3rd 12",
    "game.roulette.column1": "Col 1",
    "game.roulette.column2": "Col 2",
    "game.roulette.column3": "Col 3",
    "game.blackjack.sub": "Dealer stands on 17. Blackjack pays according to admin settings.",
    "game.blackjack.dealer": "Dealer",
    "game.blackjack.you": "You",
    "game.blackjack.deal": "Deal 🃏",
    "game.blackjack.hit": "Hit",
    "game.blackjack.stand": "Stand",
    "game.blackjack.double": "Double",
    "game.blackjack.win": "You win!",
    "game.blackjack.bj": "Blackjack!",
    "game.blackjack.lose": "Dealer wins",
    "game.blackjack.push": "Push — bet returned",
    "game.mines.sub": "Choose how many mines are hidden. Reveal safe tiles to build a bigger multiplier, then cash out before you hit a mine.",
    "game.mines.mines": "Mines",
    "game.mines.start": "Start 💣",
    "game.mines.cashout": "Cash out",
    "game.mines.idle": "No active round",
    "game.mines.safe": "safe tiles",
    "game.mines.next": "next",
    "game.mines.cash": "cash",
    "game.plinko.sub": "Drop the ball through the pins. Edges are rare and pay more; the center is safer but smaller.",
    "game.plinko.drop": "Drop 🔵",
    "game.crash.sub": "Launch the rocket and cash out before it explodes. The multiplier climbs live, but greed can burn the whole bet.",
    "game.crash.ready": "Ready",
    "game.crash.flying": "Flying",
    "game.crash.launch": "Launch 🚀",
    "game.crash.cashout": "Cash out",
    "game.crash.cashed": "Cashed out",
    "game.crash.could": "Could have reached",
    "shop.sub": "Buy temporary Slot V2 buffs with virtual chips.",
    "shop.active": "Active buffs",
    "shop.empty": "No active buffs yet.",
    "shop.buy": "Buy",
    "shop.scatterCharm": "More compass scatters for bonus hunting.",
    "shop.wildCharm": "More wild stars on the reels.",
    "shop.lossShield": "Refunds part of losing paid spins.",
    "shop.multiplierGlow": "Boosts Slot V2 wins while active.",
    "shop.bonusMagnet": "Strong bonus hunt: more scatters and wilds.",
    "bonus.title": "🎁 Free Chips",
    "bonus.copy": "Claim a daily bonus, or a top-up if you go broke.",
    "bonus.claim": "Claim Bonus",
    "stats.title": "📊 Your Stats",
    "stats.games": "Games played",
    "stats.wagered": "Total wagered",
    "stats.won": "Net won",
    "stats.biggest": "Biggest win",
    "leaderboard.title": "🏆 Leaderboard",
    "history.title": "🧾 Recent Bets",
    "admin.title": "⚙ Casino Admin",
    "admin.copy": "Enter the admin login and password to configure odds & payouts.",
    "admin.user": "Admin login",
    "admin.pass": "Admin password",
    "admin.login": "Log in",
    "admin.close": "Close",
    "msg.needPassword": "Enter a name and password",
    "msg.notEnough": "Not enough chips",
    "msg.noBets": "No bets yet.",
    "msg.noPlayers": "No players yet.",
    "msg.loading": "Loading...",
    "msg.placeBet": "Place at least one bet",
    "msg.won": "won",
    "msg.noWin": "no win"
  },
  ru: {
    "gate.title": "Виртуальное казино",
    "gate.copy": "Слоты, кости, монетка, рулетка, блэкджек, мины, плинко и краш — только бесплатные виртуальные фишки. Без реальных денег. Старт: 1000 фишек.",
    "gate.name": "Имя игрока",
    "gate.password": "Пароль",
    "gate.enter": "Войти в казино",
    "gate.or": "или",
    "gate.telegramMissing": "Вход через Telegram появится после настройки TELEGRAM_BOT_USERNAME.",
    "gate.telegramApp": "Чтобы вход был через подтверждение в приложении без ввода номера, открой казино из Telegram.",
    "gate.telegramOpen": "Открыть в Telegram",
    "gate.note": "Виртуальные фишки не имеют денежной стоимости, их нельзя купить или вывести.",
    "brand.subtitle": "Виртуальное казино",
    "logout": "Выйти",
    "tabs.slots": "Слоты",
    "tabs.slotsV2": "Slot V2",
    "tabs.dice": "Кости",
    "tabs.coinflip": "Монетка",
    "tabs.roulette": "Рулетка",
    "tabs.blackjack": "Блэкджек",
    "tabs.mines": "Мины",
    "tabs.plinko": "Плинко",
    "tabs.crash": "Краш",
    "tabs.shop": "Магазин",
    "common.bet": "Ставка (фишки)",
    "common.max": "Макс",
    "game.slots.sub": "Собери одинаковые символы на барабанах. Редкие символы платят больше, а вишни могут дать маленький выигрыш.",
    "game.slots.spin": "Крутить 🎰",
    "game.slotsV2.sub": "Современный слот 5 барабанов: линии, wild, scatter и бесплатные спины.",
    "game.slotsV2.spin": "КРУТИТЬ",
    "game.slotsV2.free": "ФРИСПИНЫ",
    "game.slotsV2.mult": "МНОЖИТЕЛЬ",
    "game.slotsV2.balance": "Баланс",
    "game.slotsV2.bet": "Ставка",
    "game.slotsV2.win": "Выигрыш",
    "game.slotsV2.paytable": "Таблица выплат Slot V2",
    "game.slotsV2.bonusStrip": "БОНУСНЫЕ СУНДУКИ",
    "game.slotsV2.bonusStripSub": "3 компаса открывают бонус-игру",
    "game.slotsV2.buyBonus": "КУПИТЬ БОНУСКУ",
    "game.slotsV2.buyBonusSub": "Фриспины сразу с повышенным множителем",
    "game.slotsV2.buy": "Купить",
    "game.slotsV2.bonusTitle": "Бонусная игра",
    "game.slotsV2.bonusPick": "Выбери сундук с призом",
    "game.slotsV2.bonusContinue": "Продолжить",
    "game.slotsV2.bonusTriggered": "Бонус открыт! Выбери сундук.",
    "game.dice.sub": "Выбери цель. Нужно выбросить меньше нее. Чем ниже цель, тем выше множитель.",
    "game.dice.last": "Последний бросок",
    "game.dice.target": "Цель",
    "game.dice.multiplier": "Множитель",
    "game.dice.chance": "Шанс выигрыша",
    "game.dice.roll": "Бросить 🎲",
    "game.coin.sub": "Выбери орел или решка. Монетку подбрасывает сервер с преимуществом казино.",
    "game.coin.heads": "Орел",
    "game.coin.tails": "Решка",
    "game.coin.flip": "Подбросить 🪙",
    "game.roulette.sub": "Выбери фишку, ставь на поля и запускай рулетку.",
    "game.roulette.chip": "Фишка",
    "game.roulette.total": "Ставка всего",
    "game.roulette.spin": "Крутить 🎡",
    "game.roulette.clear": "Очистить ставки",
    "game.roulette.red": "Красное",
    "game.roulette.black": "Черное",
    "game.roulette.even": "Чет",
    "game.roulette.odd": "Нечет",
    "game.roulette.low": "1-18",
    "game.roulette.high": "19-36",
    "game.roulette.dozen1": "1-я 12",
    "game.roulette.dozen2": "2-я 12",
    "game.roulette.dozen3": "3-я 12",
    "game.roulette.column1": "Кол. 1",
    "game.roulette.column2": "Кол. 2",
    "game.roulette.column3": "Кол. 3",
    "game.blackjack.sub": "Дилер останавливается на 17. Выплата за блэкджек задается в админке.",
    "game.blackjack.dealer": "Дилер",
    "game.blackjack.you": "Ты",
    "game.blackjack.deal": "Раздать 🃏",
    "game.blackjack.hit": "Еще",
    "game.blackjack.stand": "Стоп",
    "game.blackjack.double": "Удвоить",
    "game.blackjack.win": "Ты выиграл!",
    "game.blackjack.bj": "Блэкджек!",
    "game.blackjack.lose": "Дилер выиграл",
    "game.blackjack.push": "Ничья — ставка возвращена",
    "game.mines.sub": "Выбери количество мин. Открывай безопасные клетки, повышай множитель и забирай выигрыш до мины.",
    "game.mines.mines": "Мины",
    "game.mines.start": "Старт 💣",
    "game.mines.cashout": "Забрать",
    "game.mines.idle": "Раунд не запущен",
    "game.mines.safe": "безопасных клеток",
    "game.mines.next": "след.",
    "game.mines.cash": "забрать",
    "game.plinko.sub": "Брось шарик через пины. Края выпадают редко и платят больше, центр чаще, но меньше.",
    "game.plinko.drop": "Бросить 🔵",
    "game.crash.sub": "Запусти ракету и забери выигрыш до взрыва. Коэффициент растет вживую, но жадность может сжечь всю ставку.",
    "game.crash.ready": "Готово",
    "game.crash.flying": "Полет",
    "game.crash.launch": "Запуск 🚀",
    "game.crash.cashout": "Забрать",
    "game.crash.cashed": "Забрал",
    "game.crash.could": "Можно было держать до",
    "shop.sub": "Покупай временные баффы для Slot V2 за виртуальные фишки.",
    "shop.active": "Активные баффы",
    "shop.empty": "Активных баффов пока нет.",
    "shop.buy": "Купить",
    "shop.scatterCharm": "Больше компасов scatter для охоты за бонусом.",
    "shop.wildCharm": "Больше wild-звезд на барабанах.",
    "shop.lossShield": "Возвращает часть проигранной платной ставки.",
    "shop.multiplierGlow": "Повышает выигрыши Slot V2, пока активен.",
    "shop.bonusMagnet": "Сильная охота за бонусом: больше scatter и wild.",
    "bonus.title": "🎁 Бесплатные фишки",
    "bonus.copy": "Забирай ежедневный бонус или пополнение, если фишки почти закончились.",
    "bonus.claim": "Забрать бонус",
    "stats.title": "📊 Твоя статистика",
    "stats.games": "Игр сыграно",
    "stats.wagered": "Всего ставок",
    "stats.won": "Выиграно",
    "stats.biggest": "Лучший выигрыш",
    "leaderboard.title": "🏆 Таблица лидеров",
    "history.title": "🧾 Последние ставки",
    "admin.title": "⚙ Админка казино",
    "admin.copy": "Введи логин и пароль админа, чтобы менять шансы и выплаты.",
    "admin.user": "Логин админа",
    "admin.pass": "Пароль админа",
    "admin.login": "Войти",
    "admin.close": "Закрыть",
    "msg.needPassword": "Введи имя и пароль",
    "msg.notEnough": "Недостаточно фишек",
    "msg.noBets": "Ставок пока нет.",
    "msg.noPlayers": "Игроков пока нет.",
    "msg.loading": "Загрузка...",
    "msg.placeBet": "Сделай хотя бы одну ставку",
    "msg.won": "выигрыш",
    "msg.noWin": "без выигрыша"
  }
};

function t(key) { return I18N[lang]?.[key] || I18N.en[key] || key; }

function setLang(next) {
  lang = next === "ru" ? "ru" : "en";
  localStorage.setItem("nc_lang", lang);
  applyTranslations();
  if (config) buildRoulette();
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
  document.querySelector('[data-game="slotsV2"]').lastChild.textContent = " " + t("tabs.slotsV2");
  document.querySelector('[data-game="dice"]').lastChild.textContent = " " + t("tabs.dice");
  document.querySelector('[data-game="coinflip"]').lastChild.textContent = " " + t("tabs.coinflip");
  document.querySelector('[data-game="roulette"]').lastChild.textContent = " " + t("tabs.roulette");
  document.querySelector('[data-game="blackjack"]').lastChild.textContent = " " + t("tabs.blackjack");
  document.querySelector('[data-game="mines"]').lastChild.textContent = " " + t("tabs.mines");
  document.querySelector('[data-game="plinko"]').lastChild.textContent = " " + t("tabs.plinko");
  document.querySelector('[data-game="crash"]').lastChild.textContent = " " + t("tabs.crash");
  document.querySelector('[data-game="shop"]').lastChild.textContent = " " + t("tabs.shop");
  translateGames();
  setText(".bonus-card h2", "bonus.title");
  setText(".bonus-card .sub", "bonus.copy");
  setText(".side .panel:nth-child(2) h2", "stats.title");
  setText("#stGames + span", "stats.games");
  setText("#stWagered + span", "stats.wagered");
  setText("#stWon + span", "stats.won");
  setText("#stBig + span", "stats.biggest");
  setText(".side .panel:nth-child(3) h2", "leaderboard.title");
  setText(".side .panel:nth-child(4) h2", "history.title");
  setText("#adminModal h2", "admin.title");
  setText("#adminLoginView .sub", "admin.copy");
  $("adminUser").placeholder = t("admin.user");
  $("adminPass").placeholder = t("admin.pass");
  setText("#adminLoginBtn", "admin.login");
  setText("#adminClose", "admin.close");
  if (player) { renderBonus(); renderHistory(player.history); loadLeaderboard(); }
  buildSlotV2Paytable();
}

function translateGames() {
  document.querySelector('[data-game="slots"] h2').textContent = "🎰 " + t("tabs.slots");
  document.querySelector('[data-game="slots"] .sub').textContent = t("game.slots.sub");
  $("spinBtn").textContent = t("game.slots.spin");
  document.querySelector('[data-game="slotsV2"] h2').textContent = "💎 " + t("tabs.slotsV2");
  document.querySelector('[data-game="slotsV2"] .sub').textContent = t("game.slotsV2.sub");
  $("slotV2SpinBtn").textContent = t("game.slotsV2.spin");
  const slotLabels = document.querySelectorAll(".slot-v2-progress span");
  if (slotLabels[0]) slotLabels[0].textContent = t("game.slotsV2.free");
  if (slotLabels[1]) slotLabels[1].textContent = t("game.slotsV2.mult");
  const slotMeters = document.querySelectorAll(".slot-meter span");
  if (slotMeters[0]) slotMeters[0].textContent = t("game.slotsV2.balance");
  if (slotMeters[1]) slotMeters[1].textContent = t("game.slotsV2.win");
  const slotBetLabel = document.querySelector(".slot-v2-bet label span");
  if (slotBetLabel) slotBetLabel.textContent = t("game.slotsV2.bet");
  const payTitle = document.querySelector("#slotV2PaytableModal h2");
  if (payTitle) payTitle.textContent = "💎 " + t("game.slotsV2.paytable");
  const bonusStripTitle = document.querySelector(".slot-v2-bonus-copy b");
  if (bonusStripTitle) bonusStripTitle.textContent = t("game.slotsV2.bonusStrip");
  const bonusStripSub = document.querySelector(".slot-v2-bonus-copy span");
  if (bonusStripSub) bonusStripSub.textContent = t("game.slotsV2.bonusStripSub");
  renderSlotV2BuyBonus();
  setText("#slotV2BonusModal h2", "game.slotsV2.bonusTitle");
  setText(".slot-v2-bonus-head p", "game.slotsV2.bonusPick");
  setText("#slotV2BonusDone", "game.slotsV2.bonusContinue");
  document.querySelector('[data-game="dice"] h2').textContent = "🎲 " + t("tabs.dice");
  document.querySelector('[data-game="dice"] .sub').textContent = t("game.dice.sub");
  document.querySelector("#diceRoll").nextElementSibling.textContent = t("game.dice.last");
  document.querySelector("#diceTargetView").nextElementSibling.textContent = t("game.dice.target");
  document.querySelector("#diceMult").nextElementSibling.textContent = t("game.dice.multiplier");
  document.querySelector("#diceChance").nextElementSibling.textContent = t("game.dice.chance");
  $("rollBtn").textContent = t("game.dice.roll");
  document.querySelector('[data-game="coinflip"] h2').textContent = "🪙 " + t("tabs.coinflip");
  document.querySelector('[data-game="coinflip"] .sub').textContent = t("game.coin.sub");
  document.querySelector('[data-side="heads"]').textContent = t("game.coin.heads");
  document.querySelector('[data-side="tails"]').textContent = t("game.coin.tails");
  $("flipBtn").textContent = t("game.coin.flip");
  document.querySelector('[data-game="roulette"] h2').textContent = "🎡 " + t("tabs.roulette");
  document.querySelector('[data-game="roulette"] .sub').textContent = t("game.roulette.sub");
  document.querySelector(".chip-tray .lbl").textContent = t("game.roulette.chip") + ":";
  document.querySelector("#roulTotal").previousSibling.textContent = t("game.roulette.total") + ": ";
  $("roulSpinBtn").textContent = t("game.roulette.spin");
  $("roulClearBtn").textContent = t("game.roulette.clear");
  document.querySelector('[data-game="blackjack"] h2').textContent = "🃏 " + t("tabs.blackjack");
  document.querySelector('[data-game="blackjack"] .sub').textContent = t("game.blackjack.sub");
  document.querySelector("#dealerVal").previousSibling.textContent = t("game.blackjack.dealer") + " ";
  document.querySelector("#playerVal").previousSibling.textContent = t("game.blackjack.you") + " ";
  $("dealBtn").textContent = t("game.blackjack.deal");
  $("hitBtn").textContent = t("game.blackjack.hit");
  $("standBtn").textContent = t("game.blackjack.stand");
  $("doubleBtn").textContent = t("game.blackjack.double");
  document.querySelector('[data-game="mines"] h2').textContent = "💣 " + t("tabs.mines");
  document.querySelector('[data-game="mines"] .sub').textContent = t("game.mines.sub");
  document.querySelector("#minesCount").previousElementSibling.textContent = t("game.mines.mines");
  $("minesStartBtn").textContent = t("game.mines.start");
  $("minesCashoutBtn").textContent = t("game.mines.cashout");
  if (!player?.minesRound) $("minesStatus").textContent = t("game.mines.idle");
  document.querySelector('[data-game="plinko"] h2').textContent = "🔵 " + t("tabs.plinko");
  document.querySelector('[data-game="plinko"] .sub').textContent = t("game.plinko.sub");
  $("plinkoDropBtn").textContent = t("game.plinko.drop");
  document.querySelector('[data-game="crash"] h2').textContent = "🚀 " + t("tabs.crash");
  document.querySelector('[data-game="crash"] .sub').textContent = t("game.crash.sub");
  if (!crashActive) $("crashTag").textContent = t("game.crash.ready");
  $("crashBtn").textContent = t("game.crash.launch");
  $("crashCashoutBtn").textContent = t("game.crash.cashout");
  document.querySelector('[data-game="shop"] h2').textContent = "🛍️ " + t("tabs.shop");
  document.querySelector('[data-game="shop"] .sub').textContent = t("shop.sub");
  renderShop();
  document.querySelectorAll(".field label").forEach((label) => {
    if (/^Bet \(chips\)$|^Ставка \(фишки\)$/.test(label.textContent.trim())) label.textContent = t("common.bet");
  });
  document.querySelectorAll('[data-set="max"]').forEach((b) => { b.textContent = t("common.max"); });
}

window.onTelegramAuth = async function onTelegramAuth(user) {
  try {
    const data = await api("/telegram", "POST", { telegram: user });
    token = data.token; localStorage.setItem("nc_token", token);
    setPlayer(data.player); showApp();
  } catch (e) { toast(e.message, "lose"); }
};

async function tryTelegramWebAppLogin() {
  const initData = window.Telegram?.WebApp?.initData || "";
  if (!initData || token) return false;
  try {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    const data = await api("/telegram-webapp", "POST", { initData });
    token = data.token; localStorage.setItem("nc_token", token);
    setPlayer(data.player); showApp();
    return true;
  } catch (e) {
    toast(e.message, "lose");
    return false;
  }
}

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
  const helper = document.createElement("div");
  helper.className = "telegram-helper";
  helper.innerHTML = `<span>${escapeHtml(t("gate.telegramApp"))}</span><a class="btn ghost sm" href="https://t.me/${encodeURIComponent(username.replace(/^@/, ""))}?start=casino" target="_blank" rel="noopener">${escapeHtml(t("gate.telegramOpen"))}</a>`;
  wrap.appendChild(helper);
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
  $("slotV2Balance").textContent = fmt(p.balance);
  $("slotV2Free").textContent = fmt(p.slotV2?.freeSpinsLeft || 0);
  $("slotV2Mult").textContent = "x" + fmt(p.slotV2?.freeSpinMultiplier || 1);
  if (p.slotV2?.bonusPending) openSlotV2Bonus();
  renderShop();
  renderHistory(p.history);
  renderBonus();
  if (p.blackjack) renderBlackjack(p.blackjack);
  if (p.crashRound && p.crashRound.status === "flying" && !crashActive) startCrashUi(p.crashRound);
  renderMinesRound(p.minesRound);
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
  if (await tryTelegramWebAppLogin()) return;
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
  SLOT_V2_SYMBOLS = config.slotsV2?.symbols || SLOT_V2_SYMBOLS;
  SLOT_V2_BY_ID = Object.fromEntries(SLOT_V2_SYMBOLS.map((s) => [s.id, s]));
  buildSlotV2Grid();
  buildSlotV2Paytable();
  renderSlotV2BuyBonus();
  renderShop();
  buildRoulette();
  buildMinesBoard();
  buildPlinko();
  mountTelegramLogin();
  updateDiceView();
  translateGames();
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

function buildSlotV2Grid() {
  const grid = $("slotV2Grid");
  if (!grid) return;
  grid.innerHTML = "";
  for (let reel = 0; reel < 5; reel++) {
    const col = document.createElement("div");
    col.className = "slot-v2-reel";
    col.dataset.reel = String(reel);
    for (let row = 0; row < 3; row++) {
      const cell = document.createElement("div");
      cell.className = "slot-v2-symbol";
      cell.dataset.reel = String(reel);
      cell.dataset.row = String(row);
      const sym = SLOT_V2_SYMBOLS[(reel + row) % SLOT_V2_SYMBOLS.length];
      cell.dataset.symbol = sym.id;
      cell.innerHTML = `<span><i>${sym.icon}</i></span>`;
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

function slotV2Cell(symbolId, reel, row) {
  const sym = SLOT_V2_BY_ID[symbolId] || SLOT_V2_SYMBOLS[0];
  return `<div class="slot-v2-symbol" data-reel="${reel}" data-row="${row}" data-symbol="${escapeHtml(sym.id)}"><span><i>${sym.icon}</i></span></div>`;
}

function animateSlotV2Reel(reelEl, finalColumn, index) {
  return new Promise((resolve) => {
    reelEl.classList.remove("win");
    reelEl.classList.add("spinning");
    const cycles = 13 + index * 3;
    let html = "";
    for (let i = 0; i < cycles; i++) {
      const sym = SLOT_V2_SYMBOLS[Math.floor(Math.random() * SLOT_V2_SYMBOLS.length)];
      html += slotV2Cell(sym.id, index, i % 3);
    }
    for (let row = 0; row < 3; row++) html += slotV2Cell(finalColumn[row], index, row);
    reelEl.innerHTML = html;
    reelEl.style.transition = "none";
    reelEl.style.transform = "translateY(0)";
    void reelEl.offsetHeight;
    const cellH = reelEl.querySelector(".slot-v2-symbol")?.offsetHeight || 92;
    const duration = Math.round((1450 + index * 360) * SPEED);
    reelEl.style.transition = `transform ${duration}ms cubic-bezier(.13,.72,.16,1)`;
    reelEl.style.transform = `translateY(${-cycles * cellH}px)`;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      reelEl.style.transition = "none";
      reelEl.style.transform = "translateY(0)";
      reelEl.innerHTML = finalColumn.map((id, row) => slotV2Cell(id, index, row)).join("");
      reelEl.classList.remove("spinning");
      resolve();
    };
    reelEl.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, duration + 160);
  });
}

function clearSlotV2Highlights() {
  document.querySelectorAll(".slot-v2-symbol").forEach((c) => c.classList.remove("win", "scatter-hit"));
  $("slotV2Overlay").innerHTML = "";
}

function drawSlotV2Wins(outcome) {
  clearSlotV2Highlights();
  const overlay = $("slotV2Overlay");
  const colors = ["#ffd166", "#7ff7e5", "#ff5c7c", "#9d7bff", "#4bf27a"];
  outcome.lineWins.forEach((win, i) => {
    win.positions.forEach(([reel, row]) => {
      document.querySelector(`.slot-v2-symbol[data-reel="${reel}"][data-row="${row}"]`)?.classList.add("win");
    });
    const points = win.positions.map(([reel, row]) => `${reel * 100 + 50},${row * 100 + 50}`).join(" ");
    overlay.insertAdjacentHTML("beforeend", `<polyline points="${points}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />`);
  });
  (outcome.scatters || []).forEach(([reel, row]) => {
    document.querySelector(`.slot-v2-symbol[data-reel="${reel}"][data-row="${row}"]`)?.classList.add("scatter-hit");
  });
}

function buildSlotV2Paytable() {
  const wrap = $("slotV2Paytable");
  if (!wrap) return;
  wrap.innerHTML = SLOT_V2_SYMBOLS.map((s) => {
    const payout = config?.slotsV2?.payouts?.[s.id] || s.payout || [];
    const note = s.type === "wild" ? (lang === "ru" ? "заменяет обычные символы" : "substitutes normal symbols")
      : s.type === "scatter" ? (lang === "ru" ? "платит в любом месте и дает фриспины" : "pays anywhere and awards free spins")
      : (lang === "ru" ? "линия слева направо" : "left-to-right paylines");
    return `<div class="slot-v2-payrow"><span class="slot-v2-payicon">${s.icon}</span><b>${escapeHtml(s.name)}</b><span>3: ${payout[3] || 0}x</span><span>4: ${payout[4] || 0}x</span><span>5: ${payout[5] || 0}x</span><em>${note}</em></div>`;
  }).join("");
}

function renderSlotV2BuyBonus() {
  const wrap = $("slotV2BuyBonus");
  if (!wrap) return;
  const packs = config?.slotsV2?.bonusBuys || [];
  wrap.innerHTML = `
    <div class="slot-v2-buy-copy"><b>${escapeHtml(t("game.slotsV2.buyBonus"))}</b><span>${escapeHtml(t("game.slotsV2.buyBonusSub"))}</span></div>
    <div class="slot-v2-buy-packs">
      ${packs.map((p) => `<button type="button" data-buy-slot-v2="${escapeHtml(p.id)}"><b>${fmt(p.cost)}</b><span>${p.freeSpins} FS · x${p.multiplier}</span></button>`).join("")}
    </div>`;
}

function openSlotV2Bonus() {
  const modal = $("slotV2BonusModal");
  $("slotV2BonusResult").textContent = t("game.slotsV2.bonusTriggered");
  $("slotV2BonusResult").className = "result-line neutral";
  $("slotV2BonusDone").classList.add("hidden");
  document.querySelectorAll("#slotV2BonusChests button").forEach((b) => {
    b.disabled = false;
    b.className = "";
    b.innerHTML = "<span>🧰</span><b>?</b>";
  });
  modal.classList.remove("hidden");
}

function describeSlotV2Prize(prize) {
  const bits = [];
  if (prize.freeSpins) bits.push(lang === "ru" ? `${prize.freeSpins} фриспинов` : `${prize.freeSpins} free spins`);
  if (prize.chips) bits.push(lang === "ru" ? `${fmt(prize.chips)} фишек` : `${fmt(prize.chips)} chips`);
  if (prize.multiplierBoost) bits.push(lang === "ru" ? `+${prize.multiplierBoost} к множителю` : `+${prize.multiplierBoost} multiplier`);
  return bits.join(" · ") || (lang === "ru" ? "Пусто" : "Empty");
}

function pulseSlotV2BonusStrip() {
  const strip = $("slotV2BonusStrip");
  strip.classList.remove("lit");
  void strip.offsetWidth;
  strip.classList.add("lit");
}

async function pickSlotV2Bonus(pick) {
  const buttons = [...document.querySelectorAll("#slotV2BonusChests button")];
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const data = await api("/slots-v2/bonus-pick", "POST", { pick });
    data.reveal.forEach((prize, index) => {
      const b = buttons[index];
      b.classList.toggle("picked", Boolean(prize.picked));
      b.classList.add("revealed");
      b.innerHTML = `<span>${prize.picked ? "🏆" : "🧰"}</span><b>${escapeHtml(describeSlotV2Prize(prize))}</b>`;
    });
    setPlayer(data.player);
    $("slotV2BonusResult").textContent = (lang === "ru" ? "Твой приз: " : "Your prize: ") + describeSlotV2Prize(data.prize);
    $("slotV2BonusResult").className = "result-line win";
    $("slotV2BonusDone").classList.remove("hidden");
  } catch (e) {
    toast(e.message, "lose");
    buttons.forEach((b) => { b.disabled = false; });
  }
}

async function buySlotV2Bonus(packageId) {
  if (busy) return;
  busy = true;
  try {
    const data = await api("/slots-v2/buy-bonus", "POST", { packageId });
    setPlayer(data.player);
    const p = data.package;
    toast(lang === "ru" ? `Куплено: ${p.freeSpins} фриспинов x${p.multiplier}` : `Bought: ${p.freeSpins} free spins x${p.multiplier}`, "win");
  } catch (e) { toast(e.message, "lose"); }
  busy = false;
}

async function spinSlotsV2() {
  if (busy) return;
  const bet = betValue("slotsV2");
  const free = (player?.slotV2?.freeSpinsLeft || 0) > 0;
  if (!free && !affordable(bet)) return;
  busy = true; $("slotV2SpinBtn").disabled = true; $("slotV2Result").textContent = ""; $("slotV2Win").textContent = "0";
  clearSlotV2Highlights();
  try {
    const data = await api("/play/slots-v2", "POST", { bet });
    const out = data.outcome;
    const reels = [...document.querySelectorAll(".slot-v2-reel")];
    await Promise.all(reels.map((r, i) => animateSlotV2Reel(r, out.grid[i], i)));
    drawSlotV2Wins(out);
    $("slotV2Win").textContent = fmt(out.payout);
    setPlayer(data.player);
    const extra = out.bonusTriggered ? (lang === "ru" ? " Бонуска открыта!" : " Bonus game opened!") : "";
    const msg = out.payout > 0
      ? (lang === "ru" ? `Выигрыш ${fmt(out.payout)}.${extra}` : `Won ${fmt(out.payout)}.${extra}`)
      : (lang === "ru" ? `Без выигрыша.${extra}` : `No win.${extra}`);
    showOutcome("slotV2Result", out, msg);
    if (out.bonusTriggered) {
      pulseSlotV2BonusStrip();
      setTimeout(openSlotV2Bonus, 650);
    }
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("slotV2SpinBtn").disabled = false;
}

function shopItemDescription(id) {
  return t("shop." + id);
}

function effectText(effect) {
  const bits = [];
  if (effect.scatterBoost) bits.push(`Scatter +${effect.scatterBoost}`);
  if (effect.wildBoost) bits.push(`Wild +${effect.wildBoost}`);
  if (effect.lossRefundPercent) bits.push(`${effect.lossRefundPercent}% ${lang === "ru" ? "возврат" : "refund"}`);
  if (effect.winMultiplierBoost) bits.push(`+${effect.winMultiplierBoost}% ${lang === "ru" ? "к выигрышу" : "wins"}`);
  return bits.join(" · ");
}

function renderShop() {
  const itemsWrap = $("shopItems");
  const activeWrap = $("shopActive");
  if (!itemsWrap || !activeWrap || !config) return;
  const buffs = player?.shopBuffs || [];
  activeWrap.innerHTML = `<h3>${escapeHtml(t("shop.active"))}</h3>` + (buffs.length
    ? `<div class="shop-buffs">${buffs.map((b) => `<span>${b.icon || "✨"} ${escapeHtml(b.name)} · ${b.spinsLeft}</span>`).join("")}</div>`
    : `<div class="neutral">${escapeHtml(t("shop.empty"))}</div>`);
  itemsWrap.innerHTML = (config.shop?.items || []).map((item) => `
    <article class="shop-item">
      <div class="shop-icon">${item.icon}</div>
      <div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(shopItemDescription(item.id))}</p><em>${escapeHtml(effectText(item.effect || {}))} · ${item.spins} ${lang === "ru" ? "спинов" : "spins"}</em></div>
      <button class="btn" data-shop-buy="${escapeHtml(item.id)}">${escapeHtml(t("shop.buy"))} · ${fmt(item.cost)}</button>
    </article>`).join("");
}

async function buyShopItem(itemId) {
  if (busy) return;
  busy = true;
  try {
    const data = await api("/shop/buy", "POST", { itemId });
    setPlayer(data.player);
    toast((lang === "ru" ? "Куплено: " : "Bought: ") + data.item.name, "win");
  } catch (e) { toast(e.message, "lose"); }
  busy = false;
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
  animateDiceCup();
  try {
    const data = await api("/play/dice", "POST", { bet, target: Number($("diceSlider").value) });
    const o = data.outcome;
    await wait(700);
    $("diceRoll").textContent = o.roll.toFixed(2);
    $("diceRoll").className = o.win ? "win" : "lose";
    setDiceFaces(o.roll);
    setPlayer(data.player);
    showOutcome("diceResult", o, lang === "ru" ? `Выпало ${o.roll.toFixed(2)} — ${o.win ? "выигрыш " + fmt(o.payout) : "проигрыш"}` : `Rolled ${o.roll.toFixed(2)} — ${o.win ? "win " + fmt(o.payout) : "loss"}`);
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("rollBtn").disabled = false;
}

function animateDiceCup() {
  const cup = $("diceCup");
  cup.classList.remove("rolling"); void cup.offsetWidth; cup.classList.add("rolling");
}

function setDiceFaces(roll) {
  const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const a = Math.max(0, Math.min(5, Math.floor((roll % 36) / 6)));
  const b = Math.max(0, Math.min(5, Math.floor((roll % 6))));
  const dice = document.querySelectorAll("#diceCup .die");
  dice[0].textContent = faces[a];
  dice[1].textContent = faces[b];
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
  const outside = [
    ["red", t("game.roulette.red"), "r"], ["black", t("game.roulette.black"), "b"], ["even", t("game.roulette.even"), ""], ["odd", t("game.roulette.odd"), ""], ["low", t("game.roulette.low"), ""], ["high", t("game.roulette.high"), ""],
    ["dozen", t("game.roulette.dozen1"), "", 1], ["dozen", t("game.roulette.dozen2"), "", 2], ["dozen", t("game.roulette.dozen3"), "", 3], ["column", t("game.roulette.column1"), "", 1], ["column", t("game.roulette.column2"), "", 2], ["column", t("game.roulette.column3"), "", 3]
  ];
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
  if (!bets.length) return toast(t("msg.placeBet"), "");
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
    showOutcome("roulResult", o, `${o.result} ${o.color} — ${o.win ? t("msg.won") + " " + fmt(o.payout) : t("msg.noWin")}`);
    clearRoul();
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("roulSpinBtn").disabled = false;
}

/* ---------- mines ---------- */
function buildMinesBoard() {
  const board = $("minesBoard");
  board.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const b = document.createElement("button");
    b.className = "mine-tile";
    b.dataset.tile = i;
    b.textContent = "◇";
    b.addEventListener("click", () => revealMineTile(i));
    board.appendChild(b);
  }
}

function renderMinesRound(round) {
  const active = Boolean(round && round.status === "playing");
  $("minesStartBtn").disabled = active;
  $("minesCashoutBtn").disabled = !active || !round.revealed.length;
  document.querySelectorAll(".mine-tile").forEach((tile) => {
    const idx = Number(tile.dataset.tile);
    tile.disabled = !active || round.revealed.includes(idx);
    tile.classList.toggle("safe", active && round.revealed.includes(idx));
    if (active && round.revealed.includes(idx)) tile.textContent = "💎";
    else if (!tile.classList.contains("mine-hit")) tile.textContent = "◇";
  });
  if (!active) {
    $("minesStatus").textContent = t("game.mines.idle");
    return;
  }
  $("minesStatus").textContent = `${round.revealed.length} ${t("game.mines.safe")} · ${t("game.mines.next")} ${Number(round.nextMultiplier).toFixed(2)}× · ${t("game.mines.cash")} ${Number(round.cashoutMultiplier).toFixed(2)}×`;
}

async function startMines() {
  if (busy) return;
  const bet = betValue("mines");
  if (!affordable(bet)) return;
  busy = true; $("minesResult").textContent = "";
  document.querySelectorAll(".mine-tile").forEach((t) => { t.className = "mine-tile"; t.textContent = "◇"; });
  try {
    const d = await api("/mines/start", "POST", { bet, mines: Number($("minesCount").value) });
    setPlayer(d.player);
    renderMinesRound(d.round);
  } catch (e) { toast(e.message, "lose"); }
  busy = false;
}

async function revealMineTile(tile) {
  if (busy || !player?.minesRound) return;
  busy = true;
  const btn = document.querySelector(`.mine-tile[data-tile="${tile}"]`);
  btn.classList.add("flipping");
  try {
    const d = await api("/mines/reveal", "POST", { tile });
    await wait(220);
    if (d.round?.status === "lost") {
      d.round.mineTiles.forEach((idx) => {
        const tEl = document.querySelector(`.mine-tile[data-tile="${idx}"]`);
        tEl.classList.add("mine-hit"); tEl.textContent = "💣";
      });
      setPlayer(d.player);
      $("minesResult").className = "result-line lose";
      $("minesResult").textContent = lang === "ru" ? "Мина! Ставка потеряна." : "Mine hit! Bet lost.";
      renderMinesRound(null);
    } else {
      setPlayer(d.player);
      renderMinesRound(d.round);
    }
  } catch (e) { toast(e.message, "lose"); }
  busy = false;
}

async function cashoutMines() {
  if (busy || !player?.minesRound) return;
  busy = true;
  try {
    const d = await api("/mines/cashout", "POST", {});
    setPlayer(d.player);
    renderMinesRound(null);
    showOutcome("minesResult", d.outcome, lang === "ru" ? `Забрал ${Number(d.outcome.multiplier).toFixed(2)}× — ${fmt(d.outcome.payout)}` : `Cashed ${Number(d.outcome.multiplier).toFixed(2)}× — ${fmt(d.outcome.payout)}`);
  } catch (e) { toast(e.message, "lose"); }
  busy = false;
}

/* ---------- plinko ---------- */
function buildPlinko() {
  const pins = $("plinkoPins");
  const buckets = $("plinkoBuckets");
  const rows = config?.plinko.rows || 10;
  pins.innerHTML = "";
  buckets.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
      const p = document.createElement("i");
      p.style.left = `${50 + (c - r / 2) * 8}%`;
      p.style.top = `${8 + r * 7.2}%`;
      pins.appendChild(p);
    }
  }
  (config?.plinko.multipliers || []).forEach((m) => {
    const b = document.createElement("span");
    b.textContent = `${m}×`;
    buckets.appendChild(b);
  });
}

async function dropPlinko() {
  if (busy) return;
  const bet = betValue("plinko");
  if (!affordable(bet)) return;
  busy = true; $("plinkoDropBtn").disabled = true; $("plinkoResult").textContent = "";
  try {
    const d = await api("/play/plinko", "POST", { bet });
    await animatePlinko(d.outcome);
    setPlayer(d.player);
    showOutcome("plinkoResult", d.outcome, lang === "ru" ? `Ячейка ${d.outcome.bucket} · ${d.outcome.multiplier}× — ${fmt(d.outcome.payout)}` : `Bucket ${d.outcome.bucket} · ${d.outcome.multiplier}× — ${fmt(d.outcome.payout)}`);
  } catch (e) { toast(e.message, "lose"); }
  busy = false; $("plinkoDropBtn").disabled = false;
}

function animatePlinko(outcome) {
  const ball = $("plinkoBall");
  const rows = outcome.path.length;
  let x = 50, y = 4;
  ball.style.opacity = "1";
  ball.style.transform = `translate(-50%,-50%) translate(${x - 50}%, ${y}%)`;
  return new Promise((resolve) => {
    outcome.path.forEach((step, i) => {
      setTimeout(() => {
        x += step ? 4 : -4;
        y = 10 + i * 7.3;
        ball.style.left = `${x}%`;
        ball.style.top = `${y}%`;
      }, i * 170);
    });
    setTimeout(() => {
      ball.style.left = `${(outcome.bucket / rows) * 90 + 5}%`;
      ball.style.top = "92%";
      setTimeout(resolve, 350);
    }, rows * 170 + 120);
  });
}

/* ---------- crash ---------- */
async function playCrash() {
  if (crashActive) return cashoutCrash();
  const bet = betValue("crash");
  if (!affordable(bet)) return;
  busy = true; $("crashResult").textContent = "";
  const mult = $("crashMult"), rocket = $("crashRocket");
  mult.classList.remove("boom"); mult.textContent = "1.00×";
  rocket.textContent = "🚀";
  rocket.style.left = "8px"; rocket.style.bottom = "8px";
  try {
    const data = await api("/play/crash/start", "POST", { bet });
    setPlayer(data.player);
    startCrashUi(data.round);
  } catch (e) { toast(e.message, "lose"); }
  busy = false;
}

function startCrashUi(round) {
  if (!round) return;
  crashActive = true;
  $("crashBtn").disabled = true;
  $("crashCashoutBtn").disabled = false;
  $("crashTag").textContent = t("game.crash.flying");
  animateCrashLive(round.startedAt);
  clearInterval(crashPoll);
  crashPoll = setInterval(checkCrashState, 420);
}

async function checkCrashState() {
  if (!crashActive) return;
  try {
    const data = await api("/play/crash/state", "POST", {});
    if (!data.round || data.round.status === "crashed") {
      stopCrashUi();
      const cp = data.round?.crashPoint || data.round?.multiplier || null;
      $("crashMult").classList.add("boom");
      $("crashMult").textContent = cp ? `💥 ${Number(cp).toFixed(2)}×` : "💥";
      $("crashRocket").textContent = "💥";
      setPlayer(data.player);
      $("crashResult").className = "result-line lose";
      $("crashResult").textContent = cp
        ? (lang === "ru" ? `Ракета взорвалась на ${Number(cp).toFixed(2)}×. Ставка потеряна.` : `Rocket exploded at ${Number(cp).toFixed(2)}×. Bet lost.`)
        : (lang === "ru" ? "Ракета взорвалась слишком рано. Ставка потеряна." : "Rocket exploded too early. Bet lost.");
      await wait(850);
      resetCrashReady();
    }
  } catch (e) {
    stopCrashUi();
    toast(e.message, "lose");
    resetCrashReady();
  }
}

async function cashoutCrash() {
  if (!crashActive) return;
  $("crashCashoutBtn").disabled = true;
  try {
    const data = await api("/play/crash/cashout", "POST", {});
    stopCrashUi();
    setPlayer(data.player);
    const o = data.outcome;
    if (o.crashed) {
      stopCrashUi();
      $("crashMult").classList.add("boom");
      $("crashMult").textContent = `💥 ${Number(o.crashPoint).toFixed(2)}×`;
      $("crashRocket").textContent = "💥";
      showOutcome("crashResult", { win: false }, lang === "ru" ? `Не успел: взрыв на ${Number(o.crashPoint).toFixed(2)}×` : `Too late: crashed at ${Number(o.crashPoint).toFixed(2)}×`);
      await wait(850);
      resetCrashReady();
    } else {
      crashActive = false;
      clearInterval(crashPoll);
      cancelAnimationFrame(crashAnim);
      $("crashCashoutBtn").disabled = true;
      $("crashBtn").disabled = true;
      $("crashMult").textContent = `${Number(o.multiplier).toFixed(2)}×`;
      showOutcome("crashResult", { win: true }, `${t("game.crash.cashed")} ${Number(o.multiplier).toFixed(2)}× — ${fmt(o.payout)}`);
      await animateCrashAfterCashout(o.multiplier, o.crashPoint);
      $("crashMult").classList.add("boom");
      $("crashMult").textContent = `💥 ${Number(o.crashPoint).toFixed(2)}×`;
      $("crashRocket").textContent = "💥";
      $("crashResult").className = "result-line neutral";
      $("crashResult").textContent = `${t("game.crash.could")} ${Number(o.crashPoint).toFixed(2)}×`;
      await wait(1100);
      resetCrashReady();
      $("crashBtn").disabled = false;
    }
  } catch (e) {
    $("crashCashoutBtn").disabled = false;
    toast(e.message, "lose");
  }
}

function animateCrashLive(startedAt) {
  cancelAnimationFrame(crashAnim);
  const mult = $("crashMult"), rocket = $("crashRocket");
  function frame() {
    if (!crashActive) return;
    const m = clientCrashMultiplier(startedAt);
    positionRocket(m);
    mult.textContent = `${m.toFixed(2)}×`;
    crashAnim = requestAnimationFrame(frame);
  }
  frame();
}

function clientCrashMultiplier(startedAt) {
  const elapsed = Math.max(0, Date.now() - startedAt) / 1000;
  return Math.floor((1 + Math.pow(elapsed / 3, 1.55)) * 100) / 100;
}

function positionRocket(multiplier) {
  const p = Math.min(.98, Math.log(Math.max(1.01, multiplier)) / Math.log(26));
  const wobble = Math.sin(Date.now() / 190) * 1.2;
  $("crashRocket").style.left = (7 + p * 80) + "%";
  $("crashRocket").style.bottom = (5 + p * 73 + wobble) + "%";
}

function animateCrashAfterCashout(fromMultiplier, crashPoint) {
  return new Promise((resolve) => {
    const start = performance.now();
    const from = Math.max(1, Number(fromMultiplier) || 1);
    const to = Math.max(from + .01, Number(crashPoint) || from + .2);
    const duration = Math.min(8000, Math.max(1500, 900 + 1900 * Math.log(to / from + 1)));
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const ease = progress < .75 ? Math.pow(progress / .75, 1.35) * .82 : .82 + ((progress - .75) / .25) * .18;
      const m = from + (to - from) * ease;
      $("crashMult").textContent = `${m.toFixed(2)}×`;
      positionRocket(m);
      if (progress < 1) requestAnimationFrame(frame); else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function stopCrashUi() {
  crashActive = false;
  clearInterval(crashPoll);
  cancelAnimationFrame(crashAnim);
  $("crashCashoutBtn").disabled = true;
  $("crashBtn").disabled = false;
}

function resetCrashReady() {
  $("crashMult").classList.remove("boom");
  $("crashMult").textContent = "1.00×";
  $("crashRocket").textContent = "🚀";
  $("crashRocket").style.left = "8px";
  $("crashRocket").style.bottom = "8px";
  $("crashTag").textContent = t("game.crash.ready");
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
    const map = { win: [t("game.blackjack.win"), "win"], blackjack: [t("game.blackjack.bj"), "win"], lose: [t("game.blackjack.lose"), "lose"], push: [t("game.blackjack.push"), "neutral"] };
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
  if (!hist || !hist.length) { wrap.innerHTML = `<div class="neutral" style="font-size:13px;">${escapeHtml(t("msg.noBets"))}</div>`; return; }
  wrap.innerHTML = hist.slice(0, 12).map((h) => {
    const sign = h.net > 0 ? "+" : ""; const cls = h.net > 0 ? "pos" : (h.net < 0 ? "neg" : "");
    return `<div class="hist-row"><span class="g">${h.game}</span><span class="n ${cls}">${sign}${fmt(h.net)}</span></div>`;
  }).join("");
}
async function loadLeaderboard() {
  try {
    const data = await api("/leaderboard");
    const wrap = $("leaderboard");
    if (!data.leaderboard.length) { wrap.innerHTML = `<div class="neutral" style="font-size:13px;">${escapeHtml(t("msg.noPlayers"))}</div>`; return; }
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
    const d = await api("/admin/login", "POST", { username: $("adminUser").value.trim(), password: $("adminPass").value });
    adminToken = d.token; localStorage.setItem("nc_admin", adminToken);
    loadAdmin();
  } catch (e) { $("adminLoginErr").textContent = e.message; }
}
async function loadAdmin() {
  try {
    const d = await api("/admin/state", "GET", null, true);
    $("adminLoginView").classList.add("hidden");
    $("adminPanel").classList.remove("hidden");
    renderAdmin(d.config, d.stats, d.players || []);
  } catch (e) {
    adminToken = ""; localStorage.removeItem("nc_admin");
    $("adminLoginView").classList.remove("hidden"); $("adminPanel").classList.add("hidden");
    if (e.status !== 401) $("adminLoginErr").textContent = e.message;
  }
}
function numInput(k, val, step) { return `<label>${k.split(".").pop()}<input type="number" data-k="${k}" value="${val}" step="${step || 1}" /></label>`; }
function renderAdmin(c, stats, players) {
  const p = $("adminPanel");
  const slotRows = SLOT_SYMBOLS.map((s) => `<label>${s} weight<input type="number" data-k="slots.weights.${s}" value="${c.slots.weights[s]}" /></label><label>${s} 3×pay<input type="number" data-k="slots.triples.${s}" value="${c.slots.triples[s]}" /></label>`).join("");
  const slotV2Rows = SLOT_V2_SYMBOLS.map((s) => {
    const pay = c.slotsV2?.payouts?.[s.id] || s.payout || [];
    return `<label>${s.icon} ${s.id} weight<input type="number" data-k="slotsV2.weights.${s.id}" value="${c.slotsV2.weights[s.id]}" /></label>
      <label>${s.icon} 3×<input type="number" data-k="slotsV2.payouts.${s.id}.3" value="${pay[3] || 0}" step="0.01" /></label>
      <label>${s.icon} 4×<input type="number" data-k="slotsV2.payouts.${s.id}.4" value="${pay[4] || 0}" step="0.01" /></label>
      <label>${s.icon} 5×<input type="number" data-k="slotsV2.payouts.${s.id}.5" value="${pay[5] || 0}" step="0.01" /></label>`;
  }).join("");
  const playerRows = (players || []).map((pl) => `
    <div class="player-edit-row" data-player="${escapeHtml(pl.id)}">
      <input type="text" data-player-f="name" value="${escapeHtml(pl.name)}" />
      <input type="number" data-player-f="balance" value="${pl.balance}" />
      <input type="number" data-player-f="gamesPlayed" value="${pl.stats.gamesPlayed}" title="Games played" />
      <input type="number" data-player-f="wagered" value="${pl.stats.wagered}" title="Wagered" />
      <input type="number" data-player-f="won" value="${pl.stats.won}" title="Won" />
      <input type="number" data-player-f="biggestWin" value="${pl.stats.biggestWin}" title="Biggest win" />
      <span class="player-provider">${pl.authProvider}${pl.telegramUsername ? " @" + escapeHtml(pl.telegramUsername) : ""}</span>
      <button class="btn sm" data-player-save="${escapeHtml(pl.id)}">Save</button>
      <button class="btn ghost sm" data-player-reset="${escapeHtml(pl.id)}">Reset</button>
      <button class="btn danger sm" data-player-del="${escapeHtml(pl.id)}">Delete</button>
    </div>`).join("") || '<p class="sub">No players yet.</p>';
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
    <div class="admin-sec"><h3>Coinflip / Dice / Mines / Plinko / Crash / Blackjack chances</h3><div class="admin-grid">
      ${numInput("coinflip.winChancePercent", c.coinflip.winChancePercent)}
      ${numInput("coinflip.winMultiplier", c.coinflip.winMultiplier, 0.01)}
      ${numInput("dice.houseEdgePercent", c.dice.houseEdgePercent, 0.1)}
      ${numInput("mines.houseEdgePercent", c.mines.houseEdgePercent, 0.1)}
      ${numInput("plinko.houseEdgePercent", c.plinko.houseEdgePercent, 0.1)}
      ${numInput("crash.houseEdgePercent", c.crash.houseEdgePercent, 0.1)}
      ${numInput("crash.maxMultiplier", c.crash.maxMultiplier)}
      ${numInput("blackjack.blackjackPayout", c.blackjack.blackjackPayout, 0.1)}
    </div></div>
    <div class="admin-sec"><h3>Slots weights &amp; payouts</h3><div class="admin-grid">${slotRows}
      ${numInput("slots.twoCherry", c.slots.twoCherry)}${numInput("slots.oneCherry", c.slots.oneCherry)}
    </div></div>
    <div class="admin-sec"><h3>Slot V2 weights, payouts &amp; bonus</h3><div class="admin-grid">
      ${numInput("slotsV2.freeSpinsAward", c.slotsV2.freeSpinsAward)}
      ${numInput("slotsV2.freeSpinMultiplierStep", c.slotsV2.freeSpinMultiplierStep, 0.1)}
      ${numInput("slotsV2.freeSpinMaxMultiplier", c.slotsV2.freeSpinMaxMultiplier, 0.1)}
      ${slotV2Rows}
    </div></div>
    <div class="admin-sec"><h3>Players</h3>
      <div class="player-edit-head"><span>Name</span><span>Balance</span><span>Games</span><span>Wagered</span><span>Won</span><span>Biggest</span><span>Auth</span><span>Actions</span></div>
      <div id="playerEdit">${playerRows}</div>
      <div class="admin-actions">
        <button class="btn ghost" id="resetAllResultsBtn">Reset all results</button>
        <button class="btn ghost" id="resetAllWithBalanceBtn">Reset all + starting balance</button>
        <button class="btn danger" id="deleteAllPlayersBtn">Delete all players</button>
      </div>
    </div>
    <div class="admin-actions">
      <button class="btn" id="adminSaveBtn">Save changes</button>
      <button class="btn ghost" id="adminResetBtn">Reset to defaults</button>
      <button class="adm-link" id="adminLogoutBtn">Log out of admin</button>
    </div>`;
  $("adminSaveBtn").addEventListener("click", saveAdmin);
  $("adminResetBtn").addEventListener("click", resetAdmin);
  $("resetAllResultsBtn").addEventListener("click", () => resetPlayerResultsAdmin(null, false));
  $("resetAllWithBalanceBtn").addEventListener("click", () => resetPlayerResultsAdmin(null, true));
  $("deleteAllPlayersBtn").addEventListener("click", deleteAllPlayersAdmin);
  $("adminLogoutBtn").addEventListener("click", () => { adminToken = ""; localStorage.removeItem("nc_admin"); $("adminPanel").classList.add("hidden"); $("adminLoginView").classList.remove("hidden"); });
  p.querySelectorAll("[data-player-save]").forEach((b) => b.addEventListener("click", () => savePlayerAdmin(b.dataset.playerSave)));
  p.querySelectorAll("[data-player-reset]").forEach((b) => b.addEventListener("click", () => resetPlayerResultsAdmin([b.dataset.playerReset], true)));
  p.querySelectorAll("[data-player-del]").forEach((b) => b.addEventListener("click", () => deletePlayerAdmin(b.dataset.playerDel)));
}
function collectConfig() {
  const cfg = JSON.parse(JSON.stringify(config)); // start from current public config
  // ensure nested objects exist
  cfg.economy = cfg.economy || {}; cfg.coinflip = cfg.coinflip || {}; cfg.dice = cfg.dice || {}; cfg.mines = cfg.mines || {}; cfg.plinko = cfg.plinko || {};
  cfg.crash = cfg.crash || {}; cfg.blackjack = cfg.blackjack || {}; cfg.slots = cfg.slots || { weights: {}, triples: {} };
  document.querySelectorAll("#adminPanel [data-k]").forEach((inp) => {
    const path = inp.dataset.k.split("."); let obj = cfg;
    for (let i = 0; i < path.length - 1; i++) { obj[path[i]] = obj[path[i]] || {}; obj = obj[path[i]]; }
    obj[path[path.length - 1]] = Number(inp.value);
  });
  return cfg;
}
async function saveAdmin() {
  try {
    const d = await api("/admin/config", "PUT", { config: collectConfig() }, true);
    config = (await api("/config")).config;
    applyConfig();
    const state = await api("/admin/state", "GET", null, true);
    renderAdmin(d.config, state.stats, state.players || []);
    toast("Settings saved", "win");
  } catch (e) { toast(e.message, "lose"); }
}
async function resetAdmin() {
  try {
    const d = await api("/admin/reset", "POST", {}, true);
    config = (await api("/config")).config;
    applyConfig();
    const state = await api("/admin/state", "GET", null, true);
    renderAdmin(d.config, state.stats, state.players || []);
    toast("Reset to defaults", "win");
  }
  catch (e) { toast(e.message, "lose"); }
}

function playerRow(id) {
  return document.querySelector(`.player-edit-row[data-player="${CSS.escape(id)}"]`);
}

async function savePlayerAdmin(id) {
  const row = playerRow(id);
  if (!row) return;
  const body = {
    id,
    name: row.querySelector('[data-player-f="name"]').value,
    balance: Number(row.querySelector('[data-player-f="balance"]').value),
    stats: {
      gamesPlayed: Number(row.querySelector('[data-player-f="gamesPlayed"]').value),
      wagered: Number(row.querySelector('[data-player-f="wagered"]').value),
      won: Number(row.querySelector('[data-player-f="won"]').value),
      biggestWin: Number(row.querySelector('[data-player-f="biggestWin"]').value)
    }
  };
  try {
    await api("/admin/player", "PUT", body, true);
    await loadAdmin();
    loadLeaderboard();
    toast("Player saved", "win");
  } catch (e) { toast(e.message, "lose"); }
}

async function deletePlayerAdmin(id) {
  if (!confirm("Delete this player completely?")) return;
  try {
    await api("/admin/player", "DELETE", { id }, true);
    await loadAdmin();
    loadLeaderboard();
    toast("Player deleted", "win");
  } catch (e) { toast(e.message, "lose"); }
}

async function resetPlayerResultsAdmin(ids, resetBalance) {
  const msg = ids ? "Reset this player's results?" : resetBalance ? "Reset all results and balances?" : "Reset all player results?";
  if (!confirm(msg)) return;
  try {
    await api("/admin/players/reset-results", "POST", { ids, resetBalance }, true);
    await loadAdmin();
    loadLeaderboard();
    toast("Results reset", "win");
  } catch (e) { toast(e.message, "lose"); }
}

async function deleteAllPlayersAdmin() {
  if (!confirm("Delete all players and all results?")) return;
  try {
    await api("/admin/players/delete-all", "POST", {}, true);
    await loadAdmin();
    loadLeaderboard();
    toast("All players deleted", "win");
  } catch (e) { toast(e.message, "lose"); }
}

/* ---------- wiring ---------- */
$("enterBtn").addEventListener("click", enter);
$("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });
$("passwordInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });
$("logoutBtn").addEventListener("click", logout);
$("bonusBtn").addEventListener("click", claimBonus);
$("tabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) switchGame(t.dataset.game); });
$("spinBtn").addEventListener("click", spinSlots);
$("slotV2SpinBtn").addEventListener("click", spinSlotsV2);
$("slotV2BetMinus").addEventListener("click", () => setBet("slotsV2", Math.max(1, betValue("slotsV2") - 10)));
$("slotV2BetPlus").addEventListener("click", () => setBet("slotsV2", betValue("slotsV2") + 10));
$("slotV2InfoBtn").addEventListener("click", () => { buildSlotV2Paytable(); $("slotV2PaytableModal").classList.remove("hidden"); });
$("slotV2PayClose").addEventListener("click", () => $("slotV2PaytableModal").classList.add("hidden"));
$("slotV2BonusChests").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-pick]");
  if (b) pickSlotV2Bonus(Number(b.dataset.pick));
});
$("slotV2BonusDone").addEventListener("click", () => $("slotV2BonusModal").classList.add("hidden"));
$("slotV2BuyBonus").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-buy-slot-v2]");
  if (b) buySlotV2Bonus(b.dataset.buySlotV2);
});
$("shopItems").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-shop-buy]");
  if (b) buyShopItem(b.dataset.shopBuy);
});
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
$("minesStartBtn").addEventListener("click", startMines);
$("minesCashoutBtn").addEventListener("click", cashoutMines);
$("plinkoDropBtn").addEventListener("click", dropPlinko);
$("crashBtn").addEventListener("click", playCrash);
$("crashCashoutBtn").addEventListener("click", cashoutCrash);
$("adminBtn").addEventListener("click", openAdmin);
$("adminClose").addEventListener("click", closeAdmin);
$("adminLoginBtn").addEventListener("click", adminLogin);
$("adminUser").addEventListener("keydown", (e) => { if (e.key === "Enter") adminLogin(); });
$("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") adminLogin(); });
document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));

applyTranslations();
wireQuickChips();
boot();
setInterval(() => { if (player) renderBonus(); }, 30000);
