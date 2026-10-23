import { measureLeg, sumMeasureLegs } from "@/lib/mapMeasure";
import { useAppStore } from "@/store/appStore";

export function MeasureToolPanel() {
  const points = useAppStore((s) => s.mapToolState.measure);
  const setMapToolState = useAppStore((s) => s.setMapToolState);

  const legs = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    legs.push(measureLeg(a.lon, a.lat, b.lon, b.lat));
  }
  const total = sumMeasureLegs(legs);

  return (
    <div className="tool-panel">
      <h3>Measure</h3>
      <p className="small muted">Each click adds a point. Distances use geodesic metres along the ground.</p>
      <div className="tool-panel-actions">
        <button
          type="button"
          className="btn"
          disabled={points.length === 0}
          onClick={() =>
            setMapToolState((s) => ({
              ...s,
              measure: s.measure.slice(0, -1),
            }))
          }
        >
          Undo
        </button>
        <button
          type="button"
          className="btn"
          disabled={points.length === 0}
          onClick={() => setMapToolState((s) => ({ ...s, measure: [] }))}
        >
          Clear
        </button>
      </div>
      {points.length === 0 ? (
        <p className="small muted">No points yet.</p>
      ) : (
        <>
          <ul className="tool-measure-legs small mono">
            {legs.map((leg, i) => (
              <li key={i}>
                Leg {i + 1}: {leg.nm.toFixed(2)} NM · {leg.km.toFixed(2)} km · {Math.round(leg.bearingDeg)}°
              </li>
            ))}
          </ul>
          {legs.length > 1 && (
            <p className="small mono">
              Total: {total.nm.toFixed(2)} NM · {total.km.toFixed(2)} km
            </p>
          )}
          {legs.length === 1 && (
            <p className="small muted">Initial bearing {Math.round(legs[0].bearingDeg)}° from first point.</p>
          )}
        </>
      )}
    </div>
  );
}
