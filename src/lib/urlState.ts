import type { BasemapId, ToolMode } from "./types";

export interface HashState {
  basemap?: BasemapId;
  selectedId?: string | null;
  altBandFt?: [number, number];
  tool?: ToolMode;
}

export function encodeAppHash(s: HashState): string {
  const payload = btoa(JSON.stringify(s));
  return `#vs=${payload}`;
}

export function decodeAppHash(hash: string): HashState {
  if (!hash.startsWith("#vs=")) return {};
  try {
    return JSON.parse(atob(hash.slice(4))) as HashState;
  } catch {
    return {};
  }
}
