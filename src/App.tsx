import { useCallback, useEffect, useState } from "react";
import { MapViewer } from "@/components/MapViewer";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { DetailPanel } from "@/components/DetailPanel";
import { StatusBar } from "@/components/StatusBar";
import { ClassLegendModal } from "@/components/ClassLegendModal";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { AltitudeRuler } from "@/components/AltitudeRuler";
import { CrossSectionPanel } from "@/components/CrossSectionPanel";
import type {
  AirspaceFeature,
  AirportFeature,
  SearchEntry,
  UkDataMeta,
} from "@/lib/types";
import { useAppStore } from "@/store/appStore";
import { decodeAppHash, encodeAppHash } from "@/lib/urlState";
import { viewRangeMetres } from "@/lib/viewRange";

export function App() {
  const [airspaces, setAirspaces] = useState<AirspaceFeature[]>([]);
  const [airports, setAirports] = useState<AirportFeature[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchEntry[]>([]);
  const [meta, setMeta] = useState<UkDataMeta | null>(null);
  const [status, setStatus] = useState({ lon: -0.45, lat: 51.47, heightM: 180000, heading: 0 });

  const setSelectedAirspace = useAppStore((s) => s.setSelectedAirspace);
  const setSelectedAirspaceId = useAppStore((s) => s.setSelectedAirspaceId);
  const requestCamera = useAppStore((s) => s.requestCamera);
  const disclaimerAccepted = useAppStore((s) => s.disclaimerAccepted);
  const tool = useAppStore((s) => s.tool);
  const satelliteNotice = useAppStore((s) => s.satelliteNotice);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const classLegendIcaoClass = useAppStore((s) => s.classLegendIcaoClass);
  const closeClassLegend = useAppStore((s) => s.closeClassLegend);

  const country = {
    code: meta?.countryCode ?? "GB",
    name: meta?.countryName ?? "United Kingdom",
  };

  useEffect(() => {
    Promise.all([
      fetch("/data/uk/airspace.json").then((r) => r.json()),
      fetch("/data/uk/airports.json").then((r) => r.json()),
      fetch("/data/uk/search-index.json").then((r) => r.json()),
      fetch("/data/uk/meta.json").then((r) => r.json()),
    ]).then(([a, apt, search, m]) => {
      setAirspaces(a);
      setAirports(apt);
      setSearchIndex(search);
      setMeta(m);
      const hash = decodeAppHash(window.location.hash);
      if (hash.selectedId) {
        const sel = (a as AirspaceFeature[]).find((x) => x.id === hash.selectedId);
        if (sel) {
          setSelectedAirspace(sel);
          setSelectedAirspaceId(sel.id);
        }
      }
    });
  }, [setSelectedAirspace, setSelectedAirspaceId]);

  useEffect(() => {
    return useAppStore.subscribe((state, previous) => {
      if (
        state.basemap === previous.basemap &&
        state.selectedAirspaceId === previous.selectedAirspaceId &&
        state.altBandFt === previous.altBandFt &&
        state.tool === previous.tool
      ) {
        return;
      }
      window.location.hash = encodeAppHash({
        basemap: state.basemap,
        selectedId: state.selectedAirspaceId,
        altBandFt: state.altBandFt,
        tool: state.tool,
      });
    });
  }, []);

  const onPick = useCallback(
    (f: AirspaceFeature | null) => {
      setSelectedAirspace(f);
      setSelectedAirspaceId(f?.id ?? null);
    },
    [setSelectedAirspace, setSelectedAirspaceId],
  );

  return (
    <div className="app-shell">
      {!disclaimerAccepted && <DisclaimerModal />}
      {classLegendIcaoClass && airspaces.length > 0 && (
        <ClassLegendModal
          icaoClass={classLegendIcaoClass}
          airspaces={airspaces}
          country={country}
          onClose={closeClassLegend}
        />
      )}
      <TopBar
        searchIndex={searchIndex}
        onSelect={(entry) => {
          if (entry.kind === "airspace") {
            const sel = airspaces.find((x) => x.id === entry.id);
            if (sel) onPick(sel);
            requestCamera(entry.lon, entry.lat, viewRangeMetres(entry.kind, sel?.ring));
            return;
          }
          onPick(null);
          requestCamera(entry.lon, entry.lat, viewRangeMetres(entry.kind));
        }}
      />
      <div className="app-body">
        <LeftRail />
        <div className="map-stack">
          {airspaces.length > 0 && (
            <MapViewer
              key="viewer"
              airspaces={airspaces}
              onPickAirspace={onPick}
              onCameraChange={(lon, lat, heightM, heading) =>
                setStatus({ lon, lat, heightM, heading })
              }
            />
          )}
          {loadProgress !== null && (
            <div
              className="load-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(loadProgress * 100)}
              aria-label="Loading map"
            >
              <span style={{ width: `${Math.min(100, loadProgress * 100)}%` }} />
            </div>
          )}
          <AltitudeRuler />
          {tool === "crossSection" && <CrossSectionPanel airspaces={airspaces} />}
          {satelliteNotice && <div className="map-notice">{satelliteNotice}</div>}
          <DetailPanel airports={airports} airspaces={airspaces} />
        </div>
      </div>
      <StatusBar meta={meta} {...status} />
    </div>
  );
}
