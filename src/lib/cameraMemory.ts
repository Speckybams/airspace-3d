const KEY = "voluspace-camera";

export interface SavedCamera {
  lon: number;
  lat: number;
  range: number;
  heading: number;
  pitch: number;
}

export const LONDON_CAMERA: SavedCamera = {
  lon: -0.4543,
  lat: 51.47,
  range: 180_000,
  heading: 0,
  pitch: (-40 * Math.PI) / 180,
};

import type { HashState } from "./urlState";

export function loadCameraPose(): SavedCamera {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "") as Partial<SavedCamera>;
    if (
      typeof raw.lon === "number" &&
      typeof raw.lat === "number" &&
      typeof raw.range === "number" &&
      Number.isFinite(raw.lon) &&
      Number.isFinite(raw.lat) &&
      Number.isFinite(raw.range)
    ) {
      return {
        lon: raw.lon,
        lat: raw.lat,
        range: raw.range,
        heading: typeof raw.heading === "number" ? raw.heading : 0,
        pitch: typeof raw.pitch === "number" ? raw.pitch : LONDON_CAMERA.pitch,
      };
    }
  } catch {
    /* first visit */
  }
  return LONDON_CAMERA;
}

/** Hash camera wins when valid; otherwise localStorage or London default. */
export function resolveOpeningCamera(hash: HashState): SavedCamera {
  const c = hash.camera;
  if (c) {
    return {
      lon: c.lon,
      lat: c.lat,
      range: c.range,
      heading: c.heading,
      pitch: c.pitch,
    };
  }
  return loadCameraPose();
}

let lastSave = 0;

export function saveCameraPose(pose: SavedCamera) {
  const now = performance.now();
  if (now - lastSave < 800) return;
  lastSave = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(pose));
  } catch {
    /* private mode or quota */
  }
}
