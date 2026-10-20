import type { UkDataMeta } from "@/lib/types";
import { metresToFeet } from "@/lib/units";

export function StatusBar({
  lon,
  lat,
  heightM,
  heading,
  meta,
}: {
  lon: number;
  lat: number;
  heightM: number;
  heading: number;
  meta: UkDataMeta | null;
}) {
  return (
    <footer className="status-bar mono">
      <span>
        {lat.toFixed(4)}°N {lon.toFixed(4)}°E
      </span>
      <span>CAM {Math.round(metresToFeet(heightM)).toLocaleString()} ft</span>
      <span>HDG {Math.round(heading).toString().padStart(3, "0")}°</span>
      <span className="muted">Data {meta?.builtAt?.slice(0, 10) ?? "—"}</span>
      <span className="muted">OpenAIP · OS · Cesium · Not for navigation</span>
    </footer>
  );
}
