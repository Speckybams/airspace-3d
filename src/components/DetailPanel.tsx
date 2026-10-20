import { useEffect, useState } from "react";
import { getIcaoClassDefinition } from "@/lib/icaoClasses";
import type { AirspaceFeature, AirportFeature } from "@/lib/types";
import { useAppStore } from "@/store/appStore";
import { IcaoClassChip } from "./IcaoClassChip";
import { WeatherBlock } from "./WeatherBlock";

interface Props {
  airspaces: AirspaceFeature[];
  airports: AirportFeature[];
  mapLat: number;
  mapLon: number;
}

const SLIDE_MS = 320;

export function DetailPanel({ airspaces, airports, mapLat, mapLon }: Props) {
  const selected = useAppStore((s) => s.selectedAirspace);
  const setSelectedAirspace = useAppStore((s) => s.setSelectedAirspace);
  const setSelectedAirspaceId = useAppStore((s) => s.setSelectedAirspaceId);
  const openClassLegend = useAppStore((s) => s.openClassLegend);
  const [rendered, setRendered] = useState(selected);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      setRendered(selected);
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setOpen(false);
    const timeout = window.setTimeout(() => setRendered(null), SLIDE_MS + 40);
    return () => window.clearTimeout(timeout);
  }, [selected]);

  if (!rendered) return null;

  const overlaps = airspaces
    .filter((a) => a.id !== rendered.id && a.category === rendered.category)
    .slice(0, 6);

  const blurb = getIcaoClassDefinition(rendered.icaoClass).blurb;

  return (
    <aside className={open ? "detail-panel open" : "detail-panel"}>
      <button
        type="button"
        className="detail-close"
        aria-label="Dismiss airspace"
        onClick={() => {
          setSelectedAirspace(null);
          setSelectedAirspaceId(null);
        }}
      >
        ×
      </button>
      <div className="chip">{rendered.category.toUpperCase()}</div>
      <h2>{rendered.name}</h2>
      <p className="mono limits">
        <span className="limits-alt">
          {rendered.lower.display} → {rendered.upper.display}
        </span>
        <span className="limits-sep" aria-hidden>
          {" · "}
        </span>
        <IcaoClassChip
          icaoClass={rendered.icaoClass}
          onClick={() => openClassLegend(rendered.icaoClass)}
        />
      </p>
      <div className="stack-diagram" aria-hidden>
        {[rendered, ...overlaps].slice(0, 4).map((a) => (
          <div key={a.id} className="stack-row" title={a.name}>
            <span>{a.name.slice(0, 18)}</span>
            <span className="mono muted">{a.upper.display}</span>
          </div>
        ))}
      </div>
      {rendered.frequencies.length > 0 && (
        <div>
          <h3>Frequencies</h3>
          <ul className="freq-list">
            {rendered.frequencies.map((f) => (
              <li key={f.value + (f.name ?? "")} className="mono">
                {f.value} {f.name && <span className="muted">{f.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {rendered.remarks && <p className="small muted">{rendered.remarks}</p>}
      <p className="small">{blurb} (General guidance only.)</p>
      <WeatherBlock airports={airports} nearLat={mapLat} nearLon={mapLon} />
      <p className="muted tiny">Source: {rendered.source} · OpenAIP CC BY-NC</p>
    </aside>
  );
}
