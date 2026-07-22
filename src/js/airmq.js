// airmq.js — ЕДИНСТВЕННЫЙ сетевой слой (директива D-23).
// Остальной код не знает про GraphQL: он зовёт getCharacterState(id) и получает
// нормализованный объект состояния персонажа (форма — см. docs/ARCHITECTURE.md §3).

// Токен и настройки грузим динамически, чтобы отсутствие env.local.js не роняло сайт (D-24).
let CFG = null;
async function config() {
  if (CFG) return CFG;
  try {
    CFG = await import("../../config/env.local.js");
  } catch {
    console.warn("[airmq] нет config/env.local.js — работаем без сети (скопируй env.example.js).");
    CFG = { AIRMQ_TOKEN: "", AIRMQ_ENDPOINT: "", REQUEST_TIMEOUT_MS: 10000 };
  }
  return CFG;
}

const CURRENT_QUERY = `
  query Current($id: String!) {
    location(filter: { _id: $id }) {
      name isOnline metricList
      status { isOnline RSSI uptime build }
      currentValue { time Temp Hum Press PMS1 PMS25 PMS10 Count NOx VOC AQI }
    }
  }`;

const cacheKey = (id) => `wv:lastState:${id}`;

function toCache(id, state) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(state)); } catch {}
}
function fromCache(id, stale) {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (raw) return { ...JSON.parse(raw), stale };
  } catch {}
  return { id, name: null, online: false, time: null, metrics: {}, stale: true, empty: true };
}

function normalize(id, loc) {
  const cv = loc?.currentValue ?? {};
  return {
    id,
    name: loc?.name ?? null,
    online: !!loc?.isOnline,
    time: cv.time ?? null,
    metrics: {
      temp: cv.Temp ?? null, hum: cv.Hum ?? null, press: cv.Press ?? null,
      pm1: cv.PMS1 ?? null, pm25: cv.PMS25 ?? null, pm10: cv.PMS10 ?? null,
      count: cv.Count ?? null, nox: cv.NOx ?? null, voc: cv.VOC ?? null, aqi: cv.AQI ?? null,
    },
    // Техстатус датчика: сила Wi-Fi-сигнала (dBm) и сколько секунд работает без перерыва.
    rssi: loc?.status?.RSSI ?? null,
    uptime: loc?.status?.uptime ?? null,
    stale: false,
  };
}

// Текущее состояние одного персонажа. Всегда что-то возвращает: сеть → кеш → пустышка.
export async function getCharacterState(id) {
  const { AIRMQ_TOKEN, AIRMQ_ENDPOINT, REQUEST_TIMEOUT_MS } = await config();
  if (!AIRMQ_TOKEN || !AIRMQ_ENDPOINT) return fromCache(id, true);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS ?? 10000);
  try {
    const res = await fetch(AIRMQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: AIRMQ_TOKEN },
      body: JSON.stringify({ query: CURRENT_QUERY, variables: { id } }),
      signal: ctrl.signal,
    });
    const json = await res.json();
    const loc = json?.data?.location;
    if (!loc) return fromCache(id, true);
    const state = normalize(id, loc);
    if (loc.currentValue) toCache(id, state); // кешируем только реальные данные (D-31)
    return state;
  } catch {
    return fromCache(id, true); // фолбэк (D-24)
  } finally {
    clearTimeout(t);
  }
}

export function getManyStates(ids) {
  return Promise.all(ids.map(getCharacterState));
}
