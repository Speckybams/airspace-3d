import { COVERAGE_LABEL } from "@/lib/coverage";
import { useAppStore } from "@/store/appStore";

export function DisclaimerModal() {
  const accept = useAppStore((s) => s.setDisclaimerAccepted);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>3D Airspace Visualiser</h2>
        <p>
          This application visualises airspace in 3D for <strong>understanding only</strong>. It is
          not certified for flight planning, navigation, or drone operations.
        </p>
        <p className="muted">
          Regional coverage expands over time; the current dataset is {COVERAGE_LABEL}. Data is sourced
          from OpenAIP and illustrative overrides. Always use official national AIP publications
          before flying.
        </p>
        <button type="button" className="btn primary" onClick={() => accept(true)}>
          I understand — continue
        </button>
      </div>
    </div>
  );
}
