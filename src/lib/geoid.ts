/** Approximate EGM96 geoid height (m) above WGS84 ellipsoid for UK lat/lon. */
export function ukGeoidOffsetM(lat: number, lon: number): number {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const base = 49 + 2.5 * Math.sin(latRad * 2.1) + 1.2 * Math.cos(lonRad * 1.7);
  const south = lat < 50 ? (50 - lat) * 0.15 : 0;
  const north = lat > 55 ? (lat - 55) * 0.2 : 0;
  return base + south + north;
}

export function amslFtToEllipsoidM(amslFt: number, lat: number, lon: number): number {
  const amslM = amslFt * 0.3048;
  return amslM + ukGeoidOffsetM(lat, lon);
}
