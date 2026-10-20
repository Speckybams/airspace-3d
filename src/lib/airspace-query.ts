import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { polygon, point } from "@turf/helpers";
import type { AirspaceFeature } from "./types";

export function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  return booleanPointInPolygon(point([lon, lat]), polygon([ring]));
}

export function airspacesAtPoint(
  features: AirspaceFeature[],
  lon: number,
  lat: number,
  altitudeEllipsoidM: number,
  terrainM: number,
): AirspaceFeature[] {
  return features.filter((f) => {
    if (!pointInRing(lon, lat, f.ring)) return false;
    const lower =
      f.lowerUsesTerrain ? terrainM + f.lower.ellipsoidM : f.lower.ellipsoidM;
    const upper = f.upper.ellipsoidM;
    return altitudeEllipsoidM >= lower && altitudeEllipsoidM <= upper;
  });
}

export function altitudeBandActive(
  f: AirspaceFeature,
  bandLowM: number,
  bandHighM: number,
  terrainM: number,
): boolean {
  const lower = f.lowerUsesTerrain ? terrainM + f.lower.ellipsoidM : f.lower.ellipsoidM;
  const upper = f.upper.ellipsoidM;
  return upper >= bandLowM && lower <= bandHighM;
}
