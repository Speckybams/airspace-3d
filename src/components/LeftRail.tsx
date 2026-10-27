import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_HINTS, CATEGORY_STYLES, NA_CLASS_HINTS, NA_CLASS_STYLES } from "@/lib/colors";
import { NA_CLASS_LETTERS, type FilterRegion } from "@/lib/filterRegion";
import type { AirspaceCategory, BasemapId } from "@/lib/types";
import { ToolsMenu } from "@/components/TopBar";
import { useAppStore } from "@/store/appStore";

const HINT_DELAY_MS = 1000;

const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: "chart", label: "CHART" },
  { id: "dark", label: "DARK" },
  { id: "satellite", label: "SAT" },
];

interface FilterRow {
  key: string;
  label: string;
  hint: string;
  swatch: string;
  checked: boolean;
  toggle: () => void;
}

function filterGroups(
  region: FilterRegion,
  categoryVisible: Record<string, boolean>,
  classVisible: Record<string, boolean>,
  toggleCategory: (id: string) => void,
  toggleClass: (letter: string) => void,
): { title: string; rows: FilterRow[] }[] {
  const category = (id: AirspaceCategory): FilterRow => ({
    key: id,
    label: id.toUpperCase(),
    hint: CATEGORY_HINTS[id],
    swatch: CATEGORY_STYLES[id].outline,
    checked: categoryVisible[id] !== false,
    toggle: () => toggleCategory(id),
  });
  const klass = (letter: string): FilterRow => ({
    key: `class-${letter}`,
    label: `CLASS ${letter}`,
    hint: NA_CLASS_HINTS[letter],
    swatch: NA_CLASS_STYLES[letter].outline,
    checked: classVisible[letter] !== false,
    toggle: () => toggleClass(letter),
  });

  const controlled =
    region === "na"
      ? NA_CLASS_LETTERS.map(klass)
      : (["tma", "cta", "ctr", "atz"] as AirspaceCategory[]).map(category);

  const hazard: AirspaceCategory[] = ["danger", "restricted", "prohibited"];
  if (region === "uk") hazard.push("frz");
  if (region === "na") hazard.push("moa", "alert", "warning");

  const zones: AirspaceCategory[] = ["rmz", "tmz"];
  if (region === "uk") zones.push("matz");

  return [
    { title: "REGULAR AIRSPACE", rows: [category("airway"), ...controlled] },
    { title: "HAZARD", rows: hazard.map(category) },
    { title: "ZONES", rows: zones.map(category) },
    { title: "ACTIVITY", rows: [category("glider")] },
    { title: "OTHER", rows: [category("other")] },
  ];
}

export function LeftRail() {
  const basemap = useAppStore((s) => s.basemap);
  const setBasemap = useAppStore((s) => s.setBasemap);
  const categoryVisible = useAppStore((s) => s.categoryVisible);
  const classVisible = useAppStore((s) => s.classVisible);
  const viewRegion = useAppStore((s) => s.viewRegion);
  const toggleCategory = useAppStore((s) => s.toggleCategory);
  const toggleClass = useAppStore((s) => s.toggleClass);
  const hideAllCategories = useAppStore((s) => s.hideAllCategories);
  const showAllCategories = useAppStore((s) => s.showAllCategories);
  const groups = filterGroups(viewRegion, categoryVisible, classVisible, toggleCategory, toggleClass);
  const allHidden = groups.every((group) => group.rows.every((row) => !row.checked));
  const altBandFt = useAppStore((s) => s.altBandFt);
  const setAltBandFt = useAppStore((s) => s.setAltBandFt);
  const terrainExaggeration = useAppStore((s) => s.terrainExaggeration);
  const setTerrainExaggeration = useAppStore((s) => s.setTerrainExaggeration);
  const chartTopDown = useAppStore((s) => s.chartTopDown);
  const setChartTopDown = useAppStore((s) => s.setChartTopDown);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
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

  const placeHint = (hintId: string) => {
    const row = hintAnchor.current;
    const label = row?.querySelector(".category-label");
    if (!(label instanceof HTMLElement)) return;
    const rect = label.getBoundingClientRect();
    setHintPoint({ x: rect.right + 8, y: rect.top + rect.height / 2 });
    setHint(hintId);
    setHintVisible(false);
    hintFade.current = setTimeout(() => setHintVisible(true), 20);
  };

  const scheduleHint = (hintId: string, row: HTMLElement) => {
    clearHintTimer();
    if (hintFade.current) clearTimeout(hintFade.current);
    hintAnchor.current = row;
    setHintVisible(false);
    setHint(null);
    setHintPoint(null);
    hintTimer.current = setTimeout(() => placeHint(hintId), HINT_DELAY_MS);
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
            {hint}
          </div>,
          document.body,
        )
      : null;

  return (
    <aside
      id="left-rail-filters"
      className={filtersOpen ? "left-rail filters-open" : "left-rail"}
      ref={railRef}
    >
      <div className="left-rail-header">
        <button
          type="button"
          className={filtersOpen ? "rail-toggle active" : "rail-toggle"}
          aria-expanded={filtersOpen}
          aria-haspopup="true"
          aria-controls="left-rail-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span className="rail-toggle-inner">
            <span className="rail-toggle-label">{filtersOpen ? "Hide filters" : "Filters"}</span>
            <span className="rail-toggle-chevron" aria-hidden="true" />
          </span>
        </button>
        <ToolsMenu placement="rail" />
      </div>
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
        <div className="filter-groups">
          {groups.map((group) => (
            <div key={group.title} className="filter-group">
              <h4>{group.title}</h4>
              <ul className="category-list">
                {group.rows.map((row) => (
                  <li key={row.key}>
                    <label
                      onMouseEnter={(event) => scheduleHint(row.hint, event.currentTarget)}
                      onMouseLeave={dismissHint}
                      onFocus={(event) => scheduleHint(row.hint, event.currentTarget)}
                      onBlur={dismissHint}
                    >
                      <input type="checkbox" checked={row.checked} onChange={row.toggle} />
                      <span className="swatch" style={{ background: row.swatch }} />
                      <span className="category-label">{row.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section>
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
      {hintPopover}
    </aside>
  );
}
