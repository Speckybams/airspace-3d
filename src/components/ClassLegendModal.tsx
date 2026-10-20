import { useEffect } from "react";
import { CATEGORY_HINTS, CATEGORY_STYLES } from "@/lib/colors";
import {
  getIcaoClassDefinition,
  ICAO_AIRSPACE_CLASS_IDS,
  ICAO_CLASS_DEFINITIONS,
  normalizeIcaoClass,
  type IcaoAirspaceClass,
} from "@/lib/icaoClasses";
import type { AirspaceCategory, AirspaceFeature } from "@/lib/types";

const CATEGORY_ORDER: AirspaceCategory[] = [
  "airway",
  "tma",
  "cta",
  "ctr",
  "atz",
  "danger",
  "restricted",
  "prohibited",
  "frz",
  "rmz",
  "tmz",
  "matz",
  "glider",
  "other",
];

export interface CountryContext {
  code: string;
  name: string;
}

interface Props {
  icaoClass: string;
  airspaces: AirspaceFeature[];
  country: CountryContext;
  onClose: () => void;
}

function categoriesInCountry(airspaces: AirspaceFeature[]): AirspaceCategory[] {
  const present = new Set(airspaces.map((a) => a.category));
  return CATEGORY_ORDER.filter((c) => present.has(c));
}

function classesUsedByCategory(
  airspaces: AirspaceFeature[],
  category: AirspaceCategory,
): IcaoAirspaceClass[] {
  const set = new Set<IcaoAirspaceClass>();
  for (const a of airspaces) {
    if (a.category === category) set.add(normalizeIcaoClass(a.icaoClass));
  }
  return ICAO_AIRSPACE_CLASS_IDS.filter((id) => set.has(id));
}

export function ClassLegendModal({ icaoClass, airspaces, country, onClose }: Props) {
  const focus = normalizeIcaoClass(icaoClass);
  const focusDef = getIcaoClassDefinition(focus);
  const categories = categoriesInCountry(airspaces);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop class-legend-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-legend-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal class-legend-modal">
        <button type="button" className="class-legend-close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
        <div className="class-legend-head">
          <span
            className="icao-class-chip"
            style={{ color: focusDef.color, background: focusDef.background, borderColor: focusDef.color }}
          >
            {focusDef.title}
          </span>
          <h2 id="class-legend-title">{focusDef.title}</h2>
        </div>
        <p className="class-legend-blurb">{focusDef.blurb}</p>
        <p className="muted small class-legend-region">
          Published types in {country.name} ({country.code})
        </p>
        <ul className="class-legend-types">
          {categories.map((category) => {
            const style = CATEGORY_STYLES[category];
            const classes = classesUsedByCategory(airspaces, category);
            const count = airspaces.filter((a) => a.category === category).length;
            return (
              <li key={category}>
                <span className="class-legend-swatch" style={{ background: style.outline }} />
                <div className="class-legend-type-body">
                  <div className="class-legend-type-row">
                    <span className="class-legend-type-name">{category.toUpperCase()}</span>
                    <span className="muted mono tiny">{count.toLocaleString("en-GB")}</span>
                  </div>
                  <p className="class-legend-type-hint">{CATEGORY_HINTS[category]}</p>
                  <div className="class-legend-class-tags">
                    {classes.map((id) => (
                      <span
                        key={id}
                        className={id === focus ? "icao-class-tag active" : "icao-class-tag"}
                        style={
                          id === focus
                            ? {
                                color: ICAO_CLASS_DEFINITIONS[id].color,
                                borderColor: ICAO_CLASS_DEFINITIONS[id].color,
                                background: ICAO_CLASS_DEFINITIONS[id].background,
                              }
                            : undefined
                        }
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <section className="class-legend-icao-section">
          <h3>ICAO classes</h3>
          <ul className="class-legend-icao-grid">
            {ICAO_AIRSPACE_CLASS_IDS.map((id) => {
              const def = ICAO_CLASS_DEFINITIONS[id];
              return (
                <li key={id}>
                  <span
                    className="icao-class-chip compact"
                    style={{ color: def.color, background: def.background, borderColor: def.color }}
                  >
                    {id}
                  </span>
                  <span className="class-legend-icao-blurb">{def.blurb}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <p className="muted tiny">General guidance only. Use official AIP publications for navigation.</p>
      </div>
    </div>
  );
}
