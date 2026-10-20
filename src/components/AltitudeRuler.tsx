import { formatFeet, formatFl } from "@/lib/units";
import { useAppStore } from "@/store/appStore";

const CEILING_FT = 66_000;
const TICKS_FT = [10_000, 20_000, 30_000, 40_000, 50_000];

function formatCutoff(ft: number): string {
  if (ft <= 0) return "SFC";
  if (ft >= CEILING_FT) return "FL660";
  if (ft >= 10_000) return formatFl(ft / 100);
  return formatFeet(ft);
}

export function AltitudeRuler() {
  const [low, high] = useAppStore((s) => s.altBandFt);
  const lowPct = (low / CEILING_FT) * 100;
  const highPct = (high / CEILING_FT) * 100;
  const split = high - low >= 14_000;

  const highAtTop = highPct >= 99.5;

  return (
    <div
      className="alt-tape mono"
      role="img"
      aria-label={`Altitude slice ${formatCutoff(low)} to ${formatCutoff(high)}`}
    >
      <div className="alt-scale">
        <div className="alt-spine" />
        <div
          className="alt-fill"
          style={{ bottom: `${lowPct}%`, height: `${Math.max(highPct - lowPct, 0.8)}%` }}
        />
        {TICKS_FT.map((ft) => (
          <span key={ft} className="alt-tick" style={{ bottom: `${(ft / CEILING_FT) * 100}%` }} />
        ))}
        <div className={`alt-arm${highAtTop ? " hot" : ""}`} style={{ bottom: "100%" }}>
          <span className="alt-arm-row">
            <span className="alt-kicker">Slice</span>
            {split && highAtTop && <span>{formatCutoff(high)}</span>}
          </span>
        </div>
        {split && !highAtTop && <Arm ft={high} pct={highPct} />}
        {split ? (
          <Arm ft={low} pct={lowPct} />
        ) : (
          <div className="alt-arm hot" style={{ bottom: `${(lowPct + highPct) / 2}%` }}>
            <span className="alt-arm-row">
              <span>
                {formatCutoff(low)} – {formatCutoff(high)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Arm({ ft, pct }: { ft: number; pct: number }) {
  return (
    <div className="alt-arm hot" style={{ bottom: `${pct}%` }}>
      <span className="alt-arm-row">
        <span>{formatCutoff(ft)}</span>
      </span>
    </div>
  );
}
