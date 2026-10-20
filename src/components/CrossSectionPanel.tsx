import type { AirspaceFeature } from "@/lib/types";

/** Placeholder panel — draw line tool hooks into Cesium in a follow-up iteration. */
export function CrossSectionPanel({ airspaces }: { airspaces: AirspaceFeature[] }) {
  return (
    <div className="cross-section-panel">
      <p className="small">
        Cross-section: {airspaces.length} volumes loaded. Use map query + altitude slice for vertical
        context; full line profile renders against terrain in the next pass.
      </p>
    </div>
  );
}
