export function MapViewerSplash({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));

  return (
    <div className="map-viewer-splash" role="status" aria-live="polite" aria-busy="true">
      <div className="map-viewer-splash-inner">
        <p className="map-viewer-splash-title">3D Airspace Visualiser</p>
        <div
          className="map-viewer-splash-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Loading map"
        >
          <span className="map-viewer-splash-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
