import { useEffect } from "react";

export function RunwayGuideModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        <p className="small muted">
          General guidance for student pilots. Always use your national AIP and aerodrome charts for
          real operations.
        </p>

        <div className="runway-guide-diagram" aria-hidden>
          <svg viewBox="0 0 420 200" className="runway-guide-svg">
            <rect x="40" y="70" width="340" height="60" fill="#334155" stroke="#64748b" />
            <line x1="60" y1="100" x2="360" y2="100" stroke="#f8fafc" strokeWidth="2" strokeDasharray="16 12" />
            <rect x="52" y="88" width="36" height="24" fill="#f8fafc" opacity="0.9" />
            <rect x="332" y="88" width="36" height="24" fill="#f8fafc" opacity="0.9" />
            <text x="210" y="105" textAnchor="middle" fill="#f8fafc" fontSize="14" fontFamily="IBM Plex Sans, sans-serif">
              09
            </text>
            <circle cx="48" cy="100" r="5" fill="#22c55e" />
            <circle cx="372" cy="100" r="5" fill="#ef4444" />
            <circle cx="40" cy="85" r="3" fill="#f8fafc" />
            <circle cx="40" cy="115" r="3" fill="#f8fafc" />
            <circle cx="380" cy="85" r="3" fill="#f8fafc" />
            <circle cx="380" cy="115" r="3" fill="#f8fafc" />
          </svg>
          <ul className="runway-guide-legend tiny">
            <li>
              <span className="swatch green" /> Threshold — green approach / red runway end (typical)
            </li>
            <li>
              <span className="swatch white" /> Edge lights — white along runway (colour may change near ends)
            </li>
            <li>White bars — threshold markings; dashed line — centreline; numbers — magnetic direction</li>
          </ul>
        </div>

        <section className="runway-guide-distances">
          <h3>Declared distances</h3>
          <dl className="runway-dist-dl small">
            <div>
              <dt>TORA</dt>
              <dd>Take-off run available — length for ground run to lift-off.</dd>
            </div>
            <div>
              <dt>TODA</dt>
              <dd>Take-off distance available — includes clearway beyond runway end if published.</dd>
            </div>
            <div>
              <dt>ASDA</dt>
              <dd>Accelerate-stop distance available — runway plus stopway for rejected take-off.</dd>
            </div>
            <div>
              <dt>LDA</dt>
              <dd>Landing distance available — length usable for landing rollout.</dd>
            </div>
          </dl>
        </section>

        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
