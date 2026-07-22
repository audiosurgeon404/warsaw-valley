// sw.js — офлайн-дружелюбность (золотое правило 6): сеть → кеш → тишина.
// Кешируем только GET-оболочку сайта; GraphQL (POST) не трогаем — у него свой кеш
// последних значений в localStorage (D-31).
const CACHE = "wv-shell-v1";

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // чужие хосты не кешируем
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m ?? Response.error()))
  );
});
