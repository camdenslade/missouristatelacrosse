// Looks up coordinates for every roster hometown and saves them for the home page map.
// Only new hometowns are looked up; existing entries are kept. Players whose town isn't in the
// file still show on the map at their state's center, so rerunning this is optional upkeep.
// Usage: npm run geocode-hometowns
import { readFileSync, writeFileSync } from "node:fs";

const API = process.env.VITE_API_BASE || "https://api.missouristatelacrosse.com";
const OUT = new URL("../src/Global/Common/data/hometownCoords.json", import.meta.url);

const existing = (() => {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return {};
  }
})();

const towns = new Set();
for (const program of ["men", "women"]) {
  const res = await fetch(`${API}/api/players`, { headers: { "X-Program": program } });
  if (!res.ok) continue;
  for (const p of await res.json()) {
    const d = typeof p.data === "string" ? JSON.parse(p.data || "{}") : p.data || {};
    const city = (d.hometown || "").trim();
    const state = (d.state || "").trim().toUpperCase();
    if (city && state) towns.add(`${city}, ${state}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let added = 0;
for (const key of [...towns].sort()) {
  if (existing[key]) continue;
  const [city, state] = key.split(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
  const res = await fetch(url, { headers: { "User-Agent": "roster-map-geocoder/1.0" } });
  const [hit] = res.ok ? await res.json() : [];
  if (hit) {
    existing[key] = [Number(Number(hit.lon).toFixed(3)), Number(Number(hit.lat).toFixed(3))];
    added++;
  } else {
    console.warn(`Not found, will use state center: ${key}`);
  }
  await sleep(1100); // Nominatim allows one request per second
}

const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`${added} added, ${Object.keys(sorted).length} total`);
