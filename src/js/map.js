// map.js — рендер пиксельной сцены «долины Варшава» на canvas.
// Рисуем процедурно прямоугольниками в низком разрешении (ART_W×ART_H), а CSS
// растягивает canvas с image-rendering: pixelated — получаем чёткий пиксель-арт (D-10).
//
// Один общий мир, два двора со своим характером (см. docs/CHARACTERS.md):
//   • Fiodar H     — высокая каменица, тёплое окно под крышей, рыжий кот (ночной мотив).
//   • Dwoch Mieczy — усадьба с апельсиновым/вишнёвым деревом, зелёный забор, пёс + 2 кота (закат).
// Небо — общее, зависит от живых данных (world.palette). Свет в окнах, смог и «сон»
// у каждого двора — от его собственного датчика.

export const ART_W = 320;
export const ART_H = 180;

// Палитра (зеркалит docs/DESIGN.md / theme.css — canvas не читает CSS-переменные).
const C = {
  skyDayTop: "#8ec7d2", skyDayBot: "#cfeaf0",
  skyGoldTop: "#e6a15b", skyGoldBot: "#f4d59a",
  skyNightTop: "#1e2148", skyNightBot: "#3a3f74",
  skyFrostTop: "#9fbfd6", skyFrostBot: "#dfeef5",
  grass: "#6a9c48", grassDark: "#4b7332", dirt: "#9c6b3f", dirtDark: "#7a4b2b",
  water: "#4a90c2", waterDark: "#3a72a0",
  wood: "#7a4b2b", woodDark: "#5c3820", roof: "#8a5a3a", roofDark: "#5f3c25",
  wall: "#d9cdb8", wallDark: "#b3a488", wallStone: "#c4bdb0", wallStoneDk: "#9a9182",
  windowLit: "#f4a94b", windowLit2: "#ffcf7a", windowDark: "#2c3550", frame: "#e8e2d2",
  leaf: "#3f7d3a", leafDark: "#2c5a2b", trunk: "#6b4a2b",
  orange: "#e58a2b", cherry: "#c2456b",
  fence: "#3f7a46", fenceDark: "#2c5730",
  moon: "#eae6d0", sun: "#ffd873", star: "#fbf6d8", cloud: "#e9dcc9", cloudNight: "#4a4f80",
  skin: "#e8b48a", hairDark: "#3a2a1e", hairBlonde: "#e6c96a", beanie: "#8a8f9c",
  olive: "#7f8a54", teal: "#37a7a0", black: "#2a2a2a", jeans: "#3a3f55",
  dog: "#2a2a2a", dogWhite: "#efe9dd", dogTan: "#b5713a",
  catGinger: "#e08b3e", catTux: "#2a2a2a", white: "#f2ede0", smog: "#b9b6a8",
  label: "#000000", labelText: "#ffffff",
};

// Хитбоксы дворов для кликов: id -> {x,y,w,h} в арт-координатах.
let hitboxes = [];
let CANVAS = null, CTX = null;

export function initScene(canvas) {
  CANVAS = canvas;
  canvas.width = ART_W;
  canvas.height = ART_H;
  CTX = canvas.getContext("2d");
  CTX.imageSmoothingEnabled = false;
}

// --- примитив: «пиксель»-прямоугольник ---
function R(x, y, w, h, color) { CTX.fillStyle = color; CTX.fillRect(x | 0, y | 0, w | 0, h | 0); }

// Перевод клика (клиентские px) в арт-координаты и поиск двора под курсором.
export function pickAt(clientX, clientY) {
  if (!CANVAS) return null;
  const r = CANVAS.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * ART_W;
  const y = ((clientY - r.top) / r.height) * ART_H;
  for (const hb of hitboxes) {
    if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) return hb.id;
  }
  return null;
}

// ================= Небо / погода мира =================
function drawSky(paletteKey) {
  let top = C.skyDayTop, bot = C.skyDayBot;
  if (paletteKey === "golden") { top = C.skyGoldTop; bot = C.skyGoldBot; }
  else if (paletteKey === "night") { top = C.skyNightTop; bot = C.skyNightBot; }
  else if (paletteKey === "frost") { top = C.skyFrostTop; bot = C.skyFrostBot; }
  const g = CTX.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  CTX.fillStyle = g; CTX.fillRect(0, 0, ART_W, 122);
}

function drawStars(t) {
  // Детерминированные «звёзды» + мигание.
  const pts = [[24,18],[52,30],[88,14],[140,22],[176,12],[210,28],[250,16],[288,24],[300,40],[36,44]];
  pts.forEach(([x, y], i) => {
    if ((Math.floor(t / 30) + i) % 5 !== 0) R(x, y, 1, 1, C.star);
  });
}

function drawCelestial(paletteKey) {
  if (paletteKey === "night" || paletteKey === "frost") {
    // Луна с лёгким гало.
    R(264, 20, 16, 16, "rgba(234,230,208,0.15)");
    R(266, 22, 12, 12, C.moon); R(270, 22, 8, 12, C.moon);
    R(272, 24, 6, 8, C.skyNightTop); // «полумесяц»-вырез (для ночи), для frost оставим круг
    if (paletteKey === "frost") R(266, 22, 12, 12, C.moon);
  } else {
    // Солнце у горизонта.
    R(40, 74, 22, 22, "rgba(255,216,115,0.25)");
    R(44, 78, 14, 14, C.sun);
  }
}

function drawClouds(t, paletteKey) {
  const col = paletteKey === "night" ? C.cloudNight : C.cloud;
  const off = Math.floor(t / 6) % (ART_W + 60);
  const puff = (bx, by) => { R(bx, by, 22, 6, col); R(bx + 5, by - 4, 14, 5, col); };
  puff(((30 + off) % (ART_W + 60)) - 30, 28);
  puff(((150 + off) % (ART_W + 60)) - 30, 46);
  puff(((240 + off) % (ART_W + 60)) - 30, 20);
}

// ================= Земля / река =================
function drawGround() {
  R(0, 120, ART_W, ART_H - 120, C.grass);
  // Тень травы полосой у горизонта.
  R(0, 120, ART_W, 4, C.grassDark);
  // Речка (Висла) вдоль низа.
  R(0, 168, ART_W, 12, C.water);
  R(0, 168, ART_W, 2, C.waterDark);
  // Дорожка-брусчатка по центру к домам.
  for (let y = 124; y < 168; y += 4) R(150, y, 20, 3, y % 8 ? C.dirt : C.dirtDark);
  // Мостик через речку.
  R(146, 166, 28, 6, C.wood); R(146, 166, 28, 1, C.woodDark);
}

// ================= Персонажи-спрайты (крошечные) =================
function figure(x, y, hair, top, legs, hairStyle) {
  R(x, y, 6, 5, C.skin);                 // голова
  if (hairStyle === "curly") { R(x - 1, y - 2, 8, 3, hair); R(x - 1, y, 1, 3, hair); R(x + 6, y, 1, 3, hair); }
  else if (hairStyle === "beanie") { R(x - 1, y - 2, 8, 3, hair); }
  else if (hairStyle === "long") { R(x - 1, y - 2, 8, 3, hair); R(x - 1, y + 1, 1, 6, hair); R(x + 6, y + 1, 1, 6, hair); }
  R(x, y + 5, 6, 6, top);                // тело
  R(x, y + 11, 2, 3, legs); R(x + 4, y + 11, 2, 3, legs); // ноги
}

function bernese(x, y) {
  R(x, y + 3, 12, 6, C.dog);             // корпус
  R(x + 10, y, 5, 5, C.dog);             // голова
  R(x + 11, y + 3, 3, 2, C.dogTan);      // морда (подпал)
  R(x + 2, y + 6, 4, 3, C.dogWhite);     // белая грудь
  R(x, y + 9, 2, 3, C.dog); R(x + 9, y + 9, 2, 3, C.dog); // лапы
  R(x - 2, y + 3, 3, 2, C.dog);          // хвост
}

function cat(x, y, color, curled) {
  if (curled) { R(x, y + 2, 8, 4, color); R(x + 6, y, 3, 3, color); R(x, y + 1, 2, 2, color); } // спит клубком
  else { R(x, y + 2, 7, 3, color); R(x + 6, y, 3, 3, color); R(x + 6, y - 1, 1, 1, color); R(x, y + 5, 1, 2, color); R(x + 5, y + 5, 1, 2, color); }
}

function zzz(x, y) { R(x, y, 3, 1, C.white); R(x + 2, y - 2, 3, 1, C.white); R(x + 4, y - 4, 3, 1, C.white); }

// ================= Двор Fiodar H: каменица =================
function drawTenement(char, t) {
  const x = 24, top = 26, w = 84, ground = 130;
  hitboxes.push({ id: char.id, x: x - 6, y: top - 8, w: w + 12, h: ground - top + 16 });

  // Крыша жестяная + карниз.
  R(x - 4, top, w + 8, 6, C.roofDark);
  R(x - 4, top - 3, w + 8, 3, C.wallStoneDk);
  // Антенны и тарелка на крыше.
  R(x + 10, top - 10, 1, 8, C.woodDark); R(x + 8, top - 10, 5, 1, C.woodDark);
  R(x + 60, top - 8, 1, 6, C.woodDark);
  R(x + 66, top - 7, 4, 3, C.wallStoneDk); // тарелка
  // Голуби на коньке.
  R(x + 20, top - 2, 2, 1, C.wallStoneDk); R(x + 30, top - 2, 2, 1, C.wallStoneDk);

  // Фасад (штукатурка).
  R(x, top + 3, w, ground - top - 3, C.wallStone);
  R(x, top + 3, 3, ground - top - 3, C.wallStoneDk);   // тень слева
  R(x + w - 3, top + 3, 3, ground - top - 3, C.wallStoneDk);
  // Пилястры.
  for (const px of [x + 6, x + w - 10]) R(px, top + 6, 3, ground - top - 8, C.wallDark);

  // Ряды тёмных окон.
  const cols = [x + 16, x + 34, x + 52];
  const rows = [top + 26, top + 44, top + 62, top + 80];
  rows.forEach((ry) => cols.forEach((cx) => {
    R(cx, ry, 10, 12, C.frame); R(cx + 1, ry + 1, 8, 10, C.windowDark);
    R(cx + 4, ry + 1, 1, 10, C.frame); R(cx + 1, ry + 5, 8, 1, C.frame);
  }));

  // Сигнатурное окно под крышей: тёплый свет, если двор online.
  const wx = x + 30, wy = top + 8, present = char.present;
  R(wx - 2, wy - 2, 22, 16, C.frame);
  if (present) {
    const glow = (Math.floor(t / 20) % 2) ? C.windowLit : C.windowLit2;
    R(wx, wy, 18, 12, glow);
    // Полки/лампа-намёки.
    R(wx + 1, wy + 1, 4, 3, C.woodDark); R(wx + 14, wy + 1, 3, 6, C.woodDark);
    R(wx + 8, wy + 2, 2, 3, C.frame);
    // Фигура Fiodar (кудри, оливковый свитер) у подоконника.
    figure(wx + 6, wy + 3, C.hairDark, C.olive, C.olive, "curly");
    // Рыжий кот на подоконнике.
    cat(wx + 13, wy + 7, C.catGinger, true);
    // Распахнутые створки.
    R(wx - 4, wy - 2, 3, 16, C.frame); R(wx + 19, wy - 2, 3, 16, C.frame);
  } else {
    R(wx, wy, 18, 12, C.windowDark);
    zzz(wx + 20, wy);
  }

  applySmog(char, x - 6, top - 8, w + 12, ground - top + 16);
  label(char.displayName, x + w / 2, ground + 3);
}

// ================= Двор Dwoch Mieczy: усадьба =================
function drawCottage(char, t) {
  const x = 196, ground = 132, present = char.present;
  hitboxes.push({ id: char.id, x: x - 14, y: 74, w: 118, h: 70 });

  // Апельсиновое дерево (слева).
  tree(x - 12, 96, C.orange);
  // Дом.
  R(x, 100, 60, ground - 100, C.wall);
  R(x, 100, 60, 3, C.wallDark);
  R(x, 100, 3, ground - 100, C.wallDark);
  // Двускатная крыша.
  for (let i = 0; i < 16; i++) R(x + i, 100 - i, 60 - i * 2, 2, i % 2 ? C.roof : C.roofDark);
  R(x + 16, 84, 28, 16, C.roof); R(x + 16, 84, 28, 2, C.roofDark);
  // Мансардное окошко.
  R(x + 26, 88, 8, 8, present ? C.windowLit : C.windowDark); R(x + 25, 87, 10, 1, C.frame);
  // Дверь + фонарь у крыльца (тёплый, если online).
  R(x + 26, ground - 16, 10, 16, C.woodDark);
  R(x + 20, ground - 20, 2, 4, present ? C.windowLit2 : C.windowDark);
  // Окна дома.
  for (const wx of [x + 8, x + 44]) {
    R(wx, ground - 22, 9, 11, C.frame);
    R(wx + 1, ground - 21, 7, 9, present ? C.windowLit : C.windowDark);
  }
  // Вишнёвое дерево (справа).
  tree(x + 70, 92, C.cherry);

  // Зелёный кованый забор вдоль двора.
  for (let fx = x - 14; fx < x + 96; fx += 5) R(fx, ground, 2, 12, C.fence);
  R(x - 14, ground, 110, 2, C.fenceDark); R(x - 14, ground + 6, 110, 1, C.fenceDark);

  // Обитатели двора.
  if (present) {
    // Пара хозяев.
    figure(x + 12, ground - 14, C.hairBlonde, C.teal, C.jeans, "long"); // она: бирюзовая куртка
    figure(x + 22, ground - 14, C.beanie, C.black, C.jeans, "beanie");  // он: серая бини, чёрная футболка
    // Бернский зенненхунд.
    bernese(x + 34, ground - 12);
    // Чёрно-белый кот у дорожки.
    cat(x + 6, ground - 6, C.catTux, false);
    // Рыжий табби дремлет у забора.
    cat(x + 52, ground + 2, C.catGinger, true);
  } else {
    R(x + 26, ground - 16, 10, 16, C.wood); // закрытая дверь
    zzz(x + 40, 96);
  }

  applySmog(char, x - 14, 74, 118, 70);
  label(char.displayName, x + 30, ground + 14);
}

function tree(x, topY, fruit) {
  R(x + 4, topY + 14, 3, 12, C.trunk);       // ствол
  R(x, topY, 12, 16, C.leafDark);            // крона (тень)
  R(x + 1, topY - 2, 10, 14, C.leaf);        // крона
  // Плоды.
  R(x + 2, topY + 3, 1, 1, fruit); R(x + 8, topY + 1, 1, 1, fruit);
  R(x + 5, topY + 8, 1, 1, fruit); R(x + 9, topY + 6, 1, 1, fruit);
}

// Полупрозрачный смог поверх двора по его PM2.5.
function applySmog(char, x, y, w, h) {
  const op = { clean: 0, haze: 0.12, smog: 0.28, heavy: 0.45, unknown: 0 }[char.smog] ?? 0;
  if (op > 0) { CTX.fillStyle = `rgba(185,182,168,${op})`; CTX.fillRect(x, y, w, h); }
}

// Подпись двора табличкой в духе нулевых.
function label(text, cx, y) {
  CTX.font = "6px monospace"; CTX.textAlign = "center";
  const w = CTX.measureText(text).width + 6;
  R(cx - w / 2, y, w, 9, C.label);
  CTX.fillStyle = C.labelText; CTX.fillText(text, cx, y + 6);
  CTX.textAlign = "left";
}

// ================= Кадр =================
export function drawFrame(world, t) {
  if (!CTX || !world) return;
  hitboxes = [];
  const key = world.palette?.key ?? "warm-day";

  drawSky(key);
  if (key === "night" || key === "frost") drawStars(t);
  drawCelestial(key);
  drawClouds(t, key);
  drawGround();

  // Раскладка: Fiodar (каменица) слева, Dwoch (усадьба) справа. По роли, с фолбэком по индексу.
  const chars = world.characters ?? [];
  const fiodar = chars.find((c) => c.role === "night-owl") ?? chars[0];
  const dwoch = chars.find((c) => c.role === "homestead") ?? chars[1];
  if (fiodar) drawTenement(fiodar, t);
  if (dwoch) drawCottage(dwoch, t);

  // Общая дымка мира (влажность).
  if (world.fog > 0) { CTX.fillStyle = `rgba(230,230,235,${world.fog})`; CTX.fillRect(0, 100, ART_W, 80); }
}
