import { pointInRing } from "./airspace-query";
import { metresToFeet } from "./units";
import type { AirspaceFeature } from "./types";

export interface ProfileSample {
  distM: number;
  terrainFt: number;
}

export interface ProfileBand {
  id: string;
  name: string;
  category: string;
  distStartM: number;
  distEndM: number;
  lowerFt: number;
  upperFt: number;
}

function segmentBBox(lon1: number, lat1: number, lon2: number, lat2: number) {
  const pad = 0.02;
  return {
    west: Math.min(lon1, lon2) - pad,
    east: Math.max(lon1, lon2) + pad,
    south: Math.min(lat1, lat2) - pad,
    north: Math.max(lat1, lat2) + pad,
  };
}

function ringMayCrossSegment(
  ring: [number, number][],
  box: { west: number; east: number; south: number; north: number },
): boolean {
  for (const [lon, lat] of ring) {
    if (lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north) return true;
  }
  return false;
}

export function buildSectionProfile(
  features: AirspaceFeature[],
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  terrainAt: (lon: number, lat: number) => number,
  steps = 48,
): { lengthM: number; samples: ProfileSample[]; bands: ProfileBand[] } {
  const samples: ProfileSample[] = [];
  let lengthM = 0;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = lon1 + t * (lon2 - lon1);
    const lat = lat1 + t * (lat2 - lat1);
    lons.push(lon);
    lats.push(lat);
    const terrainM = terrainAt(lon, lat);
    if (i > 0) {
      const dLat = (lat - lats[i - 1]) * 111_000;
      const dLon = (lon - lons[i - 1]) * 111_000 * Math.cos((lat * Math.PI) / 180);
      lengthM += Math.hypot(dLat, dLon);
    }
    samples.push({ distM: lengthM, terrainFt: metresToFeet(terrainM) });
  }

  const bands: ProfileBand[] = [];
  const segBox = segmentBBox(lon1, lat1, lon2, lat2);
  const candidates = features.filter((f) => f.ring.length >= 3 && ringMayCrossSegment(f.ring, segBox));

  for (const f of candidates) {
    let inSeg = false;
    let segStart = 0;
    let segTerrain = 0;
    for (let i = 0; i <= steps; i++) {
      let inside = false;
      try {
        inside = pointInRing(lons[i], lats[i], f.ring);
      } catch {
        inside = false;
      }
      const distM = samples[i].distM;
      const terrainM = terrainAt(lons[i], lats[i]);
      if (inside && !inSeg) {
        inSeg = true;
        segStart = distM;
        segTerrain = terrainM;
      }
      if (inside) segTerrain = terrainM;
      if ((!inside || i === steps) && inSeg) {
        inSeg = false;
        const endM = inside && i === steps ? distM : Math.max(segStart, samples[Math.max(0, i - 1)].distM);
        const lowerM = f.lowerUsesTerrain ? segTerrain + f.lower.ellipsoidM : f.lower.ellipsoidM;
        const upperM = f.upper.ellipsoidM;
        if (endM > segStart + 0.5 && Number.isFinite(lowerM) && Number.isFinite(upperM)) {
          bands.push({
            id: f.id,
            name: f.name,
            category: f.category,
            distStartM: segStart,
            distEndM: endM,
            lowerFt: metresToFeet(lowerM),
            upperFt: metresToFeet(upperM),
          });
        }
      }
    }
  }
  return { lengthM: Math.max(lengthM, 1), samples, bands };
}
