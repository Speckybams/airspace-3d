import { categoryFromDesignator, volumeTypeLabel } from "@/lib/classify";
import type { AirspaceCategory, AirspaceFeature } from "@/lib/types";

export type FilterRegion = "uk" | "na" | "icao";

const CONTROLLED = new Set<AirspaceCategory>(["ctr", "cta", "tma", "atz"]);
export const NA_CLASS_LETTERS = ["B", "C", "D", "E", "F"] as const;

/** Categories that have their own checkbox on the North American rail. */
const NA_CATEGORY_ROWS = new Set<AirspaceCategory>([
  "airway",
  "danger",
  "restricted",
  "prohibited",
  "moa",
  "alert",
  "warning",
  "rmz",
  "tmz",
  "glider",
  "other",
]);

export function filterRegionFor(lat: number, lon: number): FilterRegion {
  if (lat >= 49 && lat <= 61 && lon >= -8.8 && lon <= 2.2) return "uk";
  if (lon <= -50 && lat >= 14 && lat <= 84) return "na";
  return "icao";
}

export function classFilterApplies(region: FilterRegion, category: AirspaceCategory, icaoClass: string): boolean {
  return region === "na" && CONTROLLED.has(category) && (NA_CLASS_LETTERS as readonly string[]).includes(icaoClass);
}

/**
 * True when this volume belongs to a checkbox the viewer can see.
 * In North America, class B–F volumes follow the class row even if the
 * underlying CTA/CTR category flag is off.
 */
export function airspaceListed(
  region: FilterRegion,
  category: AirspaceCategory,
  icaoClass: string,
  categoryVisible: Record<string, boolean>,
  classVisible: Record<string, boolean>,
): boolean {
  if (classFilterApplies(region, category, icaoClass)) return classVisible[icaoClass] !== false;
  if (region === "na" && !NA_CATEGORY_ROWS.has(category)) return false;
  return categoryVisible[category] !== false;
}

export function airspaceTypeLabel(feature: AirspaceFeature): string {
  const [lon, lat] = feature.ring[0] ?? [0, 0];
  if (classFilterApplies(filterRegionFor(lat, lon), feature.category, feature.icaoClass)) {
    return `CLASS ${feature.icaoClass}`;
  }
  return volumeTypeLabel(feature.name, feature.category, feature.icaoClass);
}

function parkUnlistedNorthAmerica(feature: AirspaceFeature): AirspaceFeature {
  const [lon, lat] = feature.ring[0] ?? [0, 0];
  if (filterRegionFor(lat, lon) !== "na") return feature;
  const classOwned = classFilterApplies("na", feature.category, feature.icaoClass);
  if (!classOwned && !NA_CATEGORY_ROWS.has(feature.category)) feature.category = "other";
  return feature;
}

/** Correct name heuristics on volumes already written into cell files. */
export function normalizeAirspace(feature: AirspaceFeature): AirspaceFeature {
  const name = feature.name.toUpperCase();
  const designated = categoryFromDesignator(name);
  if (designated) {
    feature.category = designated;
    return parkUnlistedNorthAmerica(feature);
  }
  let category = feature.category;
  if (/\bMOA\b/.test(name)) category = "moa";
  else if (name.includes("ALERT")) category = "alert";
  else if (/\bWARNING\b/.test(name)) category = "warning";
  else if (/^R-\d/.test(name)) category = "restricted";
  else if (/\bAIRWAY\b|\bAWY\b/.test(name)) category = "airway";
  else if ((NA_CLASS_LETTERS as readonly string[]).includes(feature.icaoClass) && /CLASS\s*[BCDEF]/.test(name)) {
    category = "cta";
  } else if (category === "other" && (NA_CLASS_LETTERS as readonly string[]).includes(feature.icaoClass)) {
    category = "cta";
  } else if (name.startsWith("CTA") || name.includes(" CTA")) category = "cta";
  else if (category === "airway" && !/\bAIRWAY\b|\bAWY\b|^[A-Z]{1,2}\d{2,4}\b/.test(name)) category = "other";
  if (category !== feature.category) feature.category = category;
  return parkUnlistedNorthAmerica(feature);
}

function shelfParent(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\/\d+\b/g, "")
    .replace(/\s+\d+(?:\.\d+)?\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ringBox(ring: [number, number][]) {
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

function overlapOfSmaller(
  a: { west: number; south: number; east: number; north: number },
  b: { west: number; south: number; east: number; north: number },
): number {
  const width = Math.max(0, Math.min(a.east, b.east) - Math.max(a.west, b.west));
  const height = Math.max(0, Math.min(a.north, b.north) - Math.max(a.south, b.south));
  const inter = width * height;
  const areaA = Math.max(1e-9, (a.east - a.west) * (a.north - a.south));
  const areaB = Math.max(1e-9, (b.east - b.west) * (b.north - b.south));
  return inter / Math.min(areaA, areaB);
}

function twinSignature(feature: AirspaceFeature): string {
  const ring = feature.ring;
  let sig = `${ring.length}|${feature.lower.display}|${feature.upper.display}`;
  const step = Math.max(1, Math.floor(ring.length / 6));
  for (let i = 0; i < ring.length; i += step) {
    sig += `|${ring[i][0].toFixed(3)},${ring[i][1].toFixed(3)}`;
  }
  return sig;
}

function keepScore(feature: AirspaceFeature): number {
  const controlled = feature.category === "tma" || feature.category === "cta" || feature.category === "ctr" || feature.category === "atz";
  return (controlled ? 4 : 0) + (feature.icaoClass !== "G" ? 2 : 0);
}

/** Drop a second copy of the same shape and limits, such as LF-R205 sitting on TMA Paris. */
export function dropDuplicateVolumes(features: AirspaceFeature[]): AirspaceFeature[] {
  const best = new Map<string, AirspaceFeature>();
  for (const feature of features) {
    const key = twinSignature(feature);
    const current = best.get(key);
    if (!current || keepScore(feature) > keepScore(current)) best.set(key, feature);
  }
  return best.size === features.length ? features : [...best.values()];
}

/** Numbered shelves that share a footprint: fill the lowest, leave the higher steps as wireframes. */
export function markStackedShelves(features: AirspaceFeature[]): void {
  const groups = new Map<string, AirspaceFeature[]>();
  for (const feature of features) {
    feature.thinFill = false;
    const key = `${feature.category}|${shelfParent(feature.name)}`;
    const list = groups.get(key);
    if (list) list.push(feature);
    else groups.set(key, [feature]);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const boxes = list.map((feature) => ringBox(feature.ring));
    for (let i = 0; i < list.length; i++) {
      const base = list[i].lower.ellipsoidM;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        if (list[j].lower.ellipsoidM >= base - 40) continue;
        if (overlapOfSmaller(boxes[i], boxes[j]) < 0.55) continue;
        list[i].thinFill = true;
        break;
      }
    }
  }
}
