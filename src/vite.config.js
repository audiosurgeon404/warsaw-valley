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
};
