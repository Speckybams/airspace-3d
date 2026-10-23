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

/** Cells whose 10° boxes intersect the view rectangle (with margin in degrees). */
export function cellsInView(
  south: number,
  west: number,
  north: number,
  east: number,
  marginDeg = 12,
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
  const span = Math.min(45, Math.max(2, (heightM / 111_000) * 2.2));
  return {
    south: lat - span,
    north: lat + span,
    west: lon - span,
    east: lon + span,
  };
}
