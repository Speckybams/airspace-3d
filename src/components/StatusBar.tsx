import { useState } from "react";
import type { UkDataMeta } from "@/lib/types";
import { metresToFeet } from "@/lib/units";
import { AboutModal } from "@/components/AboutModal";
import { LegalModal, type LegalDoc } from "@/components/LegalModal";

const LEGAL_LINKS: { id: LegalDoc; label: string }[] = [
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "data", label: "Licences" },
];

export function StatusBar({
  lon,
  lat,
  heightM,
  heading,
  meta,
}: {
  lon: number;
  lat: number;
  heightM: number;
  heading: number;
  meta: UkDataMeta | null;
}) {
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
      {aboutOpen && <AboutModal meta={meta} onClose={() => setAboutOpen(false)} />}
      <footer className="status-bar mono">
        <div className="status-bar-main">
          <span>
            {lat.toFixed(4)}°N {lon.toFixed(4)}°E
          </span>
          <span>CAM {Math.round(metresToFeet(heightM)).toLocaleString()} ft</span>
          <span>HDG {Math.round(heading).toString().padStart(3, "0")}°</span>
          <span className="muted">Data {meta?.builtAt?.slice(0, 10) ?? "—"}</span>
          <span className="muted">OpenAIP · OS · Cesium · Not for navigation</span>
        </div>
        <nav className="status-bar-legal" aria-label="Legal and about">
          <span className="status-legal-item">
            <button type="button" className="status-link" onClick={() => setAboutOpen(true)}>
              About
            </button>
          </span>
          {LEGAL_LINKS.map((link) => (
            <span key={link.id} className="status-legal-item">
              <span className="status-legal-sep" aria-hidden="true">
                ·
              </span>
              <button type="button" className="status-link" onClick={() => setLegalDoc(link.id)}>
                {link.label}
              </button>
            </span>
          ))}
        </nav>
      </footer>
    </>
  );
}
