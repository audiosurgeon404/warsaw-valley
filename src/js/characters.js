// characters.js — загрузка конфига мира (единственный источник правды, D-2).
export async function loadWorldConfig() {
  const res = await fetch("./data/characters.json");
  if (!res.ok) throw new Error("Не удалось загрузить characters.json");
  return res.json();
}
