import { useCallback, useEffect, useState } from "react";
import { MapViewer } from "@/components/MapViewer";
import { TopBar } from "@/components/TopBar";
import { LeftRail } from "@/components/LeftRail";
import { DetailPanel } from "@/components/DetailPanel";
import { StatusBar } from "@/components/StatusBar";
import { ClassLegendModal } from "@/components/ClassLegendModal";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { RunwayGuideModal } from "@/components/RunwayGuideModal";
import { AltitudeRuler } from "@/components/AltitudeRuler";
import { CrossSectionPanel } from "@/components/CrossSectionPanel";
import type {
  AirspaceFeature,
  AirportFeature,
  SearchEntry,
  UkDataMeta,
} from "@/lib/types";
import { filterRegionFor } from "@/lib/filterRegion";
import { fetchAirspaceById } from "@/lib/worldData";
import { useAppStore } from "@/store/appStore";
import { decodeAppHash, encodeAppHash } from "@/lib/urlState";
import { viewRangeMetres } from "@/lib/viewRange";

export function App() {
  const [loadedAirspaces, setLoadedAirspaces] = useState<AirspaceFeature[]>([]);
  const [airports, setAirports] = useState<AirportFeature[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchEntry[]>([]);
  const [meta, setMeta] = useState<UkDataMeta | null>(null);
  const [dataReady, setDataReady] = useState(false);
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
  const runwayGuideOpen = useAppStore((s) => s.runwayGuideOpen);
  const closeRunwayGuide = useAppStore((s) => s.closeRunwayGuide);

  const country = {
    code: meta?.countryCode ?? "EU-NA",
    name: meta?.countryName ?? "Europe & North America",
  };

  useEffect(() => {
    Promise.all([
      fetch("/data/world/airports.json").then((r) => r.json()),
      fetch("/data/world/search-index.json").then((r) => r.json()),
      fetch("/data/world/meta.json").then((r) => r.json()),
    ])
      .then(([apt, search, m]) => {
        setAirports(apt);
        setSearchIndex(search);
        setMeta(m);
        setDataReady(true);
        const hash = decodeAppHash(window.location.hash);
        if (hash.selectedId) {
          const entry = (search as SearchEntry[]).find(
            (x) => x.kind === "airspace" && x.id === hash.selectedId,
          );
          if (entry?.cellId) {
            void fetchAirspaceById(entry.id, entry.cellId).then((sel) => {
              if (sel) {
                setSelectedAirspace(sel);
                setSelectedAirspaceId(sel.id);
              }
            });
          }
        }
      })
      .catch((err) => console.error(err));
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
      {runwayGuideOpen && <RunwayGuideModal onClose={closeRunwayGuide} />}
      {classLegendIcaoClass && loadedAirspaces.length > 0 && (
        <ClassLegendModal
          icaoClass={classLegendIcaoClass}
          airspaces={loadedAirspaces}
          country={country}
          onClose={closeClassLegend}
        />
      )}
      <TopBar
        searchIndex={searchIndex}
        onSelect={(entry) => {
          if (entry.kind === "airspace") {
            void (async () => {
              let sel =
                loadedAirspaces.find((x) => x.id === entry.id) ??
                (entry.cellId ? await fetchAirspaceById(entry.id, entry.cellId) : null);
              if (sel) onPick(sel);
              requestCamera(entry.lon, entry.lat, viewRangeMetres(entry.kind, sel?.ring));
            })();
            return;
          }
          onPick(null);
          requestCamera(entry.lon, entry.lat, viewRangeMetres(entry.kind));
        }}
      />
      <div className="app-body">
        <LeftRail />
        <div className="map-stack">
          {dataReady && (
            <MapViewer
              key="viewer"
              airports={airports}
              onPickAirspace={onPick}
              onLoadedAirspacesChange={setLoadedAirspaces}
              onCameraChange={(lon, lat, heightM, heading) => {
                setStatus({ lon, lat, heightM, heading });
                const region = filterRegionFor(lat, lon);
                if (useAppStore.getState().viewRegion !== region) {
                  useAppStore.getState().setViewRegion(region);
                }
              }}
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
          {tool === "crossSection" && <CrossSectionPanel airspaces={loadedAirspaces} />}
          {satelliteNotice && <div className="map-notice">{satelliteNotice}</div>}
          <DetailPanel
            airports={airports}
            airspaces={loadedAirspaces}
            mapLat={status.lat}
            mapLon={status.lon}
          />
        </div>
      </div>
      <StatusBar meta={meta} {...status} />
    </div>
  );
}
