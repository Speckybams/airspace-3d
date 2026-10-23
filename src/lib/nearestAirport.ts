import { Math as CesiumMath } from "cesium";
import type { AirportFeature } from "./types";

const NEAR_VIEW_M = 25_000;

export function nearestAirportWithRunway(
  airports: AirportFeature[],
  lat: number,
  lon: number,
  maxDistM = NEAR_VIEW_M,
): { apt: AirportFeature; distM: number } | null {
  let best: AirportFeature | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const apt of airports) {
    const hasRwy = apt.runways.some((r) => r.lengthM && r.lengthM > 0);
    if (!hasRwy) continue;
    const dLat = (apt.lat - lat) * 111_000;
    const dLon = (apt.lon - lon) * 111_000 * Math.cos(CesiumMath.toRadians(lat));
    const d = Math.hypot(dLat, dLon);
    if (d < bestD) {
      bestD = d;
      best = apt;
    }
  }
  if (!best || bestD > maxDistM) return null;
  return { apt: best, distM: bestD };
}

export function snapAirport(
  airports: AirportFeature[],
  lat: number,
  lon: number,
  maxDistM = 2_000,
): { apt: AirportFeature; distM: number } | null {
  return nearestAirportWithRunway(airports, lat, lon, maxDistM);
}
