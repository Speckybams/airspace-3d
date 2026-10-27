export const CELL_DEG = 10;

export interface CellIndexEntry {
  id: string;
  south: number;
  west: number;
  north: number;
  east: number;
  count: number;
}

export function cellIdFor(lat: number, lon: number): string {
  const latBin = Math.floor(lat / CELL_DEG) * CELL_DEG;
  const lonBin = Math.floor(lon / CELL_DEG) * CELL_DEG;
  return `${latBin}_${lonBin}`;
}

export function cellBounds(id: string): { south: number; west: number; north: number; east: number } {
  const [latStr, lonStr] = id.split("_");
  const south = Number(latStr);
  const west = Number(lonStr);
  return { south, west, north: south + CELL_DEG, east: west + CELL_DEG };
}

/** Cells whose 10° boxes intersect the view rectangle (with a small fringe in degrees). */
export function cellsInView(
  south: number,
  west: number,
  north: number,
  east: number,
  marginDeg = 0.2,
): string[] {
  const s = south - marginDeg;
  const n = north + marginDeg;
  const w = west - marginDeg;
  const e = east + marginDeg;
  const ids: string[] = [];
  const latStart = Math.floor(s / CELL_DEG) * CELL_DEG;
  const latEnd = Math.floor(n / CELL_DEG) * CELL_DEG;
  const lonStart = Math.floor(w / CELL_DEG) * CELL_DEG;
  const lonEnd = Math.floor(e / CELL_DEG) * CELL_DEG;
  for (let lat = latStart; lat <= latEnd; lat += CELL_DEG) {
    for (let lon = lonStart; lon <= lonEnd; lon += CELL_DEG) {
      ids.push(`${lat}_${lon}`);
    }
  }
  return ids;
}

export function viewRectangleFromCamera(
  lon: number,
  lat: number,
  heightM: number,
): { south: number; west: number; north: number; east: number } {
  // Far out, a slightly wider box so the next country is already drawn as plates.
  // Capped so a space view does not pull the whole pack at once.
  const far = heightM > 304_800;
  const cap = far ? 20 : 12;
  const gain = far ? 0.9 : 0.7;
  const half = Math.min(cap, Math.max(0.45, (heightM / 111_000) * gain));
  return {
    south: lat - half,
    north: lat + half,
    west: lon - half,
    east: lon + half,
  };
}

/** Camera cell first, then the rest by distance from the view centre. */
export function sortCellsFrom(ids: string[], lat: number, lon: number): string[] {
  const home = cellIdFor(lat, lon);
  return [...ids].sort((a, b) => {
    if (a === home) return -1;
    if (b === home) return 1;
    const ba = cellBounds(a);
    const bb = cellBounds(b);
    const da = Math.hypot(ba.south + CELL_DEG / 2 - lat, ba.west + CELL_DEG / 2 - lon);
    const db = Math.hypot(bb.south + CELL_DEG / 2 - lat, bb.west + CELL_DEG / 2 - lon);
    return da - db;
  });
}
