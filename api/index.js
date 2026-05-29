const { handleApi } = require("../lib/app");
const { handleCasinoApi } = require("../lib/casino");

module.exports = (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  if (pathname.startsWith("/api/casino/")) return handleCasinoApi(req, res);
  return handleApi(req, res);
};
