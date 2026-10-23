function ukRegionalGeoidM(lat: number, lon: number): number {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const base = 49 + 2.5 * Math.sin(latRad * 2.1) + 1.2 * Math.cos(lonRad * 1.7);
  const south = lat < 50 ? (50 - lat) * 0.15 : 0;
  const north = lat > 55 ? (lat - 55) * 0.2 : 0;
  return base + south + north;
}

/** Coarse EGM96-style geoid height (m) above WGS84 ellipsoid — visualiser accuracy only. */
export function geoidOffsetM(lat: number, lon: number): number {
  if (lat >= 49 && lat <= 61 && lon >= -8.8 && lon <= 2.2) {
    return ukRegionalGeoidM(lat, lon);
  }
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  return 20 + 25 * Math.sin(latRad * 0.85) + 8 * Math.cos(lonRad * 0.75);
}

/** @deprecated Use geoidOffsetM — kept for tests referencing UK-only name. */
export function ukGeoidOffsetM(lat: number, lon: number): number {
  return ukRegionalGeoidM(lat, lon);
}

export function amslFtToEllipsoidM(amslFt: number, lat: number, lon: number): number {
  const amslM = amslFt * 0.3048;
  return amslM + geoidOffsetM(lat, lon);
}

export function amslMToEllipsoidM(amslM: number, lat: number, lon: number): number {
  return amslM + geoidOffsetM(lat, lon);
}
