import { useCallback, useEffect, useRef, useState } from "react";
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
import { QueryToolPanel } from "@/components/QueryToolPanel";
import { MeasureToolPanel } from "@/components/MeasureToolPanel";
import { RouteToolPanel } from "@/components/RouteToolPanel";
import type { ProfileBand, ProfileSample } from "@/lib/sectionProfile";
import type {
  AirspaceFeature,
  AirportFeature,
  SearchEntry,
  UkDataMeta,
} from "@/lib/types";
import { filterRegionFor } from "@/lib/filterRegion";
import { fetchAirspaceById, fetchAirspaceCell, setCellDataRevision } from "@/lib/worldData";
import { cellIdFor } from "@/lib/worldCells";
import { hashFragmentForState, replaceUrlHash } from "@/lib/applyAppHash";
import { resolveOpeningCamera, type SavedCamera } from "@/lib/cameraMemory";
import { useAppStore } from "@/store/appStore";
import { readBootHash } from "@/lib/urlState";
import { viewRangeMetres } from "@/lib/viewRange";

export function App() {
  const [loadedAirspaces, setLoadedAirspaces] = useState<AirspaceFeature[]>([]);
  const [airports, setAirports] = useState<AirportFeature[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchEntry[]>([]);
  const [meta, setMeta] = useState<UkDataMeta | null>(null);
  const [dataReady] = useState(true);
  const opening = resolveOpeningCamera(readBootHash());
  const orbitPoseRef = useRef<SavedCamera>(opening);
  const hashDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState({
    lon: opening.lon,
    lat: opening.lat,
    heightM: 120_000,
    heading: (opening.heading * 180) / Math.PI,
  });
  const [sectionProfile, setSectionProfile] = useState<{
    lengthM: number;
    samples: ProfileSample[];
    bands: ProfileBand[];
  } | null>(null);

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

  const pushHash = useCallback((pose: SavedCamera) => {
    const state = useAppStore.getState();
    replaceUrlHash(
      hashFragmentForState(
        {
          basemap: state.basemap,
          selectedAirspaceId: state.selectedAirspaceId,
          altBandFt: state.altBandFt,
          tool: state.tool,
        },
        pose,
      ),
    );
  }, []);

  useEffect(() => {
    const pose = resolveOpeningCamera(readBootHash());
    const homeCell = fetchAirspaceCell(cellIdFor(pose.lat, pose.lon));
    void fetch("/data/world/meta.json")
      .then((r) => r.json())
      .then((m: UkDataMeta) => {
        setMeta(m);
        if (m.builtAt) setCellDataRevision(m.builtAt);
      })
      .catch(() => {});
    void homeCell.finally(() => {
      void fetch("/data/world/airports.json")
        .then((r) => r.json())
        .then((apt: AirportFeature[]) => setAirports(apt))
        .catch(() => {});
      void fetch("/data/world/search-index.json")
        .then((r) => r.json())
        .then((search: SearchEntry[]) => {
          setSearchIndex(search);
          const selectedId = useAppStore.getState().selectedAirspaceId;
          if (!selectedId) return;
          const entry = search.find((x) => x.kind === "airspace" && x.id === selectedId);
          if (!entry?.cellId) return;
          void fetchAirspaceById(entry.id, entry.cellId).then((sel) => {
            if (sel) {
              setSelectedAirspace(sel);
              setSelectedAirspaceId(sel.id);
            }
          });
        })
        .catch(() => {});
    });
  }, [setSelectedAirspace, setSelectedAirspaceId]);

  useEffect(() => {
    if (tool !== "crossSection") setSectionProfile(null);
  }, [tool]);

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
      pushHash(orbitPoseRef.current);
    });
  }, [pushHash]);

  useEffect(
    () => () => {
      if (hashDebounceRef.current) clearTimeout(hashDebounceRef.current);
    },
    [],
  );

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
      {runwayGuideOpen && (
        <RunwayGuideModal
          airports={airports}
          mapLat={status.lat}
          mapLon={status.lon}
          onClose={closeRunwayGuide}
        />
      )}
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
              onSectionProfileChange={setSectionProfile}
              onCameraChange={(lon, lat, heightM, heading) => {
                setStatus({ lon, lat, heightM, heading });
                const region = filterRegionFor(lat, lon);
                if (useAppStore.getState().viewRegion !== region) {
                  useAppStore.getState().setViewRegion(region);
                }
              }}
              onOrbitPose={(pose) => {
                orbitPoseRef.current = pose;
                if (hashDebounceRef.current) clearTimeout(hashDebounceRef.current);
                hashDebounceRef.current = setTimeout(() => pushHash(pose), 800);
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
          {tool === "query" && <QueryToolPanel airspaces={loadedAirspaces} onSelectAirspace={onPick} />}
          {tool === "measure" && <MeasureToolPanel />}
          {tool === "route" && <RouteToolPanel airspaces={loadedAirspaces} />}
          {tool === "crossSection" && (
            <CrossSectionPanel profile={sectionProfile} onProfileClear={() => setSectionProfile(null)} />
          )}
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
