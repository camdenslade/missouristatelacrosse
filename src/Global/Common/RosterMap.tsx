import { geoAlbersUsa, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import statesTopo from "us-atlas/states-albers-10m.json";

import hometownCoords from "./data/hometownCoords.json";
import usCities from "./data/usCities.json";
import { apiRequest } from "../../Services/API";

type Player = { id: string; name: string; number?: string | number | null; position?: string | null; season?: string | null; data?: unknown };
type Town = { key: string; city: string; state: string; x: number; y: number; players: Player[] };
type Cluster = { key: string; x: number; y: number; towns: Town[]; count: number };
type StatesTopo = Topology<{ states: GeometryCollection<{ name: string }>; nation: GeometryCollection }>;
type Roads = { major: string; minor: string };
type CountiesTopo = Topology<{ counties: GeometryCollection }>;

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const WIDTH = 975;
const HEIGHT = 610;
const MAX_ZOOM = 16;
// Matches the projection us-atlas used to pre-project the albers files.
const projection = geoAlbersUsa().scale(1300).translate([WIDTH / 2, HEIGHT / 2]);
const COORDS = hometownCoords as unknown as Record<string, [number, number]>;
// [name, x, y, zoom level where the name starts showing], biggest cities first.
const CITIES = usCities as unknown as [string, number, number, number][];
const CAMPUS_KEY = "Springfield, MO";
const CAMPUS: [number, number] | null = (() => {
  const p = projection([-93.292, 37.208]);
  if (!p) return null;
  const city = CITIES.find(([name, x, y]) => name === "Springfield" && Math.hypot(x - p[0], y - p[1]) < 20);
  return city ? [city[1], city[2]] : p;
})();
// Dots closer together than this many screen pixels merge into one numbered dot.
const CLUSTER_PX = 24;
const GRID = 10;

// Whether a line segment passes through a rectangle (all in map units).
const segmentHitsBox = ([x0, y0, x1, y1]: [number, number, number, number], [bx0, by0, bx1, by1]: [number, number, number, number]) => {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [pp, q] of [[-dx, x0 - bx0], [dx, bx1 - x0], [-dy, y0 - by0], [dy, by1 - y0]] as [number, number][]) {
    if (pp === 0) {
      if (q < 0) return false;
    } else {
      const t = q / pp;
      if (pp < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return true;
};

// Seasons run August to July, written "26-27".
const currentSeason = () => {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const yy = start % 100;
  return `${String(yy).padStart(2, "0")}-${String((yy + 1) % 100).padStart(2, "0")}`;
};

const readData = (raw: unknown): Record<string, unknown> => {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }
  return (raw as Record<string, unknown>) || {};
};

export default function RosterMap() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [counties, setCounties] = useState<string | null>(null);
  const [roads, setRoads] = useState<Roads | null>(null);
  // Screen pixels per map unit at zoom 1, so dots keep a steady on-screen size.
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    apiRequest<Player[]>("/api/players")
      .then((all) => setPlayers((all || []).filter((p) => p.season === currentSeason())))
      .catch(() => setPlayers([]));
  }, []);

  const { statePaths, stateBorders, nation, centroids } = useMemo(() => {
    const topo = statesTopo as unknown as StatesTopo;
    const states = feature(topo, topo.objects.states).features;
    const path = geoPath();
    const byName: Record<string, [number, number]> = {};
    for (const s of states) byName[s.properties.name] = path.centroid(s) as [number, number];
    return {
      statePaths: states.map((s) => ({ name: s.properties.name, d: path(s) || "", bounds: path.bounds(s) })),
      stateBorders: path(mesh(topo, topo.objects.states, (a, b) => a !== b)) || "",
      nation: path(feature(topo, topo.objects.nation)) || "",
      centroids: byName,
    };
  }, []);

  const borderGrid = useMemo(() => {
    const grid = new Map<string, [number, number, number, number][]>();
    for (const run of stateBorders.split("M").filter(Boolean)) {
      const pts = run.split("L").map((pt) => pt.split(",").map(Number));
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        for (let gx = Math.floor(Math.min(x0, x1) / GRID); gx <= Math.floor(Math.max(x0, x1) / GRID); gx++) {
          for (let gy = Math.floor(Math.min(y0, y1) / GRID); gy <= Math.floor(Math.max(y0, y1) / GRID); gy++) {
            const key = `${gx},${gy}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key)!.push([x0, y0, x1, y1]);
          }
        }
      }
    }
    return grid;
  }, [stateBorders]);

  const towns = useMemo(() => {
    const map = new Map<string, Town>();
    for (const p of players) {
      const d = readData(p.data);
      const city = String(d.hometown || "").trim();
      const state = String(d.state || "").trim().toUpperCase();
      if (!STATE_NAMES[state]) continue;
      const key = `${city}, ${state}`;
      let town = map.get(key);
      if (!town) {
        // Towns missing from the lookup sit at their state's center.
        const lonLat = COORDS[key];
        let xy = (lonLat && projection(lonLat)) || centroids[STATE_NAMES[state]];
        if (!xy) continue;
        // Two data sources place a city slightly differently; when the hometown is also a labeled
        // city, sit on that city's point so the dot and the name line up.
        const sameCity = CITIES.find(([name, x, y]) => name === city && Math.hypot(x - xy![0], y - xy![1]) < 20);
        if (sameCity) xy = [sameCity[1], sameCity[2]];
        if (key === CAMPUS_KEY && CAMPUS) xy = CAMPUS;
        town = { key, city, state, x: xy[0], y: xy[1], players: [] };
        map.set(key, town);
      }
      town.players.push(p);
    }
    return [...map.values()].sort((a, b) => b.players.length - a.players.length);
  }, [players, centroids]);

  const homeStates = useMemo(() => new Set(towns.map((x) => STATE_NAMES[x.state])), [towns]);
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const x of towns) counts[x.state] = (counts[x.state] || 0) + x.players.length;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [towns]);

  const campusTown = useMemo(() => towns.find((x) => x.key === CAMPUS_KEY) || null, [towns]);

  const clusters = useMemo(() => {
    const limit = CLUSTER_PX / (pxPerUnit * t.k);
    const groups: Cluster[] = [];
    for (const town of towns) {
      if (town.key === CAMPUS_KEY) continue;
      const near = groups.find((g) => Math.hypot(g.x - town.x, g.y - town.y) < limit);
      if (near) {
        near.towns.push(town);
        near.count += town.players.length;
        near.x = near.towns.reduce((n, x) => n + x.x * x.players.length, 0) / near.count;
        near.y = near.towns.reduce((n, x) => n + x.y * x.players.length, 0) / near.count;
      } else {
        groups.push({ key: town.key, x: town.x, y: town.y, towns: [town], count: town.players.length });
      }
    }
    return groups;
  }, [towns, t.k, pxPerUnit]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => setPxPerUnit(Math.max(entry.contentRect.width, 1) / WIDTH));
    ro.observe(box);
    return () => ro.disconnect();
  }, [towns.length]);

  // Pan and zoom. The page keeps scrolling normally: the wheel only zooms after a click
  // on the map, and on phones moving the map takes two fingers.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let wheelArmed = false;
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .extent([[0, 0], [WIDTH, HEIGHT]])
      .filter((event: Event) => {
        if (event.type === "wheel") return wheelArmed;
        if (event.type === "touchstart") return (event as TouchEvent).touches.length > 1;
        return !(event as MouseEvent).button;
      })
      .on("zoom", (e) => setT(e.transform));
    const sel = select(svg).call(behavior).on("dblclick.zoom", null);
    svg.style.touchAction = "pan-x pan-y";
    const arm = () => (wheelArmed = true);
    const disarm = () => (wheelArmed = false);
    svg.addEventListener("click", arm);
    svg.addEventListener("mouseleave", disarm);
    zoomRef.current = behavior;
    return () => {
      sel.on(".zoom", null);
      svg.removeEventListener("click", arm);
      svg.removeEventListener("mouseleave", disarm);
    };
  }, [towns.length]);

  // Counties and roads are bigger downloads, so they load the first time someone zooms in.
  useEffect(() => {
    if (t.k < 1.5 || counties) return;
    import("us-atlas/counties-albers-10m.json").then((m) => {
      const topo = (m.default ?? m) as unknown as CountiesTopo;
      setCounties(geoPath()(mesh(topo, topo.objects.counties, (a, b) => a !== b)) || "");
    });
    import("./data/usRoads.json").then((m) => setRoads((m.default ?? m) as unknown as Roads));
  }, [t.k, counties]);

  if (towns.length === 0) return null;

  const total = towns.reduce((n, x) => n + x.players.length, 0);
  const campusCluster: Cluster | null = campusTown
    ? { key: CAMPUS_KEY, x: campusTown.x, y: campusTown.y, towns: [campusTown], count: campusTown.players.length }
    : null;
  const activeCluster = (active === CAMPUS_KEY ? campusCluster : clusters.find((c) => c.key === active)) || null;
  // Size of one screen pixel in map units at the current zoom.
  const px = 1 / (pxPerUnit * t.k);

  // Fit a state in view with some breathing room.
  const zoomToState = (name: string) => {
    const s = statePaths.find((x) => x.name === name);
    if (!s) return;
    const [[x0, y0], [x1, y1]] = s.bounds;
    const k = Math.min(MAX_ZOOM, 0.8 / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT));
    zoomTo(k, (x0 + x1) / 2, (y0 + y1) / 2);
    boxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const zoomTo = (k: number, x: number, y: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    setActive(null);
    const next = zoomIdentity.translate(WIDTH / 2, HEIGHT / 2).scale(k).translate(-x, -y);
    select(svg).transition().duration(700).call(z.transform, next);
  };

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (svg && z) select(svg).transition().duration(300).call(z.scaleBy, factor);
  };

  const zoomInto = (c: Cluster) => {
    const xs = c.towns.map((x) => x.x);
    const ys = c.towns.map((x) => x.y);
    const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
    // Enough to pull the towns about 140 screen pixels apart.
    const k = Math.min(MAX_ZOOM, Math.max(t.k * 2, Math.min(8, 140 / (pxPerUnit * spread))));
    zoomTo(k, (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  };

  const [tipX, tipY] = activeCluster ? t.apply([activeCluster.x, activeCluster.y]) : [0, 0];
  const tipBelow = tipY / HEIGHT < 0.35;
  const showLabels = t.k >= 3;
  // Only label cities that are big enough for this zoom and inside the visible area.
  const [[vx0, vy0], [vx1, vy1]] = [t.invert([0, 0]), t.invert([WIDTH, HEIGHT])];
  // Bigger cities claim space first; a label that would overlap a player's town or another
  // label is skipped. Boxes are in screen pixels.
  const narrow = pxPerUnit < 0.6;
  const cityFont = narrow ? 9.5 : 11;
  const placed: [number, number, number, number][] = [];
  // Every player dot (and the bear) blocks city names. Boxes are screen pixels.
  const dots: [number, number, number, number][] = [];
  const hit = (b: [number, number, number, number]) => placed.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const dotRadius = (c: Cluster) => (c.towns.length > 1 ? 8.5 + 1.75 * Math.sqrt(c.count) : 4 + 2 * Math.sqrt(c.count));
  const anchors = clusters.map((c) => {
    const [sx, sy] = t.apply([c.x, c.y]).map((v) => v * pxPerUnit);
    const r = dotRadius(c);
    dots.push([sx - r - 2, sy - r - 2, sx + r + 2, sy + r + 2]);
    if (showLabels && c.towns.length === 1) placed.push([sx + r + 3, sy - 8, sx + r + 12 + c.towns[0].city.length * 7, sy + 8]);
    return { sx, sy, r };
  });
  const bearW = t.k >= 3 ? 30 : narrow ? 18 : 24;
  const bearH = bearW * 0.875;
  if (CAMPUS) {
    const [bx, by] = t.apply(CAMPUS).map((v) => v * pxPerUnit);
    dots.push([bx - bearW / 2 - 2, by - bearH / 2 - 2 - (showLabels ? 16 : 0), bx + bearW / 2 + 2, by + bearH / 2 + 2]);
  }
  type Spot = { dx: number; dy: number; anchor: "middle" | "start" | "end"; baseline: "hanging" | "central" | "auto" };
  type Placed = { name: string; ax: number; ay: number; spot: Spot; point: boolean };
  const visibleCities: Placed[] = [];
  const hosted = new Set<(typeof anchors)[number]>();
  // Cities with a player dot on them get first claim, then the rest by size.
  const nearPlayer = (x: number, y: number) => clusters.some((c) => Math.hypot(c.x - x, c.y - y) < 30 / (pxPerUnit * t.k));
  const byPriority = [...CITIES].sort((a, b) => Number(nearPlayer(b[1], b[2])) - Number(nearPlayer(a[1], a[2])));
  const taken = new Set(towns.map((x) => `${x.x},${x.y}`));
  for (const [name, x, y, minZoom] of byPriority) {
    if (minZoom > t.k || x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
    // Springfield is the bear, and zoomed in, players' towns carry their own names.
    if (CAMPUS && x === CAMPUS[0] && y === CAMPUS[1]) continue;
    if (showLabels && taken.has(`${x},${y}`)) continue;
    const [cx, cy] = t.apply([x, y]).map((v) => v * pxPerUnit);
    // Don't repeat a name a nearby player's town already shows (Kansas City, KS next to KC, MO).
    if (showLabels && towns.some((tw) => tw.city === name && Math.hypot(tw.x - x, tw.y - y) * pxPerUnit * t.k < 60)) continue;
    // A city under a player dot hangs its name off that dot instead of its own point.
    const host = anchors.find((a) => Math.hypot(a.sx - cx, a.sy - cy) < a.r + 10);
    // One name per player dot (Kansas City, KS and Kansas City, MO share one).
    if (host && hosted.has(host)) continue;
    const [ax, ay] = host ? [host.sx, host.sy] : [cx, cy];
    const o = host ? host.r + 3 : 4;
    const half = name.length * cityFont * 0.28 + 2;
    const spots: [Spot, [number, number, number, number]][] = [
      [{ dx: 0, dy: o + 1, anchor: "middle", baseline: "hanging" }, [ax - half, ay + o, ax + half, ay + o + 14]],
      [{ dx: -(o + 2), dy: 0, anchor: "end", baseline: "central" }, [ax - o - 2 - 2 * half, ay - 7, ax - o, ay + 7]],
      [{ dx: o + 2, dy: 0, anchor: "start", baseline: "central" }, [ax + o, ay - 7, ax + o + 2 + 2 * half, ay + 7]],
      [{ dx: 0, dy: -(o + 1), anchor: "middle", baseline: "auto" }, [ax - half, ay - o - 15, ax + half, ay - o]],
    ];
    const blockedByDot = (box: [number, number, number, number]) =>
      dots.some((d) => box[0] < d[2] && box[2] > d[0] && box[1] < d[3] && box[3] > d[1]);
    const crossesBorder = (box: [number, number, number, number]) => {
      const [mx0, my0] = t.invert([box[0] / pxPerUnit, box[1] / pxPerUnit]);
      const [mx1, my1] = t.invert([box[2] / pxPerUnit, box[3] / pxPerUnit]);
      for (let gx = Math.floor(mx0 / GRID); gx <= Math.floor(mx1 / GRID); gx++) {
        for (let gy = Math.floor(my0 / GRID); gy <= Math.floor(my1 / GRID); gy++) {
          if (borderGrid.get(`${gx},${gy}`)?.some((seg) => segmentHitsBox(seg, [mx0, my0, mx1, my1]))) return true;
        }
      }
      return false;
    };
    const open = spots.filter(([, box]) => !blockedByDot(box) && !hit(box));
    // Prefer a spot that keeps the name off state lines, so it never hides a border.
    const choice = open.find(([, box]) => !crossesBorder(box)) || open[0];
    if (!choice) continue;
    placed.push(choice[1]);
    if (host) hosted.add(host);
    visibleCities.push({ name, ax: ax / pxPerUnit, ay: ay / pxPerUnit, spot: choice[0], point: !host });
    if (visibleCities.length >= (narrow ? 12 : 80)) break;
  }
  const fadeIn = (from: number) => Math.max(0, Math.min(1, (t.k - from) / 1.5));

  return (
    <section className="bg-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-baseline justify-between mb-4 gap-6">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase text-gray-900">Where We&apos;re From</h2>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <p className="text-gray-600 text-base md:text-lg mb-8 md:mb-10">
          {total} players from {stateCounts.length} {stateCounts.length === 1 ? "state" : "states"}, all playing in Springfield.
          <span className="block text-sm text-gray-400 mt-1">
            <span className="hidden md:inline">Drag to move the map. Click it, then scroll to zoom.</span>
            <span className="md:hidden">Pinch with two fingers to zoom and move the map.</span>
          </span>
        </p>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-start">
        <div
          ref={boxRef}
          className="relative flex-1 min-w-0 rounded-2xl overflow-hidden border border-gray-200 bg-slate-50 select-none"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto block cursor-grab active:cursor-grabbing"
            role="img"
            aria-label="Map of player hometowns"
            onClick={() => setActive(null)}
          >
            <g transform={t.toString()}>
              <path d={nation} className="fill-white" />
              {statePaths.map((s) => (
                <path
                  key={s.name}
                  d={s.d}
                  className={hoveredState === s.name ? "fill-[#5E0009]/35" : homeStates.has(s.name) ? "fill-[#5E0009]/15" : "fill-gray-100"}
                  style={{ transition: "fill 150ms" }}
                />
              ))}
              {counties && (
                <path
                  d={counties}
                  fill="none"
                  className="stroke-gray-300"
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ opacity: Math.min(1, (t.k - 2) / 2), transition: "opacity 200ms" }}
                  pointerEvents="none"
                />
              )}
              {roads && (
                <g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
                  <path d={roads.minor} stroke="#d4d4d8" strokeWidth={1} vectorEffect="non-scaling-stroke" style={{ opacity: fadeIn(3.5) }} />
                  <path d={roads.major} stroke="#e8b86d" strokeWidth={1.75} vectorEffect="non-scaling-stroke" style={{ opacity: fadeIn(1.75) }} />
                </g>
              )}
              {t.k >= 2.5 &&
                statePaths.map((s) =>
                  centroids[s.name] ? (
                    <text
                      key={`label-${s.name}`}
                      x={centroids[s.name][0]}
                      y={centroids[s.name][1]}
                      textAnchor="middle"
                      fontSize={11 * px}
                      fontWeight={700}
                      letterSpacing={2 * px}
                      className="fill-gray-400 uppercase"
                      pointerEvents="none"
                    >
                      {s.name}
                    </text>
                  ) : null
                )}
              {visibleCities.map(({ name, ax, ay, spot, point }, i) => {
                const [x, y] = t.invert([ax, ay]);
                return (
                  <g key={`${name}-${i}`} transform={`translate(${x},${y})`} pointerEvents="none">
                    {point && <circle r={2.5 * px} className="fill-gray-500" />}
                    <text
                      x={spot.dx * px}
                      y={spot.dy * px}
                      textAnchor={spot.anchor}
                      dominantBaseline={spot.baseline}
                      fontSize={cityFont * px}
                      fontWeight={point ? 500 : 600}
                      className={point ? "fill-gray-500" : "fill-gray-700"}
                      stroke="white"
                      strokeWidth={2.5 * px}
                      strokeOpacity={0.65}
                      paintOrder="stroke"
                    >
                      {name}
                    </text>
                  </g>
                );
              })}
              <path d={stateBorders} fill="none" className="stroke-gray-400" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              <path d={nation} fill="none" className="stroke-gray-400" strokeWidth={1.25} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              {clusters.map((c) => {
                const multi = c.towns.length > 1;
                const r = (multi ? 8.5 + 1.75 * Math.sqrt(c.count) : 4 + 2 * Math.sqrt(c.count)) * px;
                const isActive = c.key === active || c.key === hovered;
                return (
                  <g
                    key={c.key}
                    transform={`translate(${c.x},${c.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(c.key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Grouped towns zoom apart; once fully zoomed in, they list their players instead.
                      if (multi && t.k < MAX_ZOOM - 0.01) zoomInto(c);
                      else setActive(active === c.key ? null : c.key);
                    }}
                  >
                    <circle r={r + 8 * px} fill="transparent" />
                    <circle
                      r={isActive ? r + 2 * px : r}
                      className={isActive ? "fill-[#7a0012]" : "fill-[#5E0009]"}
                      stroke="white"
                      strokeWidth={2 * px}
                    />
                    {(multi || c.count > 1) && (
                      <text textAnchor="middle" dominantBaseline="central" fontSize={11 * px} fontWeight={800} className="fill-white" pointerEvents="none">
                        {c.count}
                      </text>
                    )}
                    {showLabels && !multi && c.towns[0].city && (
                      <text
                        x={r + 5 * px}
                        dominantBaseline="central"
                        fontSize={12 * px}
                        fontWeight={700}
                        className="fill-gray-800"
                        stroke="white"
                        strokeWidth={3 * px}
                        paintOrder="stroke"
                      >
                        {c.towns[0].city}
                      </text>
                    )}
                  </g>
                );
              })}
              {CAMPUS && (
                // Springfield's players live under the bear, which sits on top of everything else.
                <g
                  transform={`translate(${CAMPUS[0]},${CAMPUS[1]})`}
                  className={campusTown ? "cursor-pointer" : undefined}
                  pointerEvents={campusTown ? undefined : "none"}
                  onMouseEnter={() => campusTown && setHovered(CAMPUS_KEY)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(e) => {
                    if (!campusTown) return;
                    e.stopPropagation();
                    setActive(active === CAMPUS_KEY ? null : CAMPUS_KEY);
                  }}
                >
                  <image
                    href="/assets/bear-head.png"
                    x={(-bearW / 2) * px}
                    y={(-bearH / 2) * px}
                    width={bearW * px}
                    height={bearH * px}
                    style={{
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
                      transform: hovered === CAMPUS_KEY || active === CAMPUS_KEY ? "scale(1.12)" : undefined,
                      transformOrigin: "center",
                      transformBox: "fill-box",
                      transition: "transform 150ms",
                    }}
                  />
                  {campusTown && campusTown.players.length > 1 && (
                    <g transform={`translate(${(bearW / 2 - 2) * px},${(-bearH / 2 + 2) * px})`}>
                      <circle r={7 * px} className="fill-[#5E0009]" stroke="white" strokeWidth={1.5 * px} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={9 * px} fontWeight={800} className="fill-white">
                        {campusTown.players.length}
                      </text>
                    </g>
                  )}
                  {showLabels && (
                    <text
                      y={(-bearH / 2 - 5) * px}
                      textAnchor="middle"
                      fontSize={11 * px}
                      fontWeight={800}
                      letterSpacing={1 * px}
                      className="fill-[#5E0009] uppercase"
                      stroke="white"
                      strokeWidth={3 * px}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      Missouri State
                    </text>
                  )}
                </g>
              )}
            </g>
          </svg>

          <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
            <button onClick={() => zoomBy(2)} aria-label="Zoom in" className="w-9 h-9 flex items-center justify-center bg-white text-[#5E0009] rounded-full shadow-md hover:bg-gray-100 transition">
              <Plus size={16} />
            </button>
            <button onClick={() => zoomBy(0.5)} aria-label="Zoom out" className="w-9 h-9 flex items-center justify-center bg-white text-[#5E0009] rounded-full shadow-md hover:bg-gray-100 transition">
              <Minus size={16} />
            </button>
            {t.k > 1.01 && (
              <button onClick={() => zoomTo(1, WIDTH / 2, HEIGHT / 2)} aria-label="Reset map" className="w-9 h-9 flex items-center justify-center bg-white text-[#5E0009] rounded-full shadow-md hover:bg-gray-100 transition">
                <RotateCcw size={15} />
              </button>
            )}
          </div>

          {activeCluster && (
            <div
              className={`absolute z-10 pointer-events-none -translate-x-1/2 ${tipBelow ? "mt-6" : "-translate-y-full -mt-4"} min-w-44 max-w-64 rounded-xl bg-gray-900 text-white px-4 py-3 shadow-xl`}
              style={{ left: `${(tipX / WIDTH) * 100}%`, top: `${(tipY / HEIGHT) * 100}%` }}
            >
              {activeCluster.towns.length > 1 ? (
                <>
                  {activeCluster.towns.map((x, i) => (
                    <div key={x.key} className={i > 0 ? "mt-2" : ""}>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-0.5">
                        {x.city ? `${x.city}, ${x.state}` : STATE_NAMES[x.state]}
                      </p>
                      <ul className="space-y-0.5">
                        {x.players.map((p) => (
                          <li key={p.id} className="text-sm font-semibold leading-snug">
                            {p.number != null && p.number !== "" && <span className="text-white/60 tabular-nums mr-1.5">#{p.number}</span>}
                            {p.name}
                            {p.position && <span className="text-white/60 font-normal"> · {p.position}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">
                    {activeCluster.towns[0].city ? `${activeCluster.towns[0].city}, ${activeCluster.towns[0].state}` : STATE_NAMES[activeCluster.towns[0].state]}
                  </p>
                  <ul className="space-y-0.5">
                    {activeCluster.towns[0].players.map((p) => (
                      <li key={p.id} className="text-sm font-semibold leading-snug">
                        {p.number != null && p.number !== "" && <span className="text-white/60 tabular-nums mr-1.5">#{p.number}</span>}
                        {p.name}
                        {p.position && <span className="text-white/60 font-normal"> · {p.position}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="lg:w-72 shrink-0">
          <div className="flex items-baseline justify-between border-b border-gray-200 pb-2 mb-1">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">By State</h3>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Players</span>
          </div>
          <ol>
            {stateCounts.map(([st, n], i) => {
              const name = STATE_NAMES[st];
              const isHot = hoveredState === name;
              return (
                <li key={st}>
                  <button
                    onClick={() => zoomToState(name)}
                    onMouseEnter={() => setHoveredState(name)}
                    onMouseLeave={() => setHoveredState(null)}
                    onFocus={() => setHoveredState(name)}
                    onBlur={() => setHoveredState(null)}
                    className={`group w-full text-left py-2.5 border-b border-gray-100 transition ${isHot ? "bg-gray-50" : ""}`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="w-5 text-xs font-semibold tabular-nums text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 font-bold text-gray-900 group-hover:text-[#5E0009] transition">{name}</span>
                      <span className="font-extrabold tabular-nums text-[#5E0009]">{n}</span>
                    </div>
                    <div className="ml-8 mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-[#5E0009] transition-all" style={{ width: `${(n / total) * 100}%`, opacity: isHot ? 1 : 0.7 }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-gray-400">Pick a state to fly the map there.</p>
        </aside>
        </div>
      </div>
    </section>
  );
}
