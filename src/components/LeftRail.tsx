import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_HINTS, CATEGORY_STYLES } from "@/lib/colors";
import type { AirspaceCategory, BasemapId } from "@/lib/types";
import { useAppStore } from "@/store/appStore";

const HINT_DELAY_MS = 1000;

const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: "chart", label: "CHART" },
  { id: "satellite", label: "SAT" },
];

const FILTER_GROUPS: { title: string; ids: (keyof typeof CATEGORY_STYLES)[] }[] = [
  { title: "REGULAR AIRSPACE", ids: ["airway", "tma", "cta", "ctr", "atz"] },
  { title: "HAZARD", ids: ["danger", "restricted", "prohibited", "frz"] },
  { title: "ZONES", ids: ["rmz", "tmz", "matz"] },
  { title: "ACTIVITY", ids: ["glider"] },
  { title: "OTHER", ids: ["other"] },
];

export function LeftRail() {
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const categoryVisible = useAppStore((s) => s.categoryVisible);
  const toggleCategory = useAppStore((s) => s.toggleCategory);
  const hideAllCategories = useAppStore((s) => s.hideAllCategories);
  const showAllCategories = useAppStore((s) => s.showAllCategories);
  const allHidden = Object.values(categoryVisible).every((visible) => visible === false);
  const altBandFt = useAppStore((s) => s.altBandFt);
  const setAltBandFt = useAppStore((s) => s.setAltBandFt);
  const terrainExaggeration = useAppStore((s) => s.terrainExaggeration);
  const setTerrainExaggeration = useAppStore((s) => s.setTerrainExaggeration);
  const chartTopDown = useAppStore((s) => s.chartTopDown);
  const setChartTopDown = useAppStore((s) => s.setChartTopDown);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hint, setHint] = useState<AirspaceCategory | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintPoint, setHintPoint] = useState<{ x: number; y: number } | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintFade = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintAnchor = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      if (hintFade.current) clearTimeout(hintFade.current);
    };
  }, []);

  const clearHintTimer = () => {
    if (!hintTimer.current) return;
    clearTimeout(hintTimer.current);
    hintTimer.current = null;
  };

  const placeHint = (category: AirspaceCategory) => {
    const row = hintAnchor.current;
    const label = row?.querySelector(".category-label");
    if (!(label instanceof HTMLElement)) return;
    const rect = label.getBoundingClientRect();
    setHintPoint({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    setHint(category);
    setHintVisible(false);
    hintFade.current = setTimeout(() => setHintVisible(true), 20);
  };

  const scheduleHint = (category: AirspaceCategory, row: HTMLElement) => {
    clearHintTimer();
    if (hintFade.current) clearTimeout(hintFade.current);
    hintAnchor.current = row;
    setHintVisible(false);
    setHint(null);
    setHintPoint(null);
    hintTimer.current = setTimeout(() => placeHint(category), HINT_DELAY_MS);
  };

  const dismissHint = () => {
    clearHintTimer();
    hintAnchor.current = null;
    setHintVisible(false);
    setHintPoint(null);
    if (hintFade.current) clearTimeout(hintFade.current);
    hintFade.current = setTimeout(() => setHint(null), 180);
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => dismissHint();
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => rail.removeEventListener("scroll", onScroll);
  }, []);

  const hintPopover =
    hint && hintPoint
      ? createPortal(
          <div
            className={hintVisible ? "category-hint-popover on" : "category-hint-popover"}
            style={{ left: hintPoint.x, top: hintPoint.y }}
            role="tooltip"
          >
            {CATEGORY_HINTS[hint]}
          </div>,
          document.body,
        )
      : null;

  return (
    <aside className={filtersOpen ? "left-rail filters-open" : "left-rail"} ref={railRef}>
      <button
        type="button"
        className="rail-toggle"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((open) => !open)}
      >
        {filtersOpen ? "Hide filters" : "Filters"}
      </button>
      <section>
        <h3>Map</h3>
        <div className="btn-group">
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={basemap === b.id ? "btn active" : "btn"}
              onClick={() => setBasemap(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>ALT SLICE MIN · {altBandFt[0].toLocaleString("en-GB")} FT</span>
          <input
            type="range"
            min={0}
            max={40000}
            step={500}
            value={altBandFt[0]}
            onChange={(e) => {
              const next = Number(e.target.value);
              setAltBandFt([next, Math.max(altBandFt[1], next + 500)]);
            }}
          />
        </label>
        <label className="field">
          <span>ALT SLICE MAX · {altBandFt[1].toLocaleString("en-GB")} FT</span>
          <input
            type="range"
            min={1000}
            max={66000}
            step={1000}
            value={altBandFt[1]}
            onChange={(e) => {
              const next = Number(e.target.value);
              setAltBandFt([Math.min(altBandFt[0], next - 500), next]);
            }}
          />
        </label>
        <label className="field">
          <span>TOPOGRAPHICAL FACTOR · {terrainExaggeration}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.25}
            value={terrainExaggeration}
            onChange={(e) => setTerrainExaggeration(Number(e.target.value))}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={chartTopDown} onChange={(e) => setChartTopDown(e.target.checked)} />
          View chart top-down
        </label>
      </section>
      <section>
        <div className="section-head">
          <h3>Filters</h3>
          <button
            type="button"
            className="text-btn"
            onClick={allHidden ? showAllCategories : hideAllCategories}
          >
            {allHidden ? "SELECT ALL" : "DESELECT ALL"}
          </button>
        </div>
        {FILTER_GROUPS.map((group) => (
          <div key={group.title} className="filter-group">
            <h4>{group.title}</h4>
            <ul className="category-list">
              {group.ids.map((c) => (
                <li key={c}>
                  <label
                    onMouseEnter={(event) => scheduleHint(c, event.currentTarget)}
                    onMouseLeave={dismissHint}
                    onFocus={(event) => scheduleHint(c, event.currentTarget)}
                    onBlur={dismissHint}
                  >
                    <input
                      type="checkbox"
                      checked={categoryVisible[c] !== false}
                      onChange={() => toggleCategory(c)}
                    />
                    <span className="swatch" style={{ background: CATEGORY_STYLES[c].outline }} />
                    <span className="category-label">{c.toUpperCase()}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {hintPopover}
    </aside>
  );
}
