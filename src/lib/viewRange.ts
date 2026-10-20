import type { SearchEntry } from "@/lib/types";

/** Metres of camera range that frames a search hit. */
export function viewRangeMetres(kind: SearchEntry["kind"], ring?: [number, number][]): number {
  if (kind === "airport") return 18_000;
  if (kind === "place") return 70_000;
  if (!ring || ring.length < 2) return 45_000;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lat > north) north = lat;
  }
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  const heightM = (north - south) * 111_320;
  const widthM = (east - west) * 111_320 * Math.cos(midLat);
  const span = Math.max(heightM, widthM, 2_000);
  return Math.min(320_000, Math.max(8_000, span * 1.6));
}
