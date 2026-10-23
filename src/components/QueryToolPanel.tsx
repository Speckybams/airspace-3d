import { airspacesAtPoint } from "@/lib/airspace-query";
import { airspaceTypeLabel } from "@/lib/filterRegion";
import type { AirspaceFeature } from "@/lib/types";
import { feetToMetres } from "@/lib/units";
import { useAppStore } from "@/store/appStore";

export function QueryToolPanel({
  airspaces,
  onSelectAirspace,
}: {
  airspaces: AirspaceFeature[];
  onSelectAirspace: (f: AirspaceFeature) => void;
}) {
  const queryAltFt = useAppStore((s) => s.queryAltFt);
  const setQueryAltFt = useAppStore((s) => s.setQueryAltFt);
  const query = useAppStore((s) => s.mapToolState.query);

  const hits = query
    ? airspacesAtPoint(
        airspaces,
        query.lon,
        query.lat,
        feetToMetres(queryAltFt) + query.terrainM,
        query.terrainM,
      ).sort((a, b) => {
        const ta = query.terrainM;
        const la = a.lowerUsesTerrain ? ta + a.lower.ellipsoidM : a.lower.ellipsoidM;
        const lb = b.lowerUsesTerrain ? ta + b.lower.ellipsoidM : b.lower.ellipsoidM;
        return la - lb;
      })
    : [];

  return (
    <div className="tool-panel">
      <h3>Query</h3>
      <p className="small muted">Click the map. Uses ground position even when airspace is drawn on top.</p>
      <label className="field">
        <span>Altitude (ft AMSL at terrain + value)</span>
        <input
          type="number"
          className="mono"
          value={queryAltFt}
          onChange={(e) => setQueryAltFt(Number(e.target.value))}
        />
      </label>
      {!query ? (
        <p className="small muted">No query point yet.</p>
      ) : hits.length === 0 ? (
        <p className="small">No loaded airspace contains this point at {queryAltFt.toLocaleString()} ft.</p>
      ) : (
        <ul className="tool-hit-list">
          {hits.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onSelectAirspace(f)}>
                <span className="mono">{f.name}</span>
                <span className="muted">{airspaceTypeLabel(f)}</span>
                <span className="tiny muted">
                  {f.lower.display} — {f.upper.display}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
