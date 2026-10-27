import { useEffect, useState } from "react";
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
  const [altInput, setAltInput] = useState(() => String(queryAltFt));

  useEffect(() => {
    setAltInput(String(queryAltFt));
  }, [queryAltFt]);

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
      <h3>Query altitude</h3>
      <p className="small muted">
        Click on the map, then enter an altitude. It will tell you what airspace is there.
      </p>
      <label className="field field-input-first">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="mono"
          value={altInput}
          onChange={(e) => {
            const next = e.target.value;
            if (next !== "" && !/^\d+$/.test(next)) return;
            setAltInput(next);
            if (next !== "") setQueryAltFt(Number(next));
          }}
          onBlur={() => {
            if (altInput === "") {
              setAltInput("0");
              setQueryAltFt(0);
            }
          }}
        />
        <span>Altitude (ft AMSL at terrain + value)</span>
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
