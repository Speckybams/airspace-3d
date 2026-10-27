import { COVERAGE_LABEL } from "@/lib/coverage";

export type LegalDoc = "terms" | "privacy" | "data";

const TITLES: Record<LegalDoc, string> = {
  terms: "Terms of use",
  privacy: "Privacy",
  data: "Data & licences",
};

export function LegalModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
      <div className="modal legal-modal">
        <h2 id="legal-modal-title">{TITLES[doc]}</h2>
        {doc === "terms" && <TermsBody />}
        {doc === "privacy" && <PrivacyBody />}
        {doc === "data" && <DataBody />}
        <button type="button" className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function TermsBody() {
  return (
    <>
      <p>
        <strong>3D Airspace Visualiser</strong> (Voluspace) is provided for education and visual understanding of airspace
        structure. It is <strong>not</strong> a flight planning, navigation, or operational tool and
        must not be used as a substitute for official publications, NOTAMs, or air traffic services.
      </p>
      <p className="muted">
        Data may be incomplete, outdated, or simplified. Heights, boundaries, and classifications are
        illustrative. You are solely responsible for compliance with applicable regulations before any
        flight or drone operation.
      </p>
      <p className="muted">
        The service is offered “as is” without warranties. To the extent permitted by law, the
        operators accept no liability for decisions or losses arising from use of this site.
      </p>
    </>
  );
}

function PrivacyBody() {
  return (
    <>
      <p>
        We do not require an account. The app stores a few preferences in your browser’s{" "}
        <strong>localStorage</strong> (for example, whether you accepted the disclaimer and recent
        search entries). We do not operate our own analytics or advertising trackers on this app.
      </p>
      <p className="muted">
        When you use the map, your browser loads tiles and terrain from third parties (such as Cesium
        ion and OpenStreetMap) under their terms. METAR requests are
        proxied through our host to aviationweather.gov. Those services receive standard request data
        (IP address, URL, user-agent) as part of normal web traffic.
      </p>
      <p className="muted">
        For questions about this policy, contact the site operator through the domain registrant or
        project maintainer listed for this deployment.
      </p>
    </>
  );
}

function DataBody() {
  return (
    <>
      <p className="muted">Attribution and licence summary for the {COVERAGE_LABEL} dataset and basemaps:</p>
      <ul className="legal-list">
        <li>
          <strong>Airspace &amp; aerodromes:</strong>{" "}
          <a href="https://www.openaip.net/" target="_blank" rel="noopener noreferrer">
            OpenAIP
          </a>{" "}
          (CC BY-NC 4.0). Not for commercial redistribution without a separate licence.
        </li>
        <li>
          <strong>Heathrow FRZ override:</strong> hand-authored from public CAA guidance — verify
          against official sources before use.
        </li>
        <li>
          <strong>Terrain &amp; imagery:</strong>{" "}
          <a href="https://cesium.com/" target="_blank" rel="noopener noreferrer">
            Cesium ion
          </a>{" "}
          (Community / plan terms apply).
        </li>
        <li>
          <strong>Chart &amp; dark basemaps:</strong>{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>{" "}
          (ODbL) via{" "}
          <a href="https://carto.com/attribution/" target="_blank" rel="noopener noreferrer">
            CARTO
          </a>{" "}
          raster tiles.
        </li>
        <li>
          <strong>Satellite fallback:</strong> EOX Sentinel-2 where Cesium ion imagery is unavailable (CC
          BY-NC-SA — non-commercial).
        </li>
        <li>
          <strong>Places:</strong> GeoNames subset (CC BY).
        </li>
        <li>
          <strong>METAR:</strong> via{" "}
          <a href="https://aviationweather.gov/" target="_blank" rel="noopener noreferrer">
            aviationweather.gov
          </a>{" "}
          (US public domain).
        </li>
      </ul>
      <p className="muted">
        Before any paid service, advertising, or commercial use, review and resolve non-commercial
        data and platform restrictions. See project documentation for the full licensing register.
      </p>
    </>
  );
}
