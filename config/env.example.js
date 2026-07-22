// env.example.js — ШАБЛОН конфигурации (этот файл В git).
//
// Как использовать:
//   1) Скопируй в env.local.js:  cp config/env.example.js config/env.local.js
//   2) Впиши свой реальный AIRMQ_TOKEN в env.local.js
//   3) env.local.js НЕ коммитится (см. .gitignore) — это секрет.

// JWT-токен AirMQ (роль apiUser). СЕКРЕТ — только в env.local.js!
export const AIRMQ_TOKEN = "PASTE_YOUR_AIRMQ_JWT_HERE";

// Боевой GraphQL-эндпоинт AirMQ.
// Если браузер ругается на CORS при запуске через `npm run dev` — поставь "/airmq":
// Vite-прокси (см. src/vite.config.js) сам переправит запросы на api-app.airmq.cc.
export const AIRMQ_ENDPOINT = "https://api-app.airmq.cc/graphql";

// Как часто опрашивать датчики (мс). Не чаще 60000 — данные обновляются ~раз в минуту (D-30).
export const POLL_INTERVAL_MS = 60000;

// Таймаут одного сетевого запроса (мс).
export const REQUEST_TIMEOUT_MS = 10000;
