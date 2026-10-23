import fs from "node:fs";
import path from "node:path";
import { classifyAirspace } from "../src/lib/classify";
import { amslFtToEllipsoidM, geoidOffsetM } from "../src/lib/geoid";
import { cellIdFor } from "../src/lib/worldCells";
import { ALT_DATUM, ALT_UNIT, ICAO_CLASS } from "../src/lib/openaip-enums";
import { feetToMetres, flightLevelToMetres, formatFeet, formatFl } from "../src/lib/units";
import type {
  AirspaceFeature,
  AirportFeature,
  NavaidFeature,
  PlaceFeature,
  SearchEntry,
  UkDataMeta,
} from "../src/lib/types";
import type { CellIndexEntry } from "../src/lib/worldCells";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "data", "world");
const CELLS_DIR = path.join(OUT, "cells");
const EXPORT_BASE = "https://storage.openaip.net/openaip-system-exports";

const PACK_COUNTRIES = [
  "gb",
  "ie",
  "fr",
  "de",
  "nl",
  "be",
  "lu",
  "es",
  "pt",
  "it",
  "ch",
  "at",
  "dk",
  "no",
  "se",
  "fi",
  "is",
  "pl",
  "cz",
  "gr",
  "us",
  "ca",
];

const MAX_RING_VERTS = 64;
const MAX_BBOX_DEG = 12;

/** Capitals and training hubs (GeoNames-style, CC BY). */
const WORLD_PLACES: PlaceFeature[] = [
  { id: "london", name: "London", lon: -0.1276, lat: 51.5074, population: 9000000, admin: "UK" },
  { id: "paris", name: "Paris", lon: 2.3522, lat: 48.8566, population: 2100000, admin: "France" },
  { id: "frankfurt", name: "Frankfurt", lon: 8.6821, lat: 50.1109, population: 750000, admin: "Germany" },
  { id: "amsterdam", name: "Amsterdam", lon: 4.9041, lat: 52.3676, population: 870000, admin: "Netherlands" },
  { id: "madrid", name: "Madrid", lon: -3.7038, lat: 40.4168, population: 3200000, admin: "Spain" },
  { id: "rome", name: "Rome", lon: 12.4964, lat: 41.9028, population: 2800000, admin: "Italy" },
  { id: "zurich", name: "Zürich", lon: 8.5417, lat: 47.3769, population: 430000, admin: "Switzerland" },
  { id: "vienna", name: "Vienna", lon: 16.3738, lat: 48.2082, population: 1900000, admin: "Austria" },
  { id: "copenhagen", name: "Copenhagen", lon: 12.5683, lat: 55.6761, population: 640000, admin: "Denmark" },
  { id: "oslo", name: "Oslo", lon: 10.7522, lat: 59.9139, population: 700000, admin: "Norway" },
  { id: "stockholm", name: "Stockholm", lon: 18.0686, lat: 59.3293, population: 980000, admin: "Sweden" },
  { id: "helsinki", name: "Helsinki", lon: 24.9384, lat: 60.1699, population: 660000, admin: "Finland" },
  { id: "warsaw", name: "Warsaw", lon: 21.0122, lat: 52.2297, population: 1800000, admin: "Poland" },
  { id: "prague", name: "Prague", lon: 14.4378, lat: 50.0755, population: 1300000, admin: "Czechia" },
  { id: "athens", name: "Athens", lon: 23.7275, lat: 37.9838, population: 660000, admin: "Greece" },
  { id: "dublin", name: "Dublin", lon: -6.2603, lat: 53.3498, population: 550000, admin: "Ireland" },
  { id: "new-york", name: "New York", lon: -74.006, lat: 40.7128, population: 8300000, admin: "USA" },
  { id: "los-angeles", name: "Los Angeles", lon: -118.2437, lat: 34.0522, population: 3900000, admin: "USA" },
  { id: "chicago", name: "Chicago", lon: -87.6298, lat: 41.8781, population: 2700000, admin: "USA" },
  { id: "toronto", name: "Toronto", lon: -79.3832, lat: 43.6532, population: 2700000, admin: "Canada" },
  { id: "vancouver", name: "Vancouver", lon: -123.1207, lat: 49.2827, population: 660000, admin: "Canada" },
  { id: "manchester", name: "Manchester", lon: -2.2426, lat: 53.4808, population: 550000, admin: "UK" },
  { id: "edinburgh", name: "Edinburgh", lon: -3.1883, lat: 55.9533, population: 540000, admin: "UK" },
];

async function downloadNdGeoJson(url: string): Promise<GeoJSON.Feature[]> {
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[build-data] skip ${url}: ${res.status}`);
    return [];
  }
  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((l) => JSON.parse(l) as GeoJSON.Feature);
}

function ringCentroid(ring: [number, number][]): { lat: number; lon: number } {
  let lon = 0;
  let lat = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    lon += ring[i][0];
    lat += ring[i][1];
  }
  return { lon: lon / n, lat: lat / n };
}

function ringBBox(ring: [number, number][]): { west: number; south: number; east: number; north: number } {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

function simplifyRing(ring: [number, number][], maxVerts: number): [number, number][] {
  const closed =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring.slice();
  if (open.length <= maxVerts) return closed ? ring : [...open, open[0]];
  const step = Math.ceil(open.length / maxVerts);
  const out: [number, number][] = [];
  for (let i = 0; i < open.length; i += step) out.push(open[i]);
  if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) {
    out.push(out[0]);
  }
  return out;
}

function toLimit(
  raw: { value: number; unit: number; referenceDatum: number },
  lat: number,
  lon: number,
): {
  value: number;
  unit: "FT" | "FL" | "M";
  datum: "GND" | "MSL" | "STD" | "AGL";
  ellipsoidM: number;
  display: string;
  usesTerrain: boolean;
} {
  const unit = ALT_UNIT[raw.unit] ?? "FT";
  const datum = ALT_DATUM[raw.referenceDatum] ?? "MSL";
  let ellipsoidM = 0;
  let display = "";
  let usesTerrain = false;

  if (datum === "STD" && unit === "FL") {
    ellipsoidM = flightLevelToMetres(raw.value);
    display = formatFl(raw.value);
  } else if (unit === "FT") {
    if (datum === "GND" || raw.referenceDatum === 0) {
      ellipsoidM = feetToMetres(raw.value);
      usesTerrain = true;
      display = raw.value === 0 ? "SFC" : `${raw.value} ft AGL`;
    } else {
      ellipsoidM = amslFtToEllipsoidM(raw.value, lat, lon);
      display = formatFeet(raw.value) + " AMSL";
    }
  } else if (unit === "M") {
    ellipsoidM = raw.value + (datum === "MSL" ? geoidOffsetM(lat, lon) : 0);
    display = `${raw.value} m`;
  } else {
    ellipsoidM = feetToMetres(raw.value);
    display = String(raw.value);
  }

  return {
    value: raw.value,
    unit,
    datum: datum === "GND" ? "AGL" : datum,
    ellipsoidM,
    display,
    usesTerrain,
  };
}

function parseAirspaceFeature(f: GeoJSON.Feature, source: "openaip" | "override"): AirspaceFeature | null {
  const props = f.properties as Record<string, unknown>;
  if (!props || f.geometry?.type !== "Polygon") return null;
  const coords = (f.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
  if (coords.length < 4) return null;
  let ring = coords.map(([lon, lat]) => [lon, lat] as [number, number]);
  const box = ringBBox(ring);
  if (box.east - box.west > MAX_BBOX_DEG || box.north - box.south > MAX_BBOX_DEG) return null;
  ring = simplifyRing(ring, MAX_RING_VERTS);
  const { lat, lon } = ringCentroid(ring);

  const typeCode = Number(props.type ?? 0);
  const name = String(props.name ?? "Unknown");
  const icaoClass =
    source === "override"
      ? String(props.icaoClass ?? "G")
      : ICAO_CLASS[Number(props.icaoClass)] ?? "G";

  const category =
    source === "override"
      ? (props.category as AirspaceFeature["category"])
      : classifyAirspace(typeCode, name, icaoClass);

  const lowerRaw = props.lower ?? props.lowerLimit;
  const upperRaw = props.upper ?? props.upperLimit;
  if (!lowerRaw || !upperRaw) return null;

  const lower = toLimit(lowerRaw as { value: number; unit: number; referenceDatum: number }, lat, lon);
  const upper = toLimit(upperRaw as { value: number; unit: number; referenceDatum: number }, lat, lon);

  const freqs = (props.frequencies as { value: string; name?: string }[] | undefined) ?? [];

  return {
    id: String(props._id ?? props.id ?? name),
    name,
    category,
    icaoClass,
    lower: {
      value: lower.value,
      unit: lower.unit,
      datum: lower.datum,
      ellipsoidM: lower.ellipsoidM,
      display: lower.display,
    },
    upper: {
      value: upper.value,
      unit: upper.unit,
      datum: upper.datum,
      ellipsoidM: upper.ellipsoidM,
      display: upper.display,
    },
    lowerUsesTerrain: lower.usesTerrain,
    frequencies: freqs.map((x) => ({ value: x.value, name: x.name })),
    remarks: props.remarks ? String(props.remarks) : undefined,
    source,
    ring,
  };
}

function parseRunwayHeading(r: Record<string, unknown>): number | undefined {
  const th = r.trueHeading as { value?: number } | number | undefined;
  if (typeof th === "number" && Number.isFinite(th)) return th;
  if (th && typeof th === "object" && typeof th.value === "number") return th.value;
  const tb = r.trueBearing as { value?: number } | number | undefined;
  if (typeof tb === "number" && Number.isFinite(tb)) return tb;
  if (tb && typeof tb === "object" && typeof tb.value === "number") return tb.value;
  return undefined;
}

function parseAirport(f: GeoJSON.Feature): AirportFeature | null {
  const p = f.properties as Record<string, unknown>;
  if (f.geometry?.type !== "Point") return null;
  const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
  const icao = p.icaoCode ? String(p.icaoCode) : undefined;
  const runways =
    (p.runways as Record<string, unknown>[] | undefined)?.map((r) => {
      const lengthRaw = r.length as { value?: number } | undefined;
      const widthRaw = r.width as { value?: number } | undefined;
      const surfaceRaw = r.surface as { type?: string } | string | undefined;
      return {
        designator: String(r.designator ?? "?"),
        lengthM: lengthRaw?.value,
        widthM: widthRaw?.value,
        surface: typeof surfaceRaw === "string" ? surfaceRaw : surfaceRaw?.type,
        trueHeading: parseRunwayHeading(r),
      };
    }) ?? [];
  const freqs =
    (p.frequencies as { value: string; name?: string }[] | undefined)?.map((x) => ({
      value: x.value,
      name: x.name,
    })) ?? [];
  const elev = p.elevation as { value?: number; unit?: number } | undefined;
  return {
    id: String(p._id ?? icao ?? p.name),
    icao,
    name: String(p.name ?? icao ?? "Airfield"),
    lon,
    lat,
    elevationFt: elev?.unit === 1 ? elev.value : elev?.value,
    runways,
    frequencies: freqs,
  };
}

function parseNavaid(f: GeoJSON.Feature): NavaidFeature | null {
  const p = f.properties as Record<string, unknown>;
  if (f.geometry?.type !== "Point") return null;
  const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
  const freq = p.frequency as { value?: string } | undefined;
  return {
    id: String(p._id ?? p.identifier),
    name: String(p.name ?? p.identifier),
    identifier: String(p.identifier ?? ""),
    type: String(p.type ?? "NAVAID"),
    lon,
    lat,
    frequency: freq?.value,
  };
}

function validateGbSubset(airspaces: AirspaceFeature[]) {
  const names = airspaces.map((a) => a.name.toUpperCase());
  const hasLondonTma = names.some((n) => n.includes("LONDON") && n.includes("TMA"));
  const hasScottish = names.some((n) => n.includes("SCOTTISH") && n.includes("TMA"));
  const hasHeathrowFrz = names.some((n) => n.includes("HEATHROW") && n.includes("FRZ"));
  const hasCtr = names.some((n) => n.includes(" CTR") || n.endsWith(" CTR"));
  if (!hasLondonTma) throw new Error("Validation: London TMA missing from GB extract");
  if (!hasScottish) throw new Error("Validation: Scottish TMA missing from GB extract");
  if (!hasHeathrowFrz) throw new Error("Validation: Heathrow FRZ missing from GB extract");
  if (!hasCtr) throw new Error("Validation: no CTR found in GB extract");
}

async function main() {
  fs.mkdirSync(CELLS_DIR, { recursive: true });
  const existing = fs.readdirSync(CELLS_DIR);
  for (const f of existing) {
    if (f.endsWith(".json")) fs.unlinkSync(path.join(CELLS_DIR, f));
  }

  const airspaces: AirspaceFeature[] = [];
  const airports: AirportFeature[] = [];
  const navaids: NavaidFeature[] = [];
  const seenAirport = new Set<string>();
  const seenNavaid = new Set<string>();
  const seenAirspace = new Set<string>();

  for (const code of PACK_COUNTRIES) {
    console.log(`[build-data] ${code}…`);
    const asp = await downloadNdGeoJson(`${EXPORT_BASE}/${code}_asp.ndgeojson`);
    const raa = await downloadNdGeoJson(`${EXPORT_BASE}/${code}_raa.ndgeojson`);
    const apt = await downloadNdGeoJson(`${EXPORT_BASE}/${code}_apt.ndgeojson`);
    const nav = await downloadNdGeoJson(`${EXPORT_BASE}/${code}_nav.ndgeojson`);

    for (const f of [...asp, ...raa]) {
      const parsed = parseAirspaceFeature(f, "openaip");
      if (!parsed || seenAirspace.has(parsed.id)) continue;
      seenAirspace.add(parsed.id);
      airspaces.push(parsed);
    }
    for (const f of apt) {
      const a = parseAirport(f);
      if (!a || seenAirport.has(a.id)) continue;
      seenAirport.add(a.id);
      airports.push(a);
    }
    for (const f of nav) {
      const n = parseNavaid(f);
      if (!n || seenNavaid.has(n.id)) continue;
      seenNavaid.add(n.id);
      navaids.push(n);
    }
  }

  const overridePath = path.join(ROOT, "data", "overrides", "heathrow-frz.json");
  const overrides = JSON.parse(fs.readFileSync(overridePath, "utf8")) as {
    features: Record<string, unknown>[];
  };
  for (const o of overrides.features) {
    const feat: GeoJSON.Feature = {
      type: "Feature",
      properties: o,
      geometry: { type: "Polygon", coordinates: [o.ring as [number, number][]] },
    };
    const parsed = parseAirspaceFeature(feat, "override");
    if (parsed && !seenAirspace.has(parsed.id)) {
      seenAirspace.add(parsed.id);
      airspaces.push(parsed);
    }
  }

  const gbOnly = airspaces.filter((a) => {
    const c = ringCentroid(a.ring);
    return c.lat >= 49 && c.lat <= 61 && c.lon >= -8.8 && c.lon <= 2.2;
  });
  validateGbSubset(gbOnly);

  const cells = new Map<string, AirspaceFeature[]>();
  for (const a of airspaces) {
    const c = ringCentroid(a.ring);
    const id = cellIdFor(c.lat, c.lon);
    let list = cells.get(id);
    if (!list) {
      list = [];
      cells.set(id, list);
    }
    list.push(a);
  }

  const cellIndex: CellIndexEntry[] = [];
  for (const [id, list] of cells) {
    const [latStr, lonStr] = id.split("_");
    fs.writeFileSync(path.join(CELLS_DIR, `${id}.json`), JSON.stringify(list));
    cellIndex.push({
      id,
      south: Number(latStr),
      west: Number(lonStr),
      north: Number(latStr) + 10,
      east: Number(lonStr) + 10,
      count: list.length,
    });
  }
  cellIndex.sort((a, b) => a.id.localeCompare(b.id));

  const search: SearchEntry[] = [];
  for (const a of airspaces) {
    const c = ringCentroid(a.ring);
    search.push({
      id: a.id,
      kind: "airspace",
      label: a.name,
      sub: a.category.toUpperCase(),
      lon: c.lon,
      lat: c.lat,
      cellId: cellIdFor(c.lat, c.lon),
    });
  }
  for (const a of airports) {
    search.push({
      id: a.id,
      kind: "airport",
      label: a.icao ? `${a.icao} — ${a.name}` : a.name,
      sub: "Airfield",
      lon: a.lon,
      lat: a.lat,
    });
  }
  for (const p of WORLD_PLACES) {
    search.push({
      id: p.id,
      kind: "place",
      label: p.name,
      sub: p.admin,
      lon: p.lon,
      lat: p.lat,
    });
  }

  const meta: UkDataMeta = {
    builtAt: new Date().toISOString(),
    airspaceCount: airspaces.length,
    airportCount: airports.length,
    sourceDate: new Date().toISOString().slice(0, 10),
    licence: "OpenAIP CC BY-NC 4.0 + overrides; not for navigation",
    regionId: "world",
    packName: "Europe & North America",
    countryCode: "EU-NA",
    countryName: "Europe & North America",
    countries: PACK_COUNTRIES,
  };

  fs.writeFileSync(path.join(OUT, "cell-index.json"), JSON.stringify(cellIndex));
  fs.writeFileSync(path.join(OUT, "airports.json"), JSON.stringify(airports));
  fs.writeFileSync(path.join(OUT, "navaids.json"), JSON.stringify(navaids));
  fs.writeFileSync(path.join(OUT, "places.json"), JSON.stringify(WORLD_PLACES));
  fs.writeFileSync(path.join(OUT, "search-index.json"), JSON.stringify(search));
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));

  console.log(
    `[build-data] ${airspaces.length} airspaces in ${cellIndex.length} cells, ${airports.length} airports`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
