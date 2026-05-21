const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { handleApi } = require("./lib/app");

const root = __dirname;
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const port = Number(process.env.PORT || 5188);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res);
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Miami Lash Course running at http://127.0.0.1:${port}`);
  if (!process.env.ADMIN_PASSWORD) console.log("Set ADMIN_PASSWORD before deployment.");
  if (!process.env.TOKEN_SECRET) console.log("Set TOKEN_SECRET before deployment.");
});

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir) || filePath.startsWith(dataDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": filePath.endsWith("index.html") ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".css": "text/css; charset=utf-8"
  }[ext] || "application/octet-stream";
}
