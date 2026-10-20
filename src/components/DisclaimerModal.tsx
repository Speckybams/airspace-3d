import { useAppStore } from "@/store/appStore";

export function DisclaimerModal() {
  const accept = useAppStore((s) => s.setDisclaimerAccepted);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>VoluSpace</h2>
        <p>
          This application visualises UK airspace for <strong>understanding only</strong>. It is
          not certified for flight planning, navigation, or drone operations.
        </p>
        <p className="muted">
          Data is sourced from OpenAIP and illustrative overrides. Always use official UK AIP / CAA
          publications before flying.
        </p>
        <button type="button" className="btn primary" onClick={() => accept(true)}>
          I understand — continue
        </button>
      </div>
    </div>
  );
}
