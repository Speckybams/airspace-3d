import { MAX_PITCH, MIN_PITCH, MIN_RANGE, MAX_RANGE } from "@/cesium/touchOrbit";
import type { BasemapId, ToolMode } from "./types";

const BASEMAPS = new Set<BasemapId>(["chart", "dark", "satellite"]);
const TOOLS = new Set<ToolMode>(["navigate", "query", "measure", "crossSection", "route"]);

export interface HashCamera {
  lon: number;
  lat: number;
  range: number;
  heading: number;
  pitch: number;
}

export interface HashState {
  basemap?: BasemapId;
  selectedId?: string | null;
  altBandFt?: [number, number];
  tool?: ToolMode;
  camera?: HashCamera;
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function parseBasemap(value: unknown): BasemapId | undefined {
  return typeof value === "string" && BASEMAPS.has(value as BasemapId)
    ? (value as BasemapId)
    : undefined;
}

function parseTool(value: unknown): ToolMode | undefined {
  return typeof value === "string" && TOOLS.has(value as ToolMode) ? (value as ToolMode) : undefined;
}

function parseAltBand(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const low = value[0];
  const high = value[1];
  if (!isFiniteNum(low) || !isFiniteNum(high)) return undefined;
  const clampedLow = Math.max(0, Math.min(66000, low));
  const clampedHigh = Math.max(1000, Math.min(66000, high));
  if (clampedHigh <= clampedLow + 499) return undefined;
  return [clampedLow, clampedHigh];
}

function parseCamera(raw: unknown): HashCamera | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const lon = o.lon;
  const lat = o.lat;
  const range = o.range;
  const heading = o.heading;
  const pitch = o.pitch;
  if (!isFiniteNum(lon) || lon < -180 || lon > 180) return undefined;
  if (!isFiniteNum(lat) || lat < -90 || lat > 90) return undefined;
  if (!isFiniteNum(range) || range < MIN_RANGE || range > MAX_RANGE) return undefined;
  if (!isFiniteNum(heading)) return undefined;
  if (!isFiniteNum(pitch) || pitch < MIN_PITCH || pitch > MAX_PITCH) return undefined;
  return { lon, lat, range, heading, pitch };
}

function parseSelectedId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && value.length > 0 && value.length < 256) return value;
  return undefined;
}

/** Normalise a decoded payload; invalid fields are dropped. */
export function decodeAppHash(hash: string): HashState {
  if (!hash.startsWith("#vs=")) return {};
  try {
    const raw = JSON.parse(atob(hash.slice(4))) as Record<string, unknown>;
    const out: HashState = {};
    const basemap = parseBasemap(raw.basemap);
    if (basemap) out.basemap = basemap;
    const tool = parseTool(raw.tool);
    if (tool) out.tool = tool;
    const altBandFt = parseAltBand(raw.altBandFt);
    if (altBandFt) out.altBandFt = altBandFt;
    const selectedId = parseSelectedId(raw.selectedId);
    if (selectedId !== undefined) out.selectedId = selectedId;
    const camera = parseCamera(raw.camera);
    if (camera) out.camera = camera;
    return out;
  } catch {
    return {};
  }
}

export function encodeAppHash(s: HashState): string {
  const payload: Record<string, unknown> = {};
  if (s.basemap) payload.basemap = s.basemap;
  if (s.selectedId !== undefined) payload.selectedId = s.selectedId;
  if (s.altBandFt) payload.altBandFt = s.altBandFt;
  if (s.tool) payload.tool = s.tool;
  if (s.camera) payload.camera = s.camera;
  return `#vs=${btoa(JSON.stringify(payload))}`;
}

/** Read hash once at startup (browser only). */
export function readBootHash(): HashState {
  if (typeof window === "undefined") return {};
  return decodeAppHash(window.location.hash);
}
