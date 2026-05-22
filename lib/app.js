const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
const storePath = path.join(dataDir, "store.json");

const adminPassword = process.env.ADMIN_PASSWORD || "change-this-admin-password";
const tokenSecret = process.env.TOKEN_SECRET || "change-this-token-secret";
const githubToken = process.env.GITHUB_TOKEN || "";
const githubRepo = process.env.GITHUB_REPO || "";
const githubBranch = process.env.GITHUB_BRANCH || "main";
const githubStorePath = process.env.GITHUB_STORE_PATH || "private/store.json";
// Public assets repo — stores uploaded images/videos so they are publicly accessible via raw.githubusercontent.com
const githubAssetsRepo = process.env.GITHUB_ASSETS_REPO || "gtsafd/miami-lash-assets";
const githubAssetsBranch = process.env.GITHUB_ASSETS_BRANCH || "main";
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@miamilash.com";

async function handleApi(req, res) {
  try {
    if (req.method === "OPTIONS") return json(res, 204, {});

    const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;

    if (req.method === "POST" && pathname === "/api/redeem") return redeem(req, res);
    if (req.method === "GET" && pathname === "/api/course") return course(req, res);
    if (req.method === "POST" && pathname === "/api/progress") return progress(req, res);
    if (req.method === "POST" && pathname === "/api/upload") return uploadFile(req, res);
    if (req.method === "POST" && pathname === "/api/push/subscribe") return pushSubscribe(req, res);
    if (req.method === "POST" && pathname === "/api/push/send") return pushSend(req, res);
    if (req.method === "GET" && pathname === "/api/push/key") return json(res, 200, { publicKey: vapidPublicKey });
    if (req.method === "POST" && pathname === "/api/admin/login") return adminLogin(req, res);
    if (req.method === "GET" && pathname === "/api/admin/state") return adminState(req, res);
    if (req.method === "POST" && pathname === "/api/admin/codes") return adminCreateCode(req, res);
    if (req.method === "PUT" && pathname === "/api/admin/course") return adminUpdateCourse(req, res);
    if (req.method === "DELETE" && pathname.startsWith("/api/admin/codes/")) return adminDeleteCode(req, res, pathname);
    if (req.method === "DELETE" && pathname.startsWith("/api/admin/students/")) return adminResetStudent(req, res, pathname);

    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Server error" });
  }
}

async function redeem(req, res) {
  const body = await readJson(req);
  const code = String(body.code || "").trim().toUpperCase();
  const name = String(body.name || "").trim();
  const deviceId = String(body.deviceId || "").trim();
  if (!code || !name || !deviceId) return json(res, 400, { error: "Name, code and device are required" });

  const store = await readStore();
  const access = store.codes.find((item) => item.code === code);
  if (!access) return json(res, 403, { error: "This access code is not active" });
  if (access.redeemed && access.deviceId !== deviceId) return json(res, 403, { error: "This code is already activated on another device" });

  if (!access.redeemed) {
    access.redeemed = true;
    access.studentName = name;
    access.deviceId = deviceId;
    access.activatedAt = new Date().toISOString();
    access.completed = [];
  }

  const token = signToken({ type: "student", code, deviceId });
  await writeStore(store);
  json(res, 200, { token, user: userFromAccess(access), course: store.course });
}

async function course(req, res) {
  const auth = requireStudent(req);
  if (!auth.ok) return json(res, 401, { error: "Unauthorized" });
  const store = await readStore();
  const access = store.codes.find((item) => item.code === auth.payload.code && item.deviceId === auth.payload.deviceId);
  if (!access?.redeemed) return json(res, 401, { error: "Unauthorized" });
  json(res, 200, { user: userFromAccess(access), course: store.course });
}

async function progress(req, res) {
  const auth = requireStudent(req);
  if (!auth.ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  const completed = Array.isArray(body.completed) ? body.completed.map(String) : [];
  const store = await readStore();
  const access = store.codes.find((item) => item.code === auth.payload.code && item.deviceId === auth.payload.deviceId);
  if (!access?.redeemed) return json(res, 401, { error: "Unauthorized" });
  access.completed = [...new Set(completed)];
  await writeStore(store);
  json(res, 200, { user: userFromAccess(access) });
}

async function adminLogin(req, res) {
  const body = await readJson(req);
  const password = String(body.password || "");
  if (!safeEqual(password, adminPassword)) return json(res, 403, { error: "Wrong password" });
  json(res, 200, { token: signToken({ type: "admin" }) });
}

async function adminState(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  json(res, 200, publicAdminState(await readStore()));
}

async function adminCreateCode(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  const code = String(body.code || createCode()).trim().toUpperCase();
  const store = await readStore();
  if (!/^[A-Z0-9-]{6,40}$/.test(code)) return json(res, 400, { error: "Invalid code" });
  if (!store.codes.some((item) => item.code === code)) {
    store.codes.unshift({ code, redeemed: false, createdAt: new Date().toISOString(), completed: [] });
  }
  await writeStore(store);
  json(res, 200, publicAdminState(store));
}

async function adminDeleteCode(req, res, pathname) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const code = decodeURIComponent(pathname.split("/").pop()).toUpperCase();
  const store = await readStore();
  store.codes = store.codes.filter((item) => item.code !== code);
  await writeStore(store);
  json(res, 200, publicAdminState(store));
}

async function adminUpdateCourse(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const body = await readJson(req);
  if (!body.course?.lessons || !body.course?.resources) return json(res, 400, { error: "Invalid course" });
  const store = await readStore();
  if (!Array.isArray(body.course.products)) body.course.products = store.course?.products || [];
  // Strip oversized base64 data URLs from product images to keep store.json under 1 MB
  for (const p of body.course.products) {
    if (p.image && p.image.startsWith("data:") && p.image.length > 150_000) {
      p.image = ""; // too large — must use external URL
    }
  }
  store.course = body.course;
  await writeStore(store);
  json(res, 200, { course: store.course });
}

function requireStudent(req) {
  const payload = verifyToken(getBearer(req));
  return payload?.type === "student" ? { ok: true, payload } : { ok: false };
}

function requireAdmin(req) {
  const payload = verifyToken(getBearer(req));
  return payload?.type === "admin" ? { ok: true, payload } : { ok: false };
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

function publicAdminState(store) {
  return {
    codes: store.codes.map((item) => ({
      code: item.code,
      redeemed: Boolean(item.redeemed),
      studentName: item.studentName || "",
      activatedAt: item.activatedAt || "",
      createdAt: item.createdAt || "",
      completed: Array.isArray(item.completed) ? item.completed : []
    })),
    course: store.course,
    pushCount: (store.pushSubscriptions || []).length
  };
}

function userFromAccess(access) {
  return {
    name: access.studentName,
    code: access.code,
    completed: Array.isArray(access.completed) ? access.completed : [],
    activatedAt: access.activatedAt
  };
}

function createCode() {
  return `LASH-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function adminResetStudent(req, res, pathname) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  const code = decodeURIComponent(pathname.split("/").pop()).toUpperCase();
  const store = await readStore();
  const access = store.codes.find((item) => item.code === code);
  if (access) {
    access.redeemed = false;
    access.studentName = "";
    access.deviceId = "";
    access.activatedAt = "";
    access.completed = [];
  }
  await writeStore(store);
  json(res, 200, publicAdminState(store));
}

async function readStore() {
  if (githubToken && githubRepo) return readGithubStore();
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, JSON.stringify(defaultStore(), null, 2));
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
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
  // GitHub Contents API returns empty content for files > 1 MB — use download_url instead
  if (data.encoding === "base64" && data.content && data.content.trim()) {
    return JSON.parse(Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8"));
  }
  if (data.download_url) {
    const dl = await fetch(data.download_url, { headers: { Authorization: `Bearer ${githubToken}` } });
    if (!dl.ok) throw new Error(`GitHub store download failed: ${dl.status}`);
    return JSON.parse(await dl.text());
  }
  throw new Error("GitHub store: unable to read content (file may be too large)");
}

async function writeGithubStore(store) {
  const current = await githubRequest("GET");
  const sha = current.ok ? (await current.json()).sha : undefined;
  const body = {
    message: "Update course app data",
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
      if (body.length > 8_000_000) {
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
  const posterUrls = [
    "https://images.unsplash.com/photo-1589710751893-f9a6770ad71b?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=900&q=85"
  ];

  return {
    codes: [
      { code: "LASH-MIAMI-2026", redeemed: false, createdAt: new Date().toISOString(), completed: [] },
      { code: "HANNA-VIP-001", redeemed: false, createdAt: new Date().toISOString(), completed: [] }
    ],
    course: {
      settings: {
        brand: "MIAMI LASH COURSE",
        eyebrow: "Lash Artist | Hanna Kozak",
        hero: {
          en: { title: "Lash Course", script: "Miami", subtitle: "Classic foundations, mapping, retention and client care." },
          ru: { title: "Курс по ресницам", script: "Miami", subtitle: "База, моделирование, стойкость и забота о клиенте." }
        }
      },
      lessons: [
        lesson("welcome", posterUrls[0], "Welcome to Girls Miami", "Добро пожаловать в Girls Miami", "8 min · start here", "8 мин · начать здесь", "The first module sets the client experience: calm, premium, detailed and personal.", "Первый модуль задает ощущение сервиса: спокойно, премиально, детально и персонально.", ["Set up your clean working table before the client arrives.", "Take close-up before photos from front, left and right angles.", "Confirm the client wants soft glam, wispy, natural or full volume."], ["Подготовьте чистый рабочий стол до прихода клиента.", "Сделайте фото до: спереди, слева и справа.", "Уточните желаемый эффект: natural, wispy, soft glam или full volume."]),
        lesson("materials", posterUrls[2], "Materials and Prep", "Материалы и подготовка", "14 min · supplies", "14 мин · материалы", "Product handling is part of retention. Clean prep and stable adhesive conditions make the set last.", "Правильная работа с материалами напрямую влияет на носку. Чистая подготовка и стабильные условия дают лучший результат.", ["Prepare cleanser, primer, gel pads, tape, tweezers and adhesive.", "Check room humidity and temperature before opening glue.", "Use fresh stock and keep products closed between applications."], ["Подготовьте очищение, праймер, патчи, тейп, пинцеты и клей.", "Проверьте влажность и температуру перед открытием клея.", "Используйте свежие материалы и закрывайте продукты между этапами."]),
        lesson("mapping", posterUrls[1], "Lash Mapping", "Моделирование взгляда", "18 min · eye styling", "18 мин · схема", "A beautiful map should fit the face, not just copy a chart.", "Красивая схема должна подходить лицу и глазам, а не просто повторять шаблон.", ["Read the eye shape before choosing lengths.", "Mark zones on the pad before starting isolation.", "Balance curl, thickness and length with the natural lashes."], ["Оцените форму глаз перед выбором длин.", "Отметьте зоны на патче до начала изоляции.", "Подберите изгиб, толщину и длину под натуральные ресницы."]),
        lesson("isolation", posterUrls[4], "Isolation Technique", "Техника изоляции", "22 min · practice", "22 мин · практика", "Isolation is the difference between a pretty photo and a safe, professional set.", "Изоляция отличает просто красивое фото от безопасной профессиональной работы.", ["Separate one natural lash clearly before dipping.", "Keep adhesive amount small and controlled.", "Place extensions with clean direction and no stickies."], ["Четко отделите одну натуральную ресницу перед постановкой.", "Контролируйте количество клея.", "Ставьте ресницы ровно, без склеек и перекрестов."]),
        lesson("retention", posterUrls[3], "Retention Secrets", "Секреты носки", "16 min · troubleshooting", "16 мин · ошибки", "Most retention problems come from prep, environment or attachment angle.", "Большинство проблем с ноской связано с подготовкой, условиями или постановкой.", ["Check attachment area and distance from the eyelid.", "Watch humidity, glue age and drying speed.", "Teach aftercare before the client leaves."], ["Проверьте зону сцепки и расстояние от века.", "Следите за влажностью, возрастом клея и скоростью полимеризации.", "Объясните уход до того, как клиент уйдет."]),
        lesson("client-care", posterUrls[5], "Client Care and Aftercare", "Уход и сервис", "10 min · service", "10 мин · клиент", "The premium feeling continues after the appointment.", "Премиальное ощущение продолжается после процедуры.", ["Show the client how to wash lashes daily.", "Book fill timing based on natural lash cycle.", "Take final photos and record the map for next visit."], ["Покажите клиенту, как ежедневно очищать ресницы.", "Назначьте коррекцию с учетом цикла натуральных ресниц.", "Сделайте финальные фото и сохраните карту для следующего визита."])
      ],
      resources: [
        resource("supply-list", "Supply List", "Список материалов", "Adhesive, lashes, pads, tape, cleanser, primer, tweezers and disposable tools.", "Клей, ресницы, патчи, тейп, очищение, праймер, пинцеты и одноразовые инструменты."),
        resource("client-card", "Client Card", "Карта клиента", "Map, curl, length, thickness, glue, room conditions and aftercare notes.", "Схема, изгиб, длина, толщина, клей, условия кабинета и заметки по уходу."),
        resource("aftercare", "Aftercare", "Уход", "Daily washing, no oil products, brush gently and schedule fills on time.", "Ежедневное умывание, без масляных продуктов, аккуратное расчесывание и своевременная коррекция."),
        resource("checklist", "Checklist", "Чеклист", "Prep, isolation, attachment, direction, final brush, photos and next appointment.", "Подготовка, изоляция, постановка, направление, финальное расчесывание, фото и следующая запись.")
      ],
      products: []
    },
    pushSubscriptions: []
  };
}

function lesson(id, poster, enTitle, ruTitle, enMeta, ruMeta, enNote, ruNote, enSteps, ruSteps) {
  return { id, poster, content: { en: { title: enTitle, meta: enMeta, note: enNote, steps: enSteps }, ru: { title: ruTitle, meta: ruMeta, note: ruNote, steps: ruSteps } } };
}

function resource(id, enTitle, ruTitle, enText, ruText) {
  return { id, content: { en: { title: enTitle, text: enText }, ru: { title: ruTitle, text: ruText } } };
}

async function uploadFile(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  if (!githubToken) return json(res, 500, { error: "GitHub token not configured" });
  const body = await readJson(req);
  const { filename, contentType, data } = body;
  if (!filename || !data) return json(res, 400, { error: "Missing filename or data" });
  // Enforce size limit: base64 data should not exceed ~4MB (Vercel body limit)
  if (data.length > 5_500_000) return json(res, 413, { error: "File too large. Use YouTube for videos." });
  const ext = (filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const filePath = `uploads/${safeName}`;
  // Always upload to the PUBLIC assets repo so the URL is accessible without auth
  const response = await fetch(`https://api.github.com/repos/${githubAssetsRepo}/contents/${filePath}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: JSON.stringify({ message: `upload: ${filename}`, content: data, branch: githubAssetsBranch })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return json(res, 500, { error: `Upload failed: ${err.message || response.status}` });
  }
  // Return a public raw.githubusercontent.com URL — no auth needed
  const url = `https://raw.githubusercontent.com/${githubAssetsRepo}/${githubAssetsBranch}/${filePath}`;
  json(res, 200, { url });
}

async function pushSubscribe(req, res) {
  const auth = requireStudent(req);
  if (!auth.ok) return json(res, 401, { error: "Unauthorized" });
  const { subscription } = await readJson(req);
  if (!subscription?.endpoint) return json(res, 400, { error: "Invalid subscription" });
  const store = await readStore();
  if (!store.pushSubscriptions) store.pushSubscriptions = [];
  store.pushSubscriptions = store.pushSubscriptions.filter((s) => s.endpoint !== subscription.endpoint);
  store.pushSubscriptions.push({ ...subscription, addedAt: new Date().toISOString() });
  await writeStore(store);
  json(res, 200, { ok: true });
}

async function pushSend(req, res) {
  if (!requireAdmin(req).ok) return json(res, 401, { error: "Unauthorized" });
  if (!vapidPublicKey || !vapidPrivateKey) return json(res, 500, { error: "VAPID keys not configured" });
  const { title, body: notifBody } = await readJson(req);
  const store = await readStore();
  const subs = store.pushSubscriptions || [];
  if (subs.length === 0) return json(res, 200, { sent: 0, total: 0 });
  const webpush = require("web-push");
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  const payload = JSON.stringify({ title: title || "Miami Lash Course", body: notifBody || "" });
  let sent = 0;
  const dead = [];
  for (const sub of subs) {
    try { await webpush.sendNotification(sub, payload); sent++; }
    catch (err) { if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint); }
  }
  if (dead.length > 0) {
    store.pushSubscriptions = store.pushSubscriptions.filter((s) => !dead.includes(s.endpoint));
    await writeStore(store);
  }
  json(res, 200, { sent, total: subs.length });
}

module.exports = { handleApi };
