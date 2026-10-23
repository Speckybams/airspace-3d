import { pointInRing } from "./airspace-query";
import type { AirspaceFeature } from "./types";

/** Volumes whose footprint contains any sample along the segment (loaded data only). */
export function airspacesAlongSegment(
  features: AirspaceFeature[],
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  steps = 40,
): AirspaceFeature[] {
  const ids = new Set<string>();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = lon1 + t * (lon2 - lon1);
    const lat = lat1 + t * (lat2 - lat1);
    for (const f of features) {
      if (pointInRing(lon, lat, f.ring)) ids.add(f.id);
    }
  }
  return features.filter((f) => ids.has(f.id));
}

export function sampleLine(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  count: number,
): { lon: number; lat: number; t: number }[] {
  const out: { lon: number; lat: number; t: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    out.push({
      lon: lon1 + t * (lon2 - lon1),
      lat: lat1 + t * (lat2 - lat1),
      t,
    });
  }
  return out;
}
