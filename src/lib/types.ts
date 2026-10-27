export type AirspaceCategory =
  | "ctr"
  | "cta"
  | "tma"
  | "atz"
  | "airway"
  | "frz"
  | "rmz"
  | "tmz"
  | "danger"
  | "restricted"
  | "prohibited"
  | "matz"
  | "glider"
  | "moa"
  | "alert"
  | "warning"
  | "other";

export type LimitDatum = "GND" | "MSL" | "STD" | "AGL";

export interface AltitudeLimit {
  value: number;
  unit: "FT" | "FL" | "M";
  datum: LimitDatum;
  /** Ellipsoidal metres (WGS84) for rendering; AGL uses runtime terrain offset stored separately */
  ellipsoidM: number;
  display: string;
}

export interface AirspaceFeature {
  id: string;
  name: string;
  category: AirspaceCategory;
  icaoClass: string;
  lower: AltitudeLimit;
  upper: AltitudeLimit;
  /** When lower is GND/AGL, extrude from terrain at runtime */
  lowerUsesTerrain: boolean;
  frequencies: { value: string; name?: string }[];
  remarks?: string;
  source: "openaip" | "override";
  ring: [number, number][];
  /** Upper step of a stacked terminal area: outline only, with a thin floor so it stays pickable. */
  thinFill?: boolean;
}

export interface AirportFeature {
  id: string;
  icao?: string;
  name: string;
  lon: number;
  lat: number;
  elevationFt?: number;
  runways: {
    designator: string;
    lengthM?: number;
    widthM?: number;
    surface?: string;
    trueHeading?: number;
  }[];
  frequencies: { value: string; name?: string }[];
}

export interface NavaidFeature {
  id: string;
  name: string;
  identifier: string;
  type: string;
  lon: number;
  lat: number;
  frequency?: string;
}

export interface PlaceFeature {
  id: string;
  name: string;
  lon: number;
  lat: number;
  population: number;
  admin?: string;
}

export interface SearchEntry {
  id: string;
  kind: "airspace" | "airport" | "place";
  label: string;
  sub?: string;
  lon: number;
  lat: number;
  /** World pack: cell file id for lazy airspace geometry load */
  cellId?: string;
}

export interface UkDataMeta {
  builtAt: string;
  airspaceCount: number;
  airportCount: number;
  sourceDate: string;
  licence: string;
  /** ISO 3166-1 alpha-2; set in meta when loading international packs */
  countryCode?: string;
  /** Display name for legend modals */
  countryName?: string;
  /** Dataset folder id, e.g. world */
  regionId?: string;
  packName?: string;
  countries?: string[];
}

export type BasemapId = "chart" | "dark" | "satellite";

export type ToolMode =
  | "navigate"
  | "query"
  | "measure"
  | "crossSection"
  | "route";

export interface LonLat {
  lon: number;
  lat: number;
}

export interface RouteWaypoint extends LonLat {
  label?: string;
}

export interface MapToolState {
  query: { lon: number; lat: number; terrainM: number } | null;
  measure: LonLat[];
  section: LonLat[];
  route: RouteWaypoint[];
}

export const emptyMapToolState = (): MapToolState => ({
  query: null,
  measure: [],
  section: [],
  route: [],
});
