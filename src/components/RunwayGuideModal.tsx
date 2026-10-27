import { useEffect, useMemo, useState } from "react";
import type { AirportFeature } from "@/lib/types";
import { nearestAirportWithRunway } from "@/lib/nearestAirport";
import { RunwayLightingDiagram } from "@/components/runway/RunwayLightingDiagram";
import { RunwayMarkingsDiagram } from "@/components/runway/RunwayMarkingsDiagram";
import { RunwayPanZoom } from "@/components/runway/RunwayPanZoom";

function usableRunways(apt: AirportFeature) {
  return apt.runways.filter((r) => r.lengthM && r.lengthM > 0 && r.widthM && r.widthM > 0);
}

export function RunwayGuideModal({
  airports,
  mapLat,
  mapLon,
  onClose,
}: {
  airports: AirportFeature[];
  mapLat: number;
  mapLon: number;
  onClose: () => void;
}) {
  const hit = useMemo(() => nearestAirportWithRunway(airports, mapLat, mapLon), [airports, mapLat, mapLon]);
  const runways = hit ? usableRunways(hit.apt) : [];
  const [rwyIndex, setRwyIndex] = useState(0);
  const rwy = runways[rwyIndex] ?? runways[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    setRwyIndex(0);
  }, [hit?.apt.id]);

  return (
    <div className="runway-guide-fullscreen" role="dialog" aria-labelledby="runway-guide-title" aria-modal="true">
      <button type="button" className="runway-guide-close" aria-label="Close runway guide" onClick={onClose}>
        ×
      </button>

      <header className="runway-guide-header">
        <h1 id="runway-guide-title">Runway markings &amp; lighting</h1>
        <p className="runway-guide-instructions">
          <strong>Drag</strong> to pan each diagram · <strong>Scroll</strong> or <strong>pinch</strong> to zoom ·{" "}
          <strong>Tap</strong> a marking or light to identify it · Use <strong>Reset view</strong> to fit again
        </p>
        <p className="small muted">
          Reference diagrams (ICAO Annex 14 pattern, to scale). Upper panel: day surface markings. Lower panel:
          Wikimedia night lighting colours — tap any light to identify it.
        </p>
      </header>

      <div className="runway-guide-panels">
        <section className="runway-guide-panel" aria-labelledby="runway-markings-heading">
          <h2 id="runway-markings-heading" className="runway-guide-panel-title">
            Runway surface markings (day)
          </h2>
          <RunwayPanZoom ariaLabel="Runway surface markings diagram">
            <RunwayMarkingsDiagram />
          </RunwayPanZoom>
        </section>

        <section className="runway-guide-panel" aria-labelledby="runway-lighting-heading">
          <h2 id="runway-lighting-heading" className="runway-guide-panel-title">
            Runway lighting (night)
          </h2>
          <RunwayPanZoom ariaLabel="Runway lighting diagram">
            <RunwayLightingDiagram />
          </RunwayPanZoom>
        </section>
      </div>

      {hit && rwy && (
        <details className="runway-guide-airport-details small">
          <summary>
            Nearest airport plan — {hit.apt.icao ?? hit.apt.name} ({Math.round(hit.distM / 1000)} km from map centre)
          </summary>
          {runways.length > 1 && (
            <label className="field runway-select">
              <span>Runway</span>
              <select value={rwyIndex} onChange={(e) => setRwyIndex(Number(e.target.value))}>
                {runways.map((r, i) => (
                  <option key={`${r.designator}-${i}`} value={i}>
                    {r.designator}
                    {r.lengthM ? ` · ${Math.round(r.lengthM)} m × ${Math.round(r.widthM ?? 0)} m` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="mono tiny">
            {rwy.designator} · {Math.round(rwy.lengthM ?? 0)} m × {Math.round(rwy.widthM ?? 0)} m · {rwy.surface ?? "surface —"}
          </p>
          <p className="tiny muted">
            OpenAIP dimensions only — use official charts for operations. Pan/zoom the panels above for marking and
            lighting reference.
          </p>
        </details>
      )}

      <p className="runway-guide-credit tiny muted">
        Markings &amp; lighting art:{" "}
        <a href="https://commons.wikimedia.org/wiki/Category:Runway_diagrams" target="_blank" rel="noopener noreferrer">
          Wikimedia Commons
        </a>{" "}
        (ICAO-style reference). Not for navigation.
      </p>
    </div>
  );
}
