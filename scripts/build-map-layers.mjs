// Builds the roads and cities drawn on the home page hometown map from Natural Earth
// (public domain, naturalearthdata.com). Rerun only if the map's look needs to change.
// Usage: node scripts/build-map-layers.mjs <ne_10m_roads.geojson> <ne_10m_populated_places_simple.geojson>
// Both files are in https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
import { geoAlbersUsa } from "d3-geo";
import { readFileSync, writeFileSync } from "node:fs";

const [roadsFile, placesFile] = process.argv.slice(2);
if (!roadsFile || !placesFile) {
  console.error("Usage: node scripts/build-map-layers.mjs <roads.geojson> <places.geojson>");
  process.exit(1);
}
const ROADS_OUT = new URL("../src/Global/Common/data/usRoads.json", import.meta.url);
const CITIES_OUT = new URL("../src/Global/Common/data/usCities.json", import.meta.url);

// Same projection as us-atlas's albers files, so everything lines up with the state shapes.
const projection = geoAlbersUsa().scale(1300).translate([975 / 2, 610 / 2]);
const TOLERANCE = 0.12; // map units; about 2px at the deepest zoom

const sqSegDist = ([px, py], [ax, ay], [bx, by]) => {
  let dx = bx - ax;
  let dy = by - ay;
  if (dx || dy) {
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    ax += t * dx;
    ay += t * dy;
  }
  dx = px - ax;
  dy = py - ay;
  return dx * dx + dy * dy;
};

const simplify = (pts) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = sqSegDist(pts[i], pts[a], pts[b]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > TOLERANCE * TOLERANCE) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

const r1 = (n) => Math.round(n * 10) / 10;

const linesToPath = (lines) => {
  let d = "";
  for (const line of lines) {
    // Split wherever the projection drops a point (outside the US insets).
    let run = [];
    const flush = () => {
      const s = simplify(run);
      if (s.length > 1) d += "M" + s.map(([x, y]) => `${r1(x)},${r1(y)}`).join("L");
      run = [];
    };
    for (const lonLat of line) {
      const xy = projection(lonLat);
      if (xy) run.push(xy);
      else flush();
    }
    flush();
  }
  return d;
};

const roads = JSON.parse(readFileSync(roadsFile, "utf8")).features.filter(
  (f) => f.properties.sov_a3 === "USA" && f.properties.type !== "Ferry Route"
);
const linesOf = (f) => (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates);
const major = roads.filter((f) => f.properties.expressway === 1).flatMap(linesOf);
const minor = roads.filter((f) => f.properties.expressway !== 1).flatMap(linesOf);

// minZoom: how far in someone has to zoom before the city's name shows. The full-US view
// names each state's biggest city, a second one where it's also a big metro (St. Louis and
// Kansas City), and every metro over 2.5 million.
const places = JSON.parse(readFileSync(placesFile, "utf8"))
  .features.filter((f) => f.properties.adm0_a3 === "USA")
  .map((f) => ({ f, xy: projection(f.geometry.coordinates), pop: f.properties.pop_max || 0 }))
  .filter((c) => c.xy)
  .sort((a, b) => b.pop - a.pop);
const rankInState = {};
const cities = places.map(({ f, xy, pop }) => {
  const state = f.properties.adm1name || "";
  const rank = (rankInState[state] = (rankInState[state] || 0) + 1);
  const minZoom =
    pop >= 2_500_000 || rank === 1 || (rank === 2 && pop >= 1_000_000)
      ? 1
      : pop >= 1_000_000
        ? 1.75
        : pop >= 250_000
          ? 3.5
          : pop >= 75_000
            ? 6
            : 9;
  return [f.properties.name.replace(/\s+/g, " "), r1(xy[0]), r1(xy[1]), minZoom];
});

writeFileSync(ROADS_OUT, JSON.stringify({ major: linesToPath(major), minor: linesToPath(minor) }));
writeFileSync(CITIES_OUT, JSON.stringify(cities));
console.log(`roads ${major.length}/${minor.length} lines, ${cities.length} cities`);
