// main.js — точка входа. Грузит конфиг, опрашивает AirMQ, обновляет HUD и рисует сцену.
// Два цикла (docs/ARCHITECTURE.md §4): таймер данных (раз в минуту) и кадр рендера (rAF).
import { loadWorldConfig } from "./characters.js";
import { getManyStates } from "./airmq.js";
import { deriveWorld } from "./world.js";
import { initScene, drawFrame, pickAt, ART_W } from "./map.js";
import { mountChrome, renderCards, updateNews, setWeatherFx, setFocus } from "./ui.js";

let cfg = null;
let world = null;      // текущее состояние мира (обновляет таймер, читает rAF)
let selected = null;   // id выбранного персонажа

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Единственное место, где узнаём «который час в Варшаве» (D-27).
function warsawHour() {
  try {
    return parseInt(
      new Date().toLocaleString("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hour12: false }),
      10
    );
  } catch {
    return new Date().getHours();
  }
}

function onSelect(id) {
  selected = id;
  if (!world) return;
  renderCards(world.characters, selected, onSelect);
  setFocus(world.characters.find((c) => c.id === id) ?? null);
}

// Таймер данных: опрос датчиков → worldState → HUD. Кадр рендера сюда не заглядывает.
async function tick() {
  try {
    const states = await getManyStates(cfg.characters.map((c) => c.id));
    world = deriveWorld(cfg.characters, states, warsawHour());
    renderCards(world.characters, selected, onSelect);
    updateNews(world);
    setWeatherFx(world.fx);
    if (selected) setFocus(world.characters.find((c) => c.id === selected) ?? null);
  } catch (e) {
    // Сеть уже сфолбэчилась в airmq.js; сюда попадают только неожиданности.
    console.warn("[wv] tick:", e);
  }
}

// Целочисленный масштаб канваса (D-10): никакого дробного растягивания пикселей.
function fitCanvas() {
  const stage = document.querySelector(".stage");
  const cv = document.getElementById("scene");
  if (!stage || !cv) return;
  const scale = Math.max(1, Math.floor(stage.clientWidth / ART_W));
  cv.style.width = cv.width * scale + "px";
  cv.style.height = cv.height * scale + "px";
}

async function boot() {
  mountChrome(); // счётчик, часы, гостевая, музыка
  const loader = document.getElementById("loader");
  const t0 = performance.now();

  try {
    cfg = await loadWorldConfig();
  } catch {
    // Конфиг не загрузился — «мир спит», а не stack trace (D-24, золотое правило 3).
    if (loader) {
      loader.innerHTML = "";
      const p = document.createElement("p");
      p.className = "loader__oops";
      p.textContent = "💤 Мир спит: не удалось загрузить конфиг долины. Попробуй обновить страницу.";
      loader.append(p);
    }
    return;
  }

  const canvas = document.getElementById("scene");
  initScene(canvas);
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
  canvas.addEventListener("click", (e) => {
    const id = pickAt(e.clientX, e.clientY);
    if (id) onSelect(id);
  });

  await tick(); // первое наполнение мира

  // Кадр рендера: не ходит в сеть, только рисует текущий world (D-33).
  let t = 0;
  const loop = () => {
    if (!reduceMotion) t++;
    drawFrame(world, t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Таймер данных: не чаще раза в минуту (D-30).
  const interval = Math.max(cfg.world?.pollIntervalMs ?? 60000, 60000);
  setInterval(tick, interval);

  // Загрузчику даём мигнуть хотя бы секунду — так уютнее (à la 2003).
  const wait = Math.max(0, 1000 - (performance.now() - t0));
  setTimeout(() => loader?.classList.add("loader--done"), wait);

  // Офлайн-дружелюбность: кешируем оболочку сайта (золотое правило 6).
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
