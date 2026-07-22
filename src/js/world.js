// world.js — чистые функции «данные → мир» (директива D-25).
// Без DOM и без сети. Легко крутить пороги и тестировать.

// Ключевые цвета неба в JS — для DOM-акцентов (canvas держит свою палитру в map.js).
export const PAL = {
  skyDay: "#8ec7d2", skySet: "#e6a15b", skyNight: "#2b2d54", skyFrost: "#cfe6ee",
};

// PM2.5 (µg/m³) → уровень смога.
export function smogLevel(pm25) {
  if (pm25 == null) return "unknown";
  if (pm25 <= 5) return "clean";
  if (pm25 <= 15) return "haze";
  if (pm25 <= 35) return "smog";
  return "heavy";
}

const SMOG_RANK = { unknown: 0, clean: 0, haze: 1, smog: 2, heavy: 3 };

// Худший смог среди присутствующих — общая пелена над долиной.
export function worstSmog(levels) {
  let worst = "clean";
  for (const l of levels) if ((SMOG_RANK[l] ?? 0) > SMOG_RANK[worst]) worst = l;
  return worst;
}

// Час в Варшаве + температура + «кто-то жив» → ключ времени суток.
export function daylightKey(hour, temp, anyOnline) {
  if (!anyOnline) return "night"; // мир спит
  if (hour >= 21 || hour < 5) return "night";
  if (temp != null && temp < 0) return "frost";
  if (hour >= 18 || (temp != null && temp > 22)) return "golden";
  if (hour < 9) return "cool-morning";
  return "warm-day";
}

// Ключ → палитра сцены (sky — для DOM-акцентов, ambient — оверлей поверх карты).
export function dayPalette(key) {
  switch (key) {
    case "night":        return { key, sky: PAL.skyNight, ambient: "rgba(43,45,84,0.45)" };
    case "frost":        return { key, sky: PAL.skyFrost, ambient: "rgba(207,230,238,0.30)" };
    case "golden":       return { key, sky: PAL.skySet,   ambient: "rgba(230,161,91,0.28)" };
    case "cool-morning": return { key, sky: PAL.skyDay,   ambient: "rgba(142,199,210,0.18)" };
    default:             return { key: "warm-day", sky: PAL.skyDay, ambient: null };
  }
}

// «Переводчик» метрик на человеческий: значение → { text, level }.
// level: good (всё отлично) | meh (так себе) | bad (плохо) | info (просто факт).
// Пороги PM — по рекомендациям ВОЗ-2021 (суточные): PM2.5 — 15, PM10 — 45 µg/m³.
export function explain(kind, v) {
  if (v == null) return null;
  switch (kind) {
    case "temp":
      if (v < 0)   return { text: "мороз — одевайся тепло", level: "meh" };
      if (v < 10)  return { text: "холодно", level: "meh" };
      if (v < 18)  return { text: "прохладно, свежо", level: "good" };
      if (v <= 25) return { text: "комфортно", level: "good" };
      if (v <= 30) return { text: "жарко", level: "meh" };
      return { text: "зной — прячься в тень и пей воду", level: "bad" };
    case "hum":
      if (v < 30)  return { text: "суховато — пей больше воды", level: "meh" };
      if (v <= 60) return { text: "комфортная", level: "good" };
      if (v <= 80) return { text: "влажновато", level: "meh" };
      return { text: "очень сыро — может лечь туман", level: "meh" };
    case "pm1":
      if (v <= 3)  return { text: "частиц почти нет — отлично", level: "good" };
      if (v <= 10) return { text: "мало — всё спокойно", level: "good" };
      if (v <= 25) return { text: "многовато — воздух дымноват", level: "meh" };
      return { text: "много — воздух дымный", level: "bad" };
    case "pm25":
      if (v <= 5)  return { text: "частиц почти нет — дыши спокойно", level: "good" };
      if (v <= 15) return { text: "мало — в пределах нормы ВОЗ", level: "good" };
      if (v <= 35) return { text: "многовато — чувствительным поберечься", level: "meh" };
      if (v <= 75) return { text: "много — лучше закрыть окна", level: "bad" };
      return { text: "очень много — опасно, пережди дома", level: "bad" };
    case "pm10":
      if (v <= 15) return { text: "пыли почти нет — отлично", level: "good" };
      if (v <= 45) return { text: "немного — в пределах нормы ВОЗ", level: "good" };
      if (v <= 80) return { text: "пыльно — не лучший день для пробежки", level: "meh" };
      return { text: "очень пыльно — гулять не стоит", level: "bad" };
    case "press":
      if (v < 1000)  return { text: "низкое — возможна непогода", level: "meh" };
      if (v <= 1025) return { text: "нормальное", level: "good" };
      return { text: "высокое — обычно к ясной погоде", level: "good" };
    case "count":
      if (v <= 0.3) return { text: "природный фон — норма", level: "good" };
      if (v <= 0.6) return { text: "чуть выше фона", level: "meh" };
      return { text: "повышенная — необычно", level: "bad" };
    case "nox":
      if (v <= 100) return { text: "обычный уровень", level: "good" };
      if (v <= 200) return { text: "повышенный — как у дороги", level: "meh" };
      return { text: "высокий — лучше проветрить позже", level: "bad" };
    case "voc":
      if (v <= 100) return { text: "воздух свежий", level: "good" };
      if (v <= 200) return { text: "повышенный — чем-то пахнет", level: "meh" };
      return { text: "высокий — много испарений", level: "bad" };
    case "aqi":
      if (v <= 50)  return { text: "воздух хороший", level: "good" };
      if (v <= 100) return { text: "приемлемый", level: "meh" };
      return { text: "плохой — поберегись", level: "bad" };
    case "rssi":
      if (v >= -60) return { text: "отличная", level: "good" };
      if (v >= -75) return { text: "хорошая", level: "good" };
      if (v >= -85) return { text: "слабовата", level: "meh" };
      return { text: "еле ловит", level: "meh" };
    default:
      return null;
  }
}

// Влажность (%) → плотность дымки 0..1.
export function fogDensity(hum) {
  if (hum == null) return 0;
  if (hum > 90) return 0.4;
  if (hum > 80) return 0.2;
  return 0;
}

// Осадки/эффекты: мороз → снег, очень влажно → капли на «стекле» окна сайта.
export function weatherFx(temp, hum) {
  if (temp != null && temp < 0) return "snow";
  if (hum != null && hum > 90) return "drops";
  return null;
}

// Настроение персонажа по его воздуху.
export function mood(state) {
  if (!state?.online || !state?.time) return "sleep";
  const s = smogLevel(state.metrics?.pm25);
  const temp = state.metrics?.temp;
  const comfy = temp != null && temp >= 5 && temp <= 26;
  if (s === "clean" && comfy) return "happy";
  if (s === "heavy" || (temp != null && (temp > 30 || temp < -5))) return "sad";
  return "neutral";
}

// Присутствует ли персонаж в мире прямо сейчас.
export function isPresent(state) {
  return !!(state?.online && state?.time);
}

// Собрать общее состояние мира из массива состояний персонажей.
// hour — час в Europe/Warsaw (конвертация из UTC — в main.js, одно место, D-27).
export function deriveWorld(characters, states, hour = 12) {
  const byId = new Map(states.map((s) => [s.id, s]));
  const chars = characters.map((c) => {
    const st = byId.get(c.id) ?? {};
    return {
      ...c,
      present: isPresent(st),
      mood: mood(st),
      smog: smogLevel(st.metrics?.pm25),
      state: st,
    };
  });
  // Погода мира — усредняем по присутствующим (простое приближение).
  const present = chars.filter((c) => c.present);
  const avgTemp = present.length
    ? present.reduce((a, c) => a + (c.state.metrics?.temp ?? 0), 0) / present.length
    : null;
  const avgHum = present.length
    ? present.reduce((a, c) => a + (c.state.metrics?.hum ?? 0), 0) / present.length
    : null;
  const key = daylightKey(hour, avgTemp, present.length > 0);
  return {
    daylight: key,
    palette: dayPalette(key),
    fog: fogDensity(avgHum),
    fx: weatherFx(avgTemp, avgHum),
    smog: worstSmog(present.map((c) => c.smog)),
    characters: chars,
  };
}
