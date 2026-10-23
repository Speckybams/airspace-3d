import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { AirportFeature } from "@/lib/types";
import { nearestAirportWithRunway } from "@/lib/nearestAirport";
import { runwayEndLabels, runwayNumberFromHeading } from "@/lib/runwayEnds";

function usableRunways(apt: AirportFeature) {
  return apt.runways.filter((r) => r.lengthM && r.lengthM > 0 && r.widthM && r.widthM > 0);
}

function RunwayPlanSvg({
  lengthM,
  widthM,
  designator,
  trueHeading,
}: {
  lengthM: number;
  widthM: number;
  designator: string;
  trueHeading?: number;
}) {
  const pad = Math.max(40, widthM * 0.8);
  const approachLen = Math.min(900, lengthM * 0.35);
  const vbW = lengthM + pad * 2 + approachLen;
  const vbH = widthM + pad * 2;
  const x0 = pad + approachLen;
  const y0 = pad;
  const [endA, endB] = runwayEndLabels(designator);
  const numA = trueHeading != null ? runwayNumberFromHeading(trueHeading) : endA.replace(/\D/g, "").slice(0, 2);
  const numB = trueHeading != null ? runwayNumberFromHeading(trueHeading + 180) : endB.replace(/\D/g, "").slice(0, 2);

  const stripeW = Math.min(1.8, widthM / 12);
  const stripeGap = stripeW;
  const stripeCount = Math.min(8, Math.floor((widthM * 0.6) / (stripeW + stripeGap)));

  const thresholdStripes = (xStart: number, towardRight: boolean) => {
    const els: ReactElement[] = [];
    const dir = towardRight ? 1 : -1;
    for (let row = 0; row < stripeCount; row++) {
      const cy = y0 + widthM / 2 + (row - (stripeCount - 1) / 2) * (stripeW + stripeGap);
      for (let col = 0; col < 6; col++) {
        const cx = xStart + dir * col * (stripeW + stripeGap) * 1.2;
        els.push(
          <rect
            key={`${xStart}-${row}-${col}`}
            x={Math.min(cx, cx + stripeW * dir) - (dir < 0 ? stripeW : 0)}
            y={cy - stripeW / 2}
            width={stripeW}
            height={stripeW}
            fill="#f8fafc"
          />,
        );
      }
    }
    return els;
  };

  const centreDash = Math.min(15, lengthM / 40);
  const centrePath = `M ${x0 + 30} ${y0 + widthM / 2} L ${x0 + lengthM - 30} ${y0 + widthM / 2}`;

  const aimDist = Math.min(300, lengthM * 0.22);
  const aimW = Math.min(30, widthM * 0.35);
  const aimH = Math.min(10, widthM * 0.12);

  const edgeLightStep = Math.min(60, lengthM / 20);
  const edgeLights: ReactElement[] = [];
  for (let d = 0; d <= lengthM; d += edgeLightStep) {
    edgeLights.push(
      <circle key={`el-${d}`} cx={x0 + d} cy={y0 + 2} r={1.8} fill="#f8fafc" />,
      <circle key={`er-${d}`} cx={x0 + d} cy={y0 + widthM - 2} r={1.8} fill="#f8fafc" />,
    );
  }

  const approachLights: ReactElement[] = [];
  for (let d = approachLen; d > 0; d -= 30) {
    approachLights.push(
      <circle key={`ap-${d}`} cx={x0 - d} cy={y0 + widthM / 2} r={2.2} fill="#fef08a" opacity={0.5 + (1 - d / approachLen) * 0.5} />,
    );
  }

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="runway-guide-svg runway-plan-svg" preserveAspectRatio="xMidYMid meet">
      <rect x={x0 - approachLen} y={y0 - 8} width={approachLen} height={widthM + 16} fill="#1e293b" opacity="0.5" />
      {approachLights}
      <rect x={x0} y={y0} width={lengthM} height={widthM} fill="#334155" stroke="#64748b" strokeWidth={1.5} />
      {thresholdStripes(x0 + 6, true)}
      {thresholdStripes(x0 + lengthM - 6, false)}
      <line
        x1={x0 + aimDist}
        y1={y0 + widthM / 2 - aimW / 2}
        x2={x0 + aimDist}
        y2={y0 + widthM / 2 + aimW / 2}
        stroke="#f8fafc"
        strokeWidth={aimH}
      />
      <line
        x1={x0 + lengthM - aimDist}
        y1={y0 + widthM / 2 - aimW / 2}
        x2={x0 + lengthM - aimDist}
        y2={y0 + widthM / 2 + aimW / 2}
        stroke="#f8fafc"
        strokeWidth={aimH}
      />
      <line
        x1={x0}
        y1={y0 + widthM / 2}
        x2={x0 + lengthM}
        y2={y0 + widthM / 2}
        stroke="#f8fafc"
        strokeWidth={Math.max(0.8, widthM * 0.02)}
        strokeDasharray={`${centreDash} ${centreDash}`}
      />
      <path d={centrePath} fill="none" stroke="transparent" />
      {edgeLights}
      <circle cx={x0 - 4} cy={y0 + widthM / 2} r={4} fill="#22c55e" />
      <circle cx={x0 + lengthM + 4} cy={y0 + widthM / 2} r={4} fill="#ef4444" />
      <text
        x={x0 + 45}
        y={y0 + widthM / 2 + 6}
        fill="#f8fafc"
        fontSize={Math.min(28, widthM * 0.45)}
        fontFamily="IBM Plex Sans, sans-serif"
        fontWeight="600"
      >
        {numA}
      </text>
      <text
        x={x0 + lengthM - 45}
        y={y0 + widthM / 2 + 6}
        textAnchor="end"
        fill="#f8fafc"
        fontSize={Math.min(28, widthM * 0.45)}
        fontFamily="IBM Plex Sans, sans-serif"
        fontWeight="600"
      >
        {numB}
      </text>
    </svg>
  );
}

function RunwaySideSvg({ lengthM }: { lengthM: number }) {
  const disp = Math.min(60, lengthM * 0.03);
  const lda = lengthM - disp;
  const stopway = lengthM * 0.05;
  const clearway = lengthM * 0.12;
  const tora = lengthM;
  const asda = tora + stopway;
  const toda = tora + clearway;
  const scale = 1;
  const h = 80;
  const yRwy = 36;
  const maxX = toda + 40;

  const bar = (label: string, len: number, y: number, color: string) => (
    <g key={label}>
      <rect x={0} y={y} width={len * scale} height={10} fill={color} opacity={0.85} rx={1} />
      <text x={len * scale + 6} y={y + 9} fill="#94a3b8" fontSize={11} fontFamily="IBM Plex Mono, monospace">
        {label} {Math.round(len)} m
      </text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${maxX} ${h}`} className="runway-guide-svg runway-side-svg" preserveAspectRatio="xMinYMid meet">
      {bar("TORA", tora, yRwy, "#64748b")}
      {bar("LDA", lda, yRwy + 14, "#38bdf8")}
      {bar("ASDA", asda, yRwy + 28, "#a78bfa")}
      {bar("TODA", toda, yRwy + 42, "#34d399")}
      {disp > 8 && (
        <rect x={lda * scale} y={yRwy} width={disp * scale} height={10} fill="#0f172a" stroke="#475569" strokeWidth={1} />
      )}
      {stopway > 0 && (
        <rect x={tora * scale} y={yRwy + 28} width={stopway * scale} height={10} fill="#1e293b" stroke="#a78bfa" strokeDasharray="4 3" />
      )}
      {clearway > 0 && (
        <rect x={tora * scale} y={yRwy + 42} width={clearway * scale} height={10} fill="none" stroke="#34d399" strokeDasharray="6 4" />
      )}
      <text x={0} y={12} fill="#64748b" fontSize={10} fontFamily="IBM Plex Sans, sans-serif">
        Declared distances (typical proportions — not from AIP)
      </text>
    </svg>
  );
}

export function RunwayGuideModal({
  airports,
  mapLat,
  mapLon,
  onClose,
}: {
  airports: AirportFeature[];
  mapLat: number;
  mapLon: number;
  onClose: () => void;
}) {
  const hit = useMemo(() => nearestAirportWithRunway(airports, mapLat, mapLon), [airports, mapLat, mapLon]);
  const runways = hit ? usableRunways(hit.apt) : [];
  const [rwyIndex, setRwyIndex] = useState(0);
  const rwy = runways[rwyIndex] ?? runways[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setRwyIndex(0);
  }, [hit?.apt.id]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal runway-guide-modal"
        role="dialog"
        aria-labelledby="runway-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="detail-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="runway-guide-title">Runway markings &amp; lighting</h2>

        {!hit || !rwy ? (
          <p className="small muted">
            No runway with dimensions is near the map centre. Search for an airport and zoom in, then open this
            guide again.
          </p>
        ) : (
          <>
            <p className="small">
              <strong>{hit.apt.name}</strong>
              {hit.apt.icao ? ` (${hit.apt.icao})` : ""} — {Math.round(hit.distM / 1000)} km from view centre
            </p>
            {runways.length > 1 && (
              <label className="field runway-select">
                <span>Runway</span>
                <select value={rwyIndex} onChange={(e) => setRwyIndex(Number(e.target.value))}>
                  {runways.map((r, i) => (
                    <option key={`${r.designator}-${i}`} value={i}>
                      {r.designator}
                      {r.lengthM ? ` · ${Math.round(r.lengthM)} m` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <dl className="runway-meta-dl small mono">
              <div>
                <dt>Length</dt>
                <dd>{Math.round(rwy.lengthM ?? 0)} m</dd>
              </div>
              <div>
                <dt>Width</dt>
                <dd>{Math.round(rwy.widthM ?? 0)} m</dd>
              </div>
              <div>
                <dt>Surface</dt>
                <dd>{rwy.surface ?? "—"}</dd>
              </div>
              <div>
                <dt>Designator</dt>
                <dd>{rwy.designator}</dd>
              </div>
            </dl>
            <p className="tiny muted">
              Plan and profile are drawn to scale from OpenAIP length and width. Markings, lights, and declared
              distances follow a typical ICAO-style pattern — not aerodrome-specific chart data.
            </p>
            <h3 className="runway-guide-sub">Plan view (metres)</h3>
            <RunwayPlanSvg
              lengthM={rwy.lengthM!}
              widthM={rwy.widthM!}
              designator={rwy.designator}
              trueHeading={rwy.trueHeading}
            />
            <h3 className="runway-guide-sub">Declared distances</h3>
            <RunwaySideSvg lengthM={rwy.lengthM!} />
            <ul className="runway-guide-legend tiny">
              <li>
                <span className="swatch green" /> Threshold — green approach / red runway end (typical)
              </li>
              <li>
                <span className="swatch white" /> Edge lights — white along runway (may change near ends)
              </li>
              <li>
                <span className="swatch yellow" /> Approach lighting — simplified centreline row
              </li>
            </ul>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
