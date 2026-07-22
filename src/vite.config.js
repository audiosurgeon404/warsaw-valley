// vite.config.js — dev-прокси AirMQ, чтобы обойти CORS локально (docs/API.md §6).
// В env.local.js тогда можно указать AIRMQ_ENDPOINT = "/airmq".
import { copyFileSync, mkdirSync } from "node:fs";

export default {
  plugins: [
    {
      // characters.json и sw.js грузятся fetch'ем/register'ом в рантайме — Vite про них
      // не знает и в dist не кладёт. Доносим руками, иначе прод падает в «мир спит».
      name: "wv-copy-runtime-files",
      closeBundle() {
        mkdirSync("dist/data", { recursive: true });
        copyFileSync("src/data/characters.json", "dist/data/characters.json");
        copyFileSync("src/sw.js", "dist/sw.js");
      },
    },
  ],
  server: {
    proxy: {
      "/airmq": {
        target: "https://api-app.airmq.cc",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/airmq/, "/graphql"),
      },
    },
  },
  build: {
    rollupOptions: {
      // Секретный конфиг НИКОГДА не попадает в бандл (D-21): на проде его нет,
      // и фронт сам фолбэчится на прокси /airmq (см. airmq.js). Без external
      // сборка либо упала бы без файла, либо вшила бы токен в публичный JS.
      external: (id) => id.includes("env.local.js"),
    },
  },
};
