import fs from "node:fs";
import path from "node:path";
import { classifyAirspace } from "../src/lib/classify";
import { amslFtToEllipsoidM, ukGeoidOffsetM } from "../src/lib/geoid";
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

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "data", "uk");
const EXPORT_BASE = "https://storage.openaip.net/openaip-system-exports";

async function downloadNdGeoJson(url: string): Promise<GeoJSON.Feature[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
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
    ellipsoidM = raw.value + (datum === "MSL" ? ukGeoidOffsetM(lat, lon) : 0);
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
  const ring = coords.map(([lon, lat]) => [lon, lat] as [number, number]);
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

function parseAirport(f: GeoJSON.Feature): AirportFeature | null {
  const p = f.properties as Record<string, unknown>;
  if (f.geometry?.type !== "Point") return null;
  const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates;
  const icao = p.icaoCode ? String(p.icaoCode) : undefined;
  const runways =
    (p.runways as { designator?: string; length?: { value?: number }; surface?: { type?: string } }[] | undefined)?.map(
      (r) => ({
        designator: r.designator ?? "?",
        lengthM: r.length?.value,
        surface: r.surface?.type,
      }),
    ) ?? [];
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

/** Compact UK places subset (GeoNames-style, CC BY). */
const UK_PLACES: PlaceFeature[] = [
  { id: "london", name: "London", lon: -0.1276, lat: 51.5074, population: 9000000, admin: "England" },
  { id: "birmingham", name: "Birmingham", lon: -1.8904, lat: 52.4862, population: 1140000, admin: "England" },
  { id: "manchester", name: "Manchester", lon: -2.2426, lat: 53.4808, population: 550000, admin: "England" },
  { id: "glasgow", name: "Glasgow", lon: -4.2518, lat: 55.8642, population: 635000, admin: "Scotland" },
  { id: "edinburgh", name: "Edinburgh", lon: -3.1883, lat: 55.9533, population: 540000, admin: "Scotland" },
  { id: "belfast", name: "Belfast", lon: -5.9301, lat: 54.5973, population: 345000, admin: "Northern Ireland" },
  { id: "cardiff", name: "Cardiff", lon: -3.1791, lat: 51.4816, population: 370000, admin: "Wales" },
  { id: "heathrow", name: "Heathrow", lon: -0.4543, lat: 51.4700, population: 0, admin: "England" },
  { id: "southampton", name: "Southampton", lon: -1.4044, lat: 50.9097, population: 260000, admin: "England" },
  { id: "bristol", name: "Bristol", lon: -2.5879, lat: 51.4545, population: 470000, admin: "England" },
];

function validate(airspaces: AirspaceFeature[]) {
  const names = airspaces.map((a) => a.name.toUpperCase());
  const hasLondonTma = names.some((n) => n.includes("LONDON") && n.includes("TMA"));
  const hasScottish = names.some((n) => n.includes("SCOTTISH") && n.includes("TMA"));
  const hasHeathrowFrz = names.some((n) => n.includes("HEATHROW") && n.includes("FRZ"));
  const hasCtr = names.some((n) => n.includes(" CTR") || n.endsWith(" CTR"));
  if (!hasLondonTma) throw new Error("Validation: London TMA missing");
  if (!hasScottish) throw new Error("Validation: Scottish TMA missing");
  if (!hasHeathrowFrz) throw new Error("Validation: Heathrow FRZ missing");
  if (!hasCtr) throw new Error("Validation: no CTR found");
  for (const a of airspaces) {
    if (a.upper.ellipsoidM < a.lower.ellipsoidM && !a.lowerUsesTerrain) {
      if (a.upper.ellipsoidM + 100 < a.lower.ellipsoidM) {
        console.warn(`Suspicious limits: ${a.name}`);
      }
    }
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const asp = await downloadNdGeoJson(`${EXPORT_BASE}/gb_asp.ndgeojson`);
  const raa = await downloadNdGeoJson(`${EXPORT_BASE}/gb_raa.ndgeojson`);
  const apt = await downloadNdGeoJson(`${EXPORT_BASE}/gb_apt.ndgeojson`);
  const nav = await downloadNdGeoJson(`${EXPORT_BASE}/gb_nav.ndgeojson`);

  const overridePath = path.join(ROOT, "data", "overrides", "heathrow-frz.json");
  const overrides = JSON.parse(fs.readFileSync(overridePath, "utf8")) as {
    features: Record<string, unknown>[];
  };

  const airspaces: AirspaceFeature[] = [];
  for (const f of [...asp, ...raa]) {
    const parsed = parseAirspaceFeature(f, "openaip");
    if (parsed) airspaces.push(parsed);
  }
  for (const o of overrides.features) {
    const feat: GeoJSON.Feature = {
      type: "Feature",
      properties: o,
      geometry: { type: "Polygon", coordinates: [o.ring as [number, number][]] },
    };
    const parsed = parseAirspaceFeature(feat, "override");
    if (parsed) airspaces.push(parsed);
  }

  const airports: AirportFeature[] = [];
  for (const f of apt) {
    const a = parseAirport(f);
    if (a) airports.push(a);
  }

  const navaids: NavaidFeature[] = [];
  for (const f of nav) {
    const n = parseNavaid(f);
    if (n) navaids.push(n);
  }

  validate(airspaces);

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
  for (const p of UK_PLACES) {
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
  };

  fs.writeFileSync(path.join(OUT, "airspace.json"), JSON.stringify(airspaces));
  fs.writeFileSync(path.join(OUT, "airports.json"), JSON.stringify(airports));
  fs.writeFileSync(path.join(OUT, "navaids.json"), JSON.stringify(navaids));
  fs.writeFileSync(path.join(OUT, "places.json"), JSON.stringify(UK_PLACES));
  fs.writeFileSync(path.join(OUT, "search-index.json"), JSON.stringify(search));
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));

  console.log(
    `[build-data] ${airspaces.length} airspaces, ${airports.length} airports, ${navaids.length} navaids`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
