import { useEffect, useRef, useState } from "react";
import { lightInfoForSvgElement, wireRunwayLightingSvg, type RunwayLightInfo } from "@/components/runway/runwayLightInfo";

const LIGHTING_SRC = "/reference/runway-lighting-night.svg";

/** Wikimedia night runway lighting diagram — vector, tap lights to identify. */
export function RunwayLightingDiagram() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<RunwayLightInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unwired: (() => void) | undefined;
    const host = hostRef.current;
    if (!host) return;

    void (async () => {
      const res = await fetch(LIGHTING_SRC);
      const text = await res.text();
      if (cancelled || !hostRef.current) return;

      host.innerHTML = text;
      const svg = host.querySelector("svg");
      if (!svg) return;

      svg.classList.add("runway-lighting-svg", "runway-reference-inline");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Runway lighting at night — ICAO reference diagram");

      unwired = wireRunwayLightingSvg(svg, (info) => {
        setActive(info);
      });

      host.setAttribute("aria-busy", "false");
    })();

    return () => {
      cancelled = true;
      unwired?.();
    };
  }, []);

  const onHostClick = (event: React.MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest(".runway-light-hit")) setActive(null);
  };

  return (
    <div className="runway-lighting-diagram" onClick={onHostClick}>
      {active && (
        <div className="runway-light-callout" role="status">
          <strong>{active.label}</strong>
          <span>{active.detail}</span>
        </div>
      )}
      <div className="runway-reference-host runway-reference-host--lighting" ref={hostRef} aria-busy="true">
        <p className="tiny muted">Loading ICAO lighting diagram…</p>
      </div>
    </div>
  );
}

// re-export for tests
export { lightInfoForSvgElement };
