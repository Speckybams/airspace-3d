import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchEntry, ToolMode } from "@/lib/types";
import { useAppStore } from "@/store/appStore";

const TOOLS: { id: ToolMode; label: string }[] = [
  { id: "navigate", label: "NAVIGATE" },
  { id: "query", label: "QUERY" },
  { id: "measure", label: "MEASURE" },
  { id: "crossSection", label: "SECTION" },
  { id: "route", label: "ROUTE" },
];

const RECENT_KEY = "airspace3d-recents";
const LEGACY_RECENT_KEY = "voluspace-recents";

const SUGGESTED: { kind: SearchEntry["kind"]; match: (entry: SearchEntry) => boolean }[] = [
  { kind: "airport", match: (entry) => entry.label.startsWith("EGLL") },
  { kind: "airport", match: (entry) => entry.label.startsWith("EGKK") },
  { kind: "airport", match: (entry) => entry.label.startsWith("KJFK") },
  { kind: "airport", match: (entry) => entry.label.startsWith("LFPG") },
  { kind: "airport", match: (entry) => entry.label.startsWith("EDDF") },
  { kind: "airport", match: (entry) => entry.label.startsWith("EHAM") },
  { kind: "airport", match: (entry) => entry.label.startsWith("CYYZ") },
  { kind: "place", match: (entry) => entry.id === "london" },
  { kind: "place", match: (entry) => entry.id === "paris" },
  { kind: "place", match: (entry) => entry.id === "new-york" },
];

function loadRecents(): SearchEntry[] {
  try {
    const stored =
      localStorage.getItem(RECENT_KEY) ?? localStorage.getItem(LEGACY_RECENT_KEY) ?? "[]";
    const raw = JSON.parse(stored) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(isSearchEntry).slice(0, 6);
  } catch {
    return [];
  }
}

function isSearchEntry(value: unknown): value is SearchEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as SearchEntry;
  return (
    typeof entry.id === "string" &&
    (entry.kind === "airspace" || entry.kind === "airport" || entry.kind === "place") &&
    typeof entry.label === "string" &&
    typeof entry.lon === "number" &&
    typeof entry.lat === "number"
  );
}

export function TopBar({
  searchIndex,
  onSelect,
}: {
  searchIndex: SearchEntry[];
  onSelect: (entry: SearchEntry) => void;
}) {
  const [q, setQ] = useState("");
  const [utc, setUtc] = useState("");
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<SearchEntry[]>(loadRecents);

  useEffect(() => {
    const tick = () => setUtc(new Date().toISOString().slice(11, 19) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        document.getElementById("vs-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (term.length < 2) return [];
    return searchIndex.filter((entry) => entry.label.toLowerCase().includes(term)).slice(0, 12);
  }, [term, searchIndex]);

  const suggested = useMemo(() => {
    const recentKeys = new Set(recents.map((entry) => `${entry.kind}:${entry.id}`));
    const picked: SearchEntry[] = [];
    for (const hint of SUGGESTED) {
      const found = searchIndex.find((entry) => entry.kind === hint.kind && hint.match(entry));
      if (!found || recentKeys.has(`${found.kind}:${found.id}`)) continue;
      if (term && !found.label.toLowerCase().includes(term)) continue;
      picked.push(found);
    }
    return picked;
  }, [searchIndex, recents, term]);

  const visibleRecents = term
    ? recents.filter((entry) => entry.label.toLowerCase().includes(term))
    : recents;

  const choose = (entry: SearchEntry) => {
    const next = [entry, ...recents.filter((item) => item.id !== entry.id || item.kind !== entry.kind)].slice(0, 6);
    setRecents(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setQ("");
    setOpen(false);
    document.getElementById("vs-search")?.blur();
    onSelect(entry);
  };

  const showIdle = open && term.length < 2;
  const showList = open && (results.length > 0 || (showIdle && (visibleRecents.length > 0 || suggested.length > 0)));

  return (
    <header className="top-bar">
      <div className="brand-cluster">
        <div className="brand-lockup">
          <img className="brand-wordmark" src="/brand/voluspace.png?v=4" alt="Airspace 3D" />
          <div className="brand-tag">3D AIRSPACE VISUALISER</div>
        </div>
        <div className="utc-box mono">{utc}</div>
      </div>
      <div className="top-controls">
      <div className="search-wrap">
        <input
          id="vs-search"
          className="search-input"
          placeholder="Search airspace, ICAO, place ( / )"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onMouseDown={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
        />
        {showList && (
          <ul className="search-results" onMouseDown={(e) => e.preventDefault()}>
            {term.length >= 2
              ? results.map((entry) => <Result key={`${entry.kind}-${entry.id}`} entry={entry} onChoose={choose} />)
              : (
                <>
                  {visibleRecents.length > 0 && (
                    <>
                      <li className="search-heading">Recents</li>
                      {visibleRecents.map((entry) => (
                        <Result key={`recent-${entry.kind}-${entry.id}`} entry={entry} onChoose={choose} />
                      ))}
                    </>
                  )}
                  {suggested.length > 0 && (
                    <>
                      <li className="search-heading">Suggested</li>
                      {suggested.map((entry) => (
                        <Result key={`suggested-${entry.kind}-${entry.id}`} entry={entry} onChoose={choose} />
                      ))}
                    </>
                  )}
                </>
              )}
          </ul>
        )}
      </div>
      <ToolsMenu />
      <RunwayGuideButton />
      </div>
      <div className="brand-by">
        <span>BY</span>
        <img src="/brand/starling.png" alt="Starling Industries" />
      </div>
    </header>
  );
}

function RunwayGuideButton() {
  const openRunwayGuide = useAppStore((s) => s.openRunwayGuide);
  return (
    <button type="button" className="btn runway-guide-btn" onClick={() => openRunwayGuide()}>
      RUNWAY
    </button>
  );
}

function ToolsMenu() {
  const tool = useAppStore((s) => s.tool);
  const setTool = useAppStore((s) => s.setTool);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = TOOLS.find((item) => item.id === tool) ?? TOOLS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="tools-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? "btn tools-tab active" : "btn tools-tab"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="tools-kicker">Tools</span>
        <span className="tools-current">{current.label}</span>
      </button>
      {open && (
        <div className="tools-panel" role="menu">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={tool === item.id}
              className={tool === item.id ? "btn active" : "btn"}
              onClick={() => {
                setTool(item.id);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Result({ entry, onChoose }: { entry: SearchEntry; onChoose: (entry: SearchEntry) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onChoose(entry)}>
        <span className="mono">{entry.label}</span>
        <span className="muted">{entry.sub}</span>
      </button>
    </li>
  );
}
