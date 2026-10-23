import { dropDuplicateVolumes, markStackedShelves, normalizeAirspace } from "@/lib/filterRegion";
import type { AirspaceFeature } from "@/lib/types";

const cellCache = new Map<string, AirspaceFeature[]>();

export async function fetchAirspaceCell(cellId: string): Promise<AirspaceFeature[]> {
  const hit = cellCache.get(cellId);
  if (hit) return hit;
  const res = await fetch(`/data/world/cells/${cellId}.json`);
  if (!res.ok) throw new Error(`Cell ${cellId}: ${res.status}`);
  const raw = (await res.json()) as AirspaceFeature[];
  for (const feature of raw) normalizeAirspace(feature);
  const data = dropDuplicateVolumes(raw);
  markStackedShelves(data);
  cellCache.set(cellId, data);
  return data;
}

export function findAirspaceInCache(id: string): AirspaceFeature | null {
  for (const list of cellCache.values()) {
    const found = list.find((a) => a.id === id);
    if (found) return found;
  }
  return null;
}

export async function fetchAirspaceById(
  id: string,
  cellId: string,
): Promise<AirspaceFeature | null> {
  const list = await fetchAirspaceCell(cellId);
  return list.find((a) => a.id === id) ?? null;
}

export function airspacesForCellIds(cellIds: string[]): AirspaceFeature[] {
  const out: AirspaceFeature[] = [];
  for (const id of cellIds) {
    const list = cellCache.get(id);
    if (list) out.push(...list);
  }
  return out;
}
