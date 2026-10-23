import { CATEGORY_STYLES } from "@/lib/colors";
import type { ProfileBand, ProfileSample } from "@/lib/sectionProfile";
import { useAppStore } from "@/store/appStore";

export function CrossSectionPanel({
  profile,
}: {
  profile: { lengthM: number; samples: ProfileSample[]; bands: ProfileBand[] } | null;
}) {
  const section = useAppStore((s) => s.mapToolState.section);
  const setMapToolState = useAppStore((s) => s.setMapToolState);

  const maxFt = profile
    ? Math.max(
        5000,
        ...profile.samples.map((s) => s.terrainFt),
        ...profile.bands.map((b) => b.upperFt),
      )
    : 5000;

  const width = 640;
  const height = 160;
  const pad = { l: 36, r: 8, t: 8, b: 24 };

  return (
    <div className="tool-panel tool-panel-wide">
      <h3>Section</h3>
      <p className="small muted">
        Click two points for a profile. A third click starts a new line. Loaded airspace and terrain only.
      </p>
      <div className="tool-panel-actions">
        <button
          type="button"
          className="btn"
          disabled={section.length === 0}
          onClick={() => setMapToolState((s) => ({ ...s, section: [] }))}
        >
          Clear
        </button>
      </div>
      {section.length === 1 && <p className="small muted">Choose the second point.</p>}
      {!profile ? (
        section.length === 0 && <p className="small muted">No section line yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="section-profile-svg"
          role="img"
          aria-label="Airspace cross-section profile"
        >
          {profile.samples.map((s, i) => {
            if (i === 0) return null;
            const x1 =
              pad.l + ((profile.samples[i - 1].distM / profile.lengthM) * (width - pad.l - pad.r));
            const x2 = pad.l + ((s.distM / profile.lengthM) * (width - pad.l - pad.r));
            const y1 = height - pad.b - (profile.samples[i - 1].terrainFt / maxFt) * (height - pad.t - pad.b);
            const y2 = height - pad.b - (s.terrainFt / maxFt) * (height - pad.t - pad.b);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#78716c" strokeWidth={2} />;
          })}
          {profile.bands.map((band) => {
            const x1 = pad.l + (band.distStartM / profile.lengthM) * (width - pad.l - pad.r);
            const x2 = pad.l + (band.distEndM / profile.lengthM) * (width - pad.l - pad.r);
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
            {Math.round(profile.lengthM / 1000)} km
          </text>
          <text x={4} y={pad.t + 10} fill="#64748b" fontSize={10}>
            {Math.round(maxFt / 1000)}k ft
          </text>
        </svg>
      )}
    </div>
  );
}
