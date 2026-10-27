import { useCallback, useEffect, useMemo, useState, type WheelEvent } from "react";
import { CATEGORY_STYLES } from "@/lib/colors";
import type { ProfileBand, ProfileSample } from "@/lib/sectionProfile";
import { useAppStore } from "@/store/appStore";

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value / ZOOM_STEP) * ZOOM_STEP));
}

function ProfileChart({
  profile,
  width,
  height,
}: {
  profile: { lengthM: number; samples: ProfileSample[]; bands: ProfileBand[] };
  width: number;
  height: number;
}) {
  const lengthM = Math.max(profile.lengthM, 1);
  const maxFt = Math.max(
    5000,
    ...profile.samples.map((s) => s.terrainFt),
    ...profile.bands.map((b) => b.upperFt),
  );
  const pad = { l: 36, r: 8, t: 8, b: 24 };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="section-profile-svg"
      role="img"
      aria-label="Airspace cross-section profile"
      preserveAspectRatio="xMidYMid meet"
    >
      {profile.samples.map((s, i) => {
        if (i === 0) return null;
        const x1 = pad.l + ((profile.samples[i - 1].distM / lengthM) * (width - pad.l - pad.r));
        const x2 = pad.l + ((s.distM / lengthM) * (width - pad.l - pad.r));
        const y1 = height - pad.b - (profile.samples[i - 1].terrainFt / maxFt) * (height - pad.t - pad.b);
        const y2 = height - pad.b - (s.terrainFt / maxFt) * (height - pad.t - pad.b);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#78716c" strokeWidth={2} />;
      })}
      {profile.bands.map((band) => {
        const x1 = pad.l + (band.distStartM / lengthM) * (width - pad.l - pad.r);
        const x2 = pad.l + (band.distEndM / lengthM) * (width - pad.l - pad.r);
        const yLo = height - pad.b - (band.lowerFt / maxFt) * (height - pad.t - pad.b);
        const yHi = height - pad.b - (band.upperFt / maxFt) * (height - pad.t - pad.b);
        const style = CATEGORY_STYLES[band.category as keyof typeof CATEGORY_STYLES];
        const fill = style?.fill ?? "rgba(56,189,248,0.35)";
        return (
          <rect
            key={`${band.id}-${band.distStartM}`}
            x={x1}
            y={Math.min(yLo, yHi)}
            width={Math.max(2, x2 - x1)}
            height={Math.abs(yHi - yLo)}
            fill={fill}
            stroke={style?.outline ?? "#38bdf8"}
            strokeWidth={0.5}
            opacity={0.75}
          />
        );
      })}
      <text x={pad.l} y={height - 4} fill="#64748b" fontSize={10}>
        0 m
      </text>
      <text x={width - pad.r - 40} y={height - 4} fill="#64748b" fontSize={10}>
        {Math.round(lengthM / 1000)} km
      </text>
      <text x={4} y={pad.t + 10} fill="#64748b" fontSize={10}>
        {Math.round(maxFt / 1000)}k ft
      </text>
    </svg>
  );
}

export function CrossSectionPanel({
  profile,
  onProfileClear,
}: {
  profile: { lengthM: number; samples: ProfileSample[]; bands: ProfileBand[] } | null;
  onProfileClear: () => void;
}) {
  const section = useAppStore((s) => s.mapToolState.section);
  const setMapToolState = useAppStore((s) => s.setMapToolState);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);

  const chartSize = useMemo(() => {
    const baseW = expanded ? 1200 : 720;
    const baseH = expanded ? 320 : 200;
    return {
      width: Math.round(baseW * zoom),
      height: Math.round(baseH * zoom),
    };
  }, [expanded, zoom]);

  const bumpZoom = useCallback((delta: number) => {
    setZoom((z) => clampZoom(z + delta));
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const onChartWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    bumpZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }, [bumpZoom]);

  return (
    <div
      className={
        expanded ? "tool-panel tool-panel-wide section-profile-expanded" : "tool-panel tool-panel-wide"
      }
    >
      <div className="section-profile-head">
        <h3>Section</h3>
        {profile && (
          <span className="section-profile-zoom-label mono small muted">{Math.round(zoom * 100)}%</span>
        )}
      </div>
      <p className="small muted">
        Click two points for a profile. A third click starts a new line. Loaded airspace and terrain only.
      </p>
      <div className="tool-panel-actions section-profile-actions">
        <button
          type="button"
          className="btn"
          disabled={section.length === 0 && !profile}
          onClick={() => {
            setMapToolState((s) => ({ ...s, section: [] }));
            onProfileClear();
            setZoom(1);
            setExpanded(false);
          }}
        >
          Clear
        </button>
        {profile && (
          <>
            <button type="button" className="btn" onClick={() => bumpZoom(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
              Zoom −
            </button>
            <button type="button" className="btn" onClick={() => bumpZoom(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
              Zoom +
            </button>
            <button type="button" className="btn" onClick={() => setZoom(1)} disabled={zoom === 1}>
              Reset
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setExpanded((open) => !open)}
              aria-pressed={expanded}
            >
              {expanded ? "Exit full screen" : "Full screen"}
            </button>
          </>
        )}
      </div>
      {section.length === 1 && <p className="small muted">Choose the second point.</p>}
      {!profile ? (
        section.length === 0 && <p className="small muted">No section line yet.</p>
      ) : (
        <div className="section-profile-chart-wrap" onWheel={onChartWheel}>
          <ProfileChart profile={profile} width={chartSize.width} height={chartSize.height} />
        </div>
      )}
    </div>
  );
}
