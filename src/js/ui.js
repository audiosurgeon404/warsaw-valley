// ui.js — ретро-обёртка: карточки персонажей, новости-marquee, счётчик посещений,
// часы, гостевая книга (localStorage) и музыкальная шкатулка (WebAudio, по клику — D-14).
// Никакой сети и никакого GraphQL — только DOM и локальное состояние (D-23).
import { smogLevel, explain } from "./world.js";

const SMOG_LABEL = {
  clean: "чисто ☀", haze: "лёгкая дымка 🌤", smog: "смог 🌫",
  heavy: "плотный смог 😷", unknown: "нет данных",
};
const MOOD_FACE = { happy: ":)", neutral: ":|", sad: ":(", sleep: "z-z" };
const DAY_PHRASE = {
  night: "над долиной ночь 🌙", "cool-morning": "прохладное утро",
  "warm-day": "тёплый день", golden: "закатное золото над Вислой", frost: "морозно ❄",
};

// Единственное место конвертации UTC → Europe/Warsaw для UI (D-27).
function fmtWarsaw(iso, withDate = false) {
  if (!iso) return "—";
  try {
    const opts = withDate
      ? { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" };
    return new Date(iso).toLocaleString("ru-RU", opts);
  } catch { return iso; }
}

// Аптайм датчика (в секундах) → «по-человечески».
function fmtUptime(sec) {
  if (sec == null) return "—";
  if (sec < 120) return "только что перезапустился";
  if (sec < 7200) return `${Math.floor(sec / 60)} мин подряд`;
  if (sec < 172800) return `${Math.floor(sec / 3600)} ч подряд`;
  return `${Math.floor(sec / 86400)} дн подряд`;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// --- Карточки персонажей (HUD) -----------------------------------------
export function renderCards(chars, selectedId, onSelect) {
  const hud = document.getElementById("hud");
  if (!hud) return;
  hud.innerHTML = "";
  for (const c of chars) {
    const card = el("button", "card bevel-out" + (c.id === selectedId ? " card--selected" : ""));
    card.type = "button";
    card.setAttribute("aria-pressed", String(c.id === selectedId));

    const head = el("div", "card__name");
    head.append(el("span", null, c.displayName || c.name || c.id));
    head.append(el("span", "card__mood", MOOD_FACE[c.mood] ?? ""));
    card.append(head);

    const body = el("div", "card__body");
    const st = c.state ?? {};

    // Строка «метрика: значение» + вердикт человеческим языком (world.explain).
    const row = (label, val, kind, raw, hint) => {
      if (val == null) return;
      const r = el("div", "card__row");
      const name = el("span", null, label);
      if (hint) { name.title = hint; name.classList.add("card__hint"); }
      r.append(name, el("b", null, val));
      body.append(r);
      const verdict = kind ? explain(kind, raw) : null;
      if (verdict) body.append(el("div", `card__verdict verdict--${verdict.level}`, "→ " + verdict.text));
    };

    if (!c.present) {
      // online без данных = датчик только проснулся (частый случай после перепрошивки).
      body.append(el("span", "card__sleep", st.online
        ? "🌅 просыпается: датчик на связи, но данные ещё в пути…"
        : "💤 отдыхает дома" + (st.stale && st.time ? ` (последний привет: ${fmtWarsaw(st.time, true)})` : "")));
      if (st.online) row("Связь", st.rssi != null ? `${st.rssi} dBm` : null, "rssi", st.rssi,
        "Насколько уверенно датчик добивает до Wi-Fi.");
    } else {
      const m = st.metrics ?? {};
      // Подсказки — в тоне мира; развёрнуто — в «Азбуке воздуха» ниже.
      row("Температура", m.temp != null ? `${m.temp.toFixed(1)} °C` : null, "temp", m.temp,
        "Насколько тепло у двора. От неё красится небо долины.");
      row("Влажность", m.hum != null ? `${Math.round(m.hum)} %` : null, "hum", m.hum,
        "Вода в воздухе: >80% — туман над долиной, >90% — капли на стекле.");
      row("PM1", m.pm1 != null ? `${m.pm1} µg/m³` : null, "pm1", m.pm1,
        "Мельчайшие пылинки, тоньше дыма. Чем меньше — тем спокойнее дышится.");
      row("PM2.5", m.pm25 != null ? `${m.pm25} µg/m³` : null, "pm25", m.pm25,
        "Мелкая дымная пыль — главная мера смога: до 5 ясно, после 15 дымка, после 35 пелена.");
      row("PM10", m.pm10 != null ? `${m.pm10} µg/m³` : null, "pm10", m.pm10,
        "Крупная пыль с дорог и строек. Дальше носа обычно не улетает.");
      // Эти метрики есть не у всех датчиков — строка появится, как только датчик начнёт их мерить (D-20).
      row("Давление", m.press != null ? `${Math.round(m.press)} hPa` : null, "press", m.press,
        "Как сильно воздух давит на долину. Резкое падение — к непогоде.");
      row("Радиация", m.count != null ? `${m.count} µSv/h` : null, "count", m.count,
        "Природный фон есть везде: 0.1–0.3 — спокойная норма.");
      row("NOx", m.nox != null ? `${m.nox}` : null, "nox", m.nox,
        "Газы выхлопных труб. Индекс: ~100 — обычный городской уровень.");
      row("VOC", m.voc != null ? `${m.voc}` : null, "voc", m.voc,
        "«Запах ремонта»: испарения красок и химии. Индекс: ~100 — норма.");
      row("AQI", m.aqi != null ? `${m.aqi}` : null, "aqi", m.aqi,
        "Общий индекс качества воздуха: до 50 — хорошо.");
      row("Воздух", SMOG_LABEL[smogLevel(m.pm25)], null, null,
        "Итог по PM2.5: чем чище — тем счастливее персонаж.");
      row("Связь", st.rssi != null ? `${st.rssi} dBm` : null, "rssi", st.rssi,
        "Насколько уверенно датчик добивает до Wi-Fi.");
      if (st.uptime != null) {
        const up = el("div", "card__row");
        up.append(el("span", null, "Работает"), el("b", null, fmtUptime(st.uptime)));
        body.append(up);
      }
      const upd = el("div", "card__row");
      upd.append(el("span", null, "Обновлено"));
      upd.append(el("span", st.stale ? "card__stale" : "", fmtWarsaw(st.time)));
      body.append(upd);
    }
    card.append(body);
    card.addEventListener("click", () => onSelect?.(c.id));
    hud.append(card);
  }
}

// --- Новости-marquee ----------------------------------------------------
export function updateNews(world) {
  const news = document.getElementById("news");
  if (!news || !world) return;
  const parts = [DAY_PHRASE[world.daylight] ?? ""];
  for (const c of world.characters) {
    const name = c.displayName || c.name || c.id;
    if (!c.present) { parts.push(`${name} спит 💤`); continue; }
    const m = c.state?.metrics ?? {};
    const bits = [];
    if (m.temp != null) bits.push(`${m.temp.toFixed(1)}°C`);
    bits.push(SMOG_LABEL[c.smog] ?? "");
    parts.push(`${name}: ${bits.filter(Boolean).join(", ")}`);
  }
  if (world.fx === "drops") parts.push("на стекле — капли дождя 💧");
  if (world.fx === "snow") parts.push("над Варшавой идёт снег ❄");
  news.textContent = "✦ " + parts.filter(Boolean).join(" ✦ ") + " ✦";
}

// Подпись под сценой — кто выбран и как ему дышится.
export function setFocus(char) {
  const f = document.getElementById("focus");
  if (!f) return;
  if (!char) { f.textContent = "кликни по двору персонажа →"; return; }
  const name = char.displayName || char.name || char.id;
  f.textContent = char.present
    ? `${name} — дома, ${SMOG_LABEL[char.smog] ?? ""}`
    : `${name} — сейчас спит 💤`;
}

// Капли/снег на «стекле» сайта — CSS-классами на сцене.
export function setWeatherFx(fx) {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  stage.classList.toggle("stage--drops", fx === "drops");
  stage.classList.toggle("stage--snow", fx === "snow");
}

// --- Оболочка: счётчик, часы, гостевая, музыка --------------------------
export function mountChrome() {
  // Счётчик посещений в духе нулевых (локальный, честно-наивный).
  try {
    const n = parseInt(localStorage.getItem("wv:visits") || "0", 10) + 1;
    localStorage.setItem("wv:visits", String(n));
    const c = document.getElementById("counter");
    if (c) c.textContent = String(n).padStart(5, "0");
  } catch { /* приватный режим — и ладно */ }

  // Часы Варшавы в статус-баре.
  const clock = document.getElementById("clock");
  if (clock) {
    const tickClock = () => { clock.textContent = "🕑 Warszawa " + fmtWarsaw(new Date().toISOString()); };
    tickClock();
    setInterval(tickClock, 30000);
  }

  initGuestbook();
  const musicBtn = document.getElementById("music-btn");
  if (musicBtn) initMusic(musicBtn);
}

// --- Гостевая книга (localStorage, D-31-стиль) --------------------------
const GB_KEY = "wv:guestbook";

function gbLoad() {
  try {
    const a = JSON.parse(localStorage.getItem(GB_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

function gbRender() {
  const list = document.getElementById("gb-entries");
  if (!list) return;
  const entries = gbLoad();
  list.innerHTML = "";
  if (!entries.length) {
    list.append(el("p", "gb__empty", "Пока пусто. Оставь привет персонажам первым! ✍"));
    return;
  }
  for (const e of entries.slice().reverse()) {
    const item = el("div", "gb__entry");
    const head = el("div", "gb__head");
    head.append(el("b", null, e.name || "гость"));
    head.append(el("span", "gb__when", fmtWarsaw(e.time, true)));
    item.append(head);
    item.append(el("p", "gb__msg", e.msg ?? ""));
    list.append(item);
  }
}

function initGuestbook() {
  const form = document.getElementById("gb-form");
  if (!form) return;
  gbRender();
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = (document.getElementById("gb-name")?.value ?? "").trim().slice(0, 24);
    const msg = (document.getElementById("gb-msg")?.value ?? "").trim().slice(0, 200);
    if (!msg) return;
    const entries = gbLoad();
    entries.push({ name, msg, time: new Date().toISOString() });
    while (entries.length > 100) entries.shift();
    try { localStorage.setItem(GB_KEY, JSON.stringify(entries)); } catch {}
    form.reset();
    gbRender();
  });
}

// --- Музыкальная шкатулка (WebAudio, без ассетов и автоплея — D-14) ------
function initMusic(btn) {
  let box = null;
  btn.addEventListener("click", () => {
    if (!box) box = createMusicBox();
    if (!box) return; // WebAudio недоступен — кнопка просто молчит
    const on = box.toggle();
    btn.textContent = on ? "♪ музыка: вкл" : "♪ музыка: выкл";
    btn.setAttribute("aria-pressed", String(on));
  });
}

function createMusicBox() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.13;
  master.connect(ctx.destination);

  // Тихий вальс в ля-миноре: пентатоника, ~86 bpm. Длительности — в долях.
  const MEL = [
    [69, 1], [72, 1], [76, 2], [74, 1], [72, 1], [69, 2],
    [67, 1], [69, 1], [72, 2], [76, 1], [74, 1], [72, 2],
    [69, 1], [67, 1], [64, 2], [67, 1], [69, 1], [69, 3],
  ];
  const BASS = [45, 41, 43, 40]; // A2 F2 G2 E2 — по такту
  const SPB = 60 / 86;

  let playing = false, timer = null;
  let melT = 0, bassT = 0, mi = 0, bi = 0;

  function note(midi, t, dur, type, vol) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function pump() {
    const ahead = ctx.currentTime + 0.7;
    while (melT < ahead) {
      const [m, d] = MEL[mi % MEL.length];
      note(m, melT, d * SPB, "triangle", 0.8);
      mi++; melT += d * SPB;
    }
    while (bassT < ahead) {
      note(BASS[bi % BASS.length], bassT, 3 * SPB, "sine", 0.4);
      bi++; bassT += 3 * SPB;
    }
  }

  return {
    toggle() {
      playing = !playing;
      if (playing) {
        ctx.resume();
        melT = bassT = ctx.currentTime + 0.1;
        pump();
        timer = setInterval(pump, 250);
      } else {
        clearInterval(timer);
        timer = null;
        ctx.suspend();
      }
      return playing;
    },
  };
}
