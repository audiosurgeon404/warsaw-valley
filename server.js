// server.js — тонкий прод-сервер для Render (docs/API.md §6 «Безопасность токена»).
// Делает ровно две вещи (D-60: никакой платформы):
//   1) отдаёт статику из dist/ (результат `npm run build`);
//   2) проксирует POST /airmq → AirMQ GraphQL, добавляя токен из env AIRMQ_TOKEN.
// Токен живёт только на сервере — в браузер он не попадает никогда (D-21).
// Зависимостей нет: голый node:http + fetch (Node 18+).

import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, extname, resolve } from "node:path";

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.AIRMQ_TOKEN || "";
const UPSTREAM = process.env.AIRMQ_UPSTREAM || "https://api-app.airmq.cc/graphql";
const DIST = resolve(process.cwd(), "dist");
const MAX_BODY = 32 * 1024; // GraphQL-запросы сайта крошечные; всё крупнее — не наше

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

function proxyAirmq(req, res) {
  let body = "";
  let overflow = false;
  req.on("data", (c) => {
    body += c;
    if (body.length > MAX_BODY) { overflow = true; req.destroy(); }
  });
  req.on("end", async () => {
    if (overflow) return;
    try {
      const up = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(TOKEN ? { Authorization: TOKEN } : {}),
        },
        body,
        signal: AbortSignal.timeout(12000),
      });
      const text = await up.text();
      res.writeHead(up.status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(text);
    } catch {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end('{"errors":[{"message":"upstream unavailable"}]}');
    }
  });
}

function serveStatic(req, res) {
  let path = decodeURIComponent((req.url || "/").split("?")[0]);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) { // не выпускаем наружу из dist/
    res.writeHead(403).end();
    return;
  }
  const found = existsSync(file) && statSync(file).isFile()
    ? file
    // путь без расширения — отдаём индекс; «файл» с расширением — честный 404
    : (extname(file) === "" ? join(DIST, "index.html") : null);
  if (!found) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — в долине такого нет");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(found)] ?? "application/octet-stream" });
  createReadStream(found).pipe(res);
}

http.createServer((req, res) => {
  if (req.url?.split("?")[0] === "/airmq" && req.method === "POST") return proxyAirmq(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`🌾 Warsaw Valley слушает порт ${PORT}${TOKEN ? "" : " (AIRMQ_TOKEN не задан — мир будет спать)"}`);
});
