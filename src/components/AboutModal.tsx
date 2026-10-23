import { useEffect } from "react";
import type { UkDataMeta } from "@/lib/types";

interface Props {
  meta: UkDataMeta | null;
  onClose: () => void;
}

export function AboutModal({ meta, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const region = meta?.countryName ?? "United Kingdom";
  const built = meta?.builtAt?.slice(0, 10) ?? "—";
  const source = meta?.sourceDate?.slice(0, 10) ?? "—";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal about-modal">
        <h2 id="about-title">Airspace 3D</h2>
        <p className="about-brand muted">
          Voluspace ·{" "}
          <a href="https://voluspace.com/" target="_blank" rel="noopener noreferrer">
            voluspace.com
          </a>
        </p>
        <p className="about-lead">
          3D airspace visualiser for understanding only — not for flight planning, navigation, or drone
          operations.
        </p>
        <p className="muted">
          Always use official national AIP publications before flying. Regional coverage expands over time; current
          dataset: {region}.
        </p>

        <h3 className="about-heading">Map controls</h3>
        <ul className="about-list">
          <li>Left drag, or one finger — pan</li>
          <li>Right drag — orbit and tilt</li>
          <li>Two fingers — pinch to zoom, drag up or down to tilt, twist to rotate</li>
          <li>Wheel — zoom toward cursor</li>
          <li>Click — select airspace (detail panel + highlight)</li>
          <li>Double-click — fly to selected volume</li>
          <li>Alt + click or hover — pick topmost stacked volume</li>
          <li>Default click — smallest zone under the cursor when volumes overlap</li>
        </ul>

        <h3 className="about-heading">Data</h3>
        <p className="muted about-meta">
          Build {built} · OpenAIP source {source}
          {meta ? ` · ${meta.airspaceCount.toLocaleString()} volumes · ${meta.airportCount.toLocaleString()} airfields` : null}
        </p>

        <h3 className="about-heading">Credits</h3>
        <p className="muted">
          OpenAIP · Ordnance Survey · OpenStreetMap · Cesium · Starling Industries. See repository{" "}
          <code>LICENSING.md</code> for terms.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
