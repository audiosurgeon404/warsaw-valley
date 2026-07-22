# API — интеграция с AirMQ

Живые данные мира берём из **AirMQ GraphQL API**. Ниже — только то, что нужно проекту.
Схема проверена вживую на датчиках Варшавы (Fiodar H, Dwoch Mieczy).

---

## 1. Подключение

| Параметр        | Значение |
|-----------------|----------|
| Эндпоинт (прод) | `https://api-app.airmq.cc/graphql` |
| Метод           | всегда `POST`, `Content-Type: application/json` |
| Авторизация     | заголовок `Authorization: <JWT-токен>` (роль `apiUser`) |
| Движок          | Apollo Server + InfluxDB |
| Интроспекция    | закрыта на проде; открыта на `https://api.airmq.cc/graphql` (для изучения схемы) |

> Токен — **секрет**. Он лежит в `config/env.local.js` (gitignored). Никогда не коммитим.

## 2. Модель данных (то, что используем)

`SensorData` — одно измерение:

| Поле    | Смысл                    | Ед.     |
|---------|--------------------------|---------|
| `time`  | метка времени (UTC, ISO) | —       |
| `Temp`  | температура              | °C      |
| `Hum`   | влажность                | %       |
| `Press` | давление                 | hPa     |
| `PMS1`  | PM1                      | µg/m³   |
| `PMS25` | PM2.5                    | µg/m³   |
| `PMS10` | PM10                     | µg/m³   |
| `Count` | радиоактивность          | µSv/h   |
| `NOx`   | оксиды азота (индекс)    | —       |
| `VOC`   | летучие органич. (индекс)| —       |
| `AQI`   | индекс качества воздуха  | —       |

> ⚠️ Каждый датчик меряет **свой набор** — см. `metricList` у локации. У варшавских
> датчиков это `["PMS1","PMS25","PMS10","Temp","Hum"]`; `Press/Count/NOx/VOC/AQI` = `null`.

## 3. Запросы, которые нам нужны

### 3.1 Текущее состояние персонажа (главный запрос)

```graphql
query Current($id: String!) {
  location(filter: { _id: $id }) {
    name
    isOnline
    metricList
    status { isOnline RSSI uptime build }
    currentValue {
      time Temp Hum Press PMS1 PMS25 PMS10 Count NOx VOC AQI
    }
  }
}
```
Переменные: `{ "id": "PL010010258" }`.

### 3.2 Список датчиков Варшавы (для проверки/добавления персонажей)

```graphql
query { locations(filter: { city: "Warsaw" }) { _id name isOnline metricList } }
```
Наши: `PL010010258` (Fiodar H), `PL010010395` (Dwoch Mieczy). Есть ещё `Alexi's Device`.

### 3.3 История (для графиков/трендов, опционально)

`timeSeries` требует **абсолютных** границ времени (t_from/t_to), интервал — опционально:

```graphql
query History($id: String!, $from: String!, $to: String!) {
  location(filter: { _id: $id }) {
    timeSeries(filter: { t_from: $from, t_to: $to, interval_m: 30 }) {
      time Temp Hum PMS1 PMS25 PMS10
    }
  }
}
```
> Без `t_from`/`t_to` вернётся ошибка InfluxDB. Последняя точка окна часто `null`
> (интервал ещё не закрыт) — это нормально, обрабатываем.

## 4. Пример клиента (набросок для `src/js/airmq.js`)

```js
import { AIRMQ_TOKEN, AIRMQ_ENDPOINT } from "../../config/env.local.js";

const CURRENT = /* GraphQL из 3.1 */;

export async function getCharacterState(id) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000); // таймаут (D-24)
  try {
    const res = await fetch(AIRMQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: AIRMQ_TOKEN },
      body: JSON.stringify({ query: CURRENT, variables: { id } }),
      signal: ctrl.signal,
    });
    const json = await res.json();
    const loc = json?.data?.location;
    if (!loc) return fromCache(id, /*stale*/ true);
    const cv = loc.currentValue ?? {};
    const state = {
      id, name: loc.name, online: !!loc.isOnline, time: cv.time ?? null,
      metrics: {
        temp: cv.Temp ?? null, hum: cv.Hum ?? null, press: cv.Press ?? null,
        pm1: cv.PMS1 ?? null, pm25: cv.PMS25 ?? null, pm10: cv.PMS10 ?? null,
        count: cv.Count ?? null, nox: cv.NOx ?? null, voc: cv.VOC ?? null, aqi: cv.AQI ?? null,
      },
      stale: false,
    };
    toCache(id, state);            // D-31
    return state;
  } catch (e) {
    return fromCache(id, true);    // фолбэк на кеш → «мир спит» (D-24)
  } finally {
    clearTimeout(t);
  }
}
```

`fromCache`/`toCache` — обёртки над `localStorage` (ключ `wv:lastState:<id>`).

## 5. Известные ограничения нашего токена

- Роль `apiUser`. Работают: `location`, `locations`, `getMarkers`, `cityList`, `timeSeries`.
- **`cityAverage` / `cityAverages` → FORBIDDEN.** Средние по городу считаем сами, если надо.
- `myLocations` пуст — к аккаунту токена датчики не привязаны (данные читаем как публичные).
- Срок жизни токена ограничен (`exp` в JWT). Истечёт — обновить через панель AirMQ.

## 6. Безопасность токена (важно для деплоя)

Токен в браузерном коде **виден всем**, кто откроет DevTools. Это приемлемо для локального
запуска, но **не** для публичного сайта.

- **Локально / приватно**: токен в `config/env.local.js`, фронт ходит напрямую. Если мешает
  CORS — запускать через `npm run dev` (Vite proxy) или локальный прокси.
- **Публичный деплой**: подними тонкий прокси (Cloudflare Worker / Vercel Function / крошечный
  Node), который хранит токен на сервере и проксирует только нужные запросы. Фронт ходит на
  свой прокси без токена. Тогда секрет не утекает.

Пример dev-прокси в Vite (`vite.config.js`), чтобы обойти CORS локально:

```js
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
```
