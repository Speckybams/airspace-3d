import type { SavedCamera } from "./cameraMemory";
import { encodeAppHash } from "./urlState";
import type { AppState } from "@/store/appStore";

export function hashFragmentForState(state: Pick<AppState, "basemap" | "selectedAirspaceId" | "altBandFt" | "tool">, pose: SavedCamera): string {
  return encodeAppHash({
    basemap: state.basemap,
    selectedId: state.selectedAirspaceId,
    altBandFt: state.altBandFt,
    tool: state.tool,
    camera: {
      lon: pose.lon,
      lat: pose.lat,
      range: pose.range,
      heading: pose.heading,
      pitch: pose.pitch,
    },
  });
}

export function replaceUrlHash(fragment: string) {
  const url = `${window.location.pathname}${window.location.search}${fragment}`;
  history.replaceState(null, "", url);
}
