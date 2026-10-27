import { clearCachedCells, readCachedCell, writeCachedCell } from "@/lib/cellStore";
import { dropDuplicateVolumes, markStackedShelves, normalizeAirspace } from "@/lib/filterRegion";
import type { AirspaceFeature } from "@/lib/types";

const cellCache = new Map<string, AirspaceFeature[]>();
const missingCells = new Set<string>();
const inflight = new Map<string, Promise<AirspaceFeature[]>>();
let revision = "";

/** Drop the disk cache when the published pack changes, then persist anything already in memory. */
export function setCellDataRevision(builtAt: string) {
  const prev = localStorage.getItem("voluspace-data-rev");
  if (prev && prev !== builtAt) {
    cellCache.clear();
    missingCells.clear();
    void clearCachedCells();
  }
  revision = builtAt;
  localStorage.setItem("voluspace-data-rev", builtAt);
  for (const [id, data] of cellCache) void writeCachedCell(revision, id, data);
}

export function fetchAirspaceCell(cellId: string): Promise<AirspaceFeature[]> {
  const pending = inflight.get(cellId);
  if (pending) return pending;
  const job = loadCell(cellId).finally(() => inflight.delete(cellId));
  inflight.set(cellId, job);
  return job;
}

async function loadCell(cellId: string): Promise<AirspaceFeature[]> {
  if (missingCells.has(cellId)) return [];
  const hit = cellCache.get(cellId);
  if (hit) return hit;
  if (revision) {
    const stored = await Promise.race([
      readCachedCell(revision, cellId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 80)),
    ]);
    if (stored && stored.length > 0) {
      cellCache.set(cellId, stored);
      return stored;
    }
  }
  return readCellFromNetwork(cellId);
}

async function readCellFromNetwork(cellId: string): Promise<AirspaceFeature[]> {
  const res = await fetch(`/data/world/cells/${cellId}.json`);
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<")) {
    if (!cellCache.has(cellId)) missingCells.add(cellId);
    return cellCache.get(cellId) ?? [];
  }
  let raw: AirspaceFeature[];
  try {
    raw = JSON.parse(text) as AirspaceFeature[];
  } catch {
    if (!cellCache.has(cellId)) missingCells.add(cellId);
    return cellCache.get(cellId) ?? [];
  }
  for (const feature of raw) normalizeAirspace(feature);
  const data = dropDuplicateVolumes(raw);
  markStackedShelves(data);
  cellCache.set(cellId, data);
  if (revision) void writeCachedCell(revision, cellId, data);
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
