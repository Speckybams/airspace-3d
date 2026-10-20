/** WGS84 ellipsoidal height in metres. Matches the slice shader. */
export function ellipsoidHeightM(x: number, y: number, z: number): number {
  const a = 6378137.0;
  const b = 6356752.314245;
  const e2 = 6.69437999014e-3;
  const ep2 = 6.73949674228e-3;
  const p = Math.hypot(x, y);
  const theta = Math.atan2(z * a, p * b);
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const lat = Math.atan2(z + ep2 * b * sinT * sinT * sinT, p - e2 * a * cosT * cosT * cosT);
  const sinLat = Math.sin(lat);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const cosLat = Math.cos(lat);
  if (Math.abs(cosLat) < 1e-8) return Math.abs(z) - b;
  return p / cosLat - n;
}
