import { airspaceTypeLabel } from "@/lib/filterRegion";
import { airspacesAlongSegment } from "@/lib/airspaceAlongLine";
import { measureLeg, sumMeasureLegs } from "@/lib/mapMeasure";
import type { AirspaceFeature } from "@/lib/types";
import { useAppStore } from "@/store/appStore";

export function RouteToolPanel({ airspaces }: { airspaces: AirspaceFeature[] }) {
  const route = useAppStore((s) => s.mapToolState.route);
  const setMapToolState = useAppStore((s) => s.setMapToolState);

  const legs = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    legs.push({
      ...measureLeg(a.lon, a.lat, b.lon, b.lat),
      fromLabel: a.label,
      toLabel: b.label,
      crossed: airspacesAlongSegment(airspaces, a.lon, a.lat, b.lon, b.lat),
    });
  }
  const total = sumMeasureLegs(legs);

  return (
    <div className="tool-panel">
      <h3>Route</h3>
      <p className="small muted">
        Clicks within about 2 km of an airport snap to that aerodrome. Airspace list covers loaded cells only.
      </p>
      <div className="tool-panel-actions">
        <button
          type="button"
          className="btn"
          disabled={route.length === 0}
          onClick={() =>
            setMapToolState((s) => ({
              ...s,
              route: s.route.slice(0, -1),
            }))
          }
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          disabled={route.length === 0}
          onClick={() => setMapToolState((s) => ({ ...s, route: [] }))}
        >
          Clear
        </button>
      </div>
      {route.length === 0 ? (
        <p className="small muted">Add waypoints on the map.</p>
      ) : (
        <ol className="tool-route-list small">
          {route.map((wp, i) => (
            <li key={i}>
              {wp.label ?? `${wp.lat.toFixed(4)}°N ${wp.lon.toFixed(4)}°E`}
            </li>
          ))}
        </ol>
      )}
      {legs.map((leg, i) => (
        <div key={i} className="tool-route-leg">
          <p className="small mono">
            Leg {i + 1}: {leg.nm.toFixed(2)} NM · {Math.round(leg.bearingDeg)}°
          </p>
          {leg.crossed.length > 0 ? (
            <ul className="tool-hit-list compact">
              {leg.crossed.slice(0, 12).map((f) => (
                <li key={f.id}>
                  <span className="mono">{f.name}</span>
                  <span className="muted">{airspaceTypeLabel(f)}</span>
                </li>
              ))}
              {leg.crossed.length > 12 && (
                <li className="muted tiny">+{leg.crossed.length - 12} more</li>
              )}
            </ul>
          ) : (
            <p className="tiny muted">No loaded airspace along this leg.</p>
          )}
        </div>
      ))}
      {legs.length > 1 && (
        <p className="small mono">
          Route total: {total.nm.toFixed(2)} NM · {total.km.toFixed(2)} km
        </p>
      )}
    </div>
  );
}
