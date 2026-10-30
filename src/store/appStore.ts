import { create } from "zustand";
import { NA_CLASS_LETTERS, type FilterRegion } from "@/lib/filterRegion";
import { readBootHash } from "@/lib/urlState";
import type {
  AirspaceFeature,
  AirportFeature,
  BasemapId,
  MapToolState,
  ToolMode,
} from "@/lib/types";
import { emptyMapToolState } from "@/lib/types";

export interface AppState {
  basemap: BasemapId;
  setBasemap: (b: BasemapId) => void;
  categoryVisible: Record<string, boolean>;
  toggleCategory: (c: string) => void;
  hideAllCategories: () => void;
  showAllCategories: () => void;
  selectedAirspaceId: string | null;
  setSelectedAirspaceId: (id: string | null) => void;
  selectedAirspace: AirspaceFeature | null;
  setSelectedAirspace: (a: AirspaceFeature | null) => void;
  selectedAirport: AirportFeature | null;
  setSelectedAirport: (a: AirportFeature | null) => void;
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  mapToolState: MapToolState;
  setMapToolState: (state: MapToolState | ((prev: MapToolState) => MapToolState)) => void;
  resetMapToolState: () => void;
  altBandFt: [number, number];
  setAltBandFt: (band: [number, number]) => void;
  terrainExaggeration: number;
  setTerrainExaggeration: (v: number) => void;
  chartTopDown: boolean;
  setChartTopDown: (v: boolean) => void;
  queryAltFt: number;
  setQueryAltFt: (v: number) => void;
  disclaimerAccepted: boolean;
  setDisclaimerAccepted: (v: boolean) => void;
  isolateCategory: string | null;
  setIsolateCategory: (c: string | null) => void;
  satelliteNotice: string | null;
  setSatelliteNotice: (m: string | null) => void;
  /** 0–1 while the map is starting. Null once the bar should hide. */
  loadProgress: number | null;
  setLoadProgress: (n: number | null) => void;
  cameraRequest: { lon: number; lat: number; range: number; id: number } | null;
  requestCamera: (lon: number, lat: number, range: number) => void;
  classLegendIcaoClass: string | null;
  openClassLegend: (icaoClass: string) => void;
  closeClassLegend: () => void;
  runwayGuideOpen: boolean;
  openRunwayGuide: () => void;
  closeRunwayGuide: () => void;
  viewRegion: FilterRegion;
  setViewRegion: (region: FilterRegion) => void;
  classVisible: Record<string, boolean>;
  toggleClass: (letter: string) => void;
}

const defaultCategories = [
  "ctr",
  "cta",
  "tma",
  "atz",
  "airway",
  "frz",
  "rmz",
  "tmz",
  "danger",
  "restricted",
  "prohibited",
  "matz",
  "glider",
  "moa",
  "alert",
  "warning",
  "other",
];

const categoryVisible = Object.fromEntries(defaultCategories.map((c) => [c, true]));

const bootHash = readBootHash();

export const useAppStore = create<AppState>((set) => ({
  basemap: bootHash.basemap ?? "satellite",
  setBasemap: (basemap) => set({ basemap }),
  categoryVisible,
  toggleCategory: (c) =>
    set((s) => ({
      categoryVisible: { ...s.categoryVisible, [c]: !s.categoryVisible[c] },
    })),
  hideAllCategories: () =>
    set((s) => ({
      categoryVisible: Object.fromEntries(Object.keys(s.categoryVisible).map((c) => [c, false])),
      classVisible: Object.fromEntries(Object.keys(s.classVisible).map((c) => [c, false])),
    })),
  showAllCategories: () =>
    set((s) => ({
      categoryVisible: Object.fromEntries(Object.keys(s.categoryVisible).map((c) => [c, true])),
      classVisible: Object.fromEntries(Object.keys(s.classVisible).map((c) => [c, true])),
    })),
  selectedAirspaceId: bootHash.selectedId ?? null,
  setSelectedAirspaceId: (selectedAirspaceId) => set({ selectedAirspaceId }),
  selectedAirspace: null,
  setSelectedAirspace: (selectedAirspace) => set({ selectedAirspace }),
  selectedAirport: null,
  setSelectedAirport: (selectedAirport) => set({ selectedAirport }),
  tool:
    bootHash.tool && bootHash.tool !== "measure" && bootHash.tool !== "route"
      ? bootHash.tool
      : "navigate",
  mapToolState: emptyMapToolState(),
  setTool: (tool) =>
    set({
      tool: tool === "measure" || tool === "route" ? "navigate" : tool,
      mapToolState: emptyMapToolState(),
    }),
  setMapToolState: (updater) =>
    set((s) => ({
      mapToolState: typeof updater === "function" ? updater(s.mapToolState) : updater,
    })),
  resetMapToolState: () => set({ mapToolState: emptyMapToolState() }),
  altBandFt: bootHash.altBandFt ?? [0, 66000],
  setAltBandFt: (altBandFt) => set({ altBandFt }),
  terrainExaggeration: 1,
  setTerrainExaggeration: (terrainExaggeration) => set({ terrainExaggeration }),
  chartTopDown: false,
  setChartTopDown: (chartTopDown) => set({ chartTopDown }),
  queryAltFt: 3000,
  setQueryAltFt: (queryAltFt) => set({ queryAltFt }),
  disclaimerAccepted:
    typeof localStorage !== "undefined" &&
    (localStorage.getItem("airspace3d-disclaimer") === "1" ||
      localStorage.getItem("voluspace-disclaimer") === "1"),
  setDisclaimerAccepted: (v) => {
    if (v) localStorage.setItem("airspace3d-disclaimer", "1");
    set({ disclaimerAccepted: v });
  },
  isolateCategory: null,
  setIsolateCategory: (isolateCategory) => set({ isolateCategory }),
  satelliteNotice: null,
  setSatelliteNotice: (satelliteNotice) => set({ satelliteNotice }),
  loadProgress: 0,
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  cameraRequest: null,
  requestCamera: (lon, lat, range) =>
    set((s) => ({
      cameraRequest: { lon, lat, range, id: (s.cameraRequest?.id ?? 0) + 1 },
    })),
  classLegendIcaoClass: null,
  openClassLegend: (icaoClass) => set({ classLegendIcaoClass: icaoClass }),
  closeClassLegend: () => set({ classLegendIcaoClass: null }),
  runwayGuideOpen: false,
  openRunwayGuide: () => set({ runwayGuideOpen: true }),
  closeRunwayGuide: () => set({ runwayGuideOpen: false }),
  viewRegion: "uk",
  setViewRegion: (viewRegion) => set({ viewRegion }),
  classVisible: Object.fromEntries(NA_CLASS_LETTERS.map((letter) => [letter, true])),
  toggleClass: (letter) =>
    set((s) => ({
      classVisible: { ...s.classVisible, [letter]: !s.classVisible[letter] },
    })),
}));
