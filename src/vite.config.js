// vite.config.js — dev-прокси AirMQ, чтобы обойти CORS локально (docs/API.md §6).
// В env.local.js тогда можно указать AIRMQ_ENDPOINT = "/airmq".
export default {
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
