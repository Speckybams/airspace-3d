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
}

export interface AirportFeature {
  id: string;
  icao?: string;
  name: string;
  lon: number;
  lat: number;
  elevationFt?: number;
  runways: { designator: string; lengthM?: number; surface?: string }[];
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
  /** Dataset folder id, e.g. uk */
  regionId?: string;
}

export type BasemapId = "chart" | "satellite";

export type ToolMode =
  | "navigate"
  | "query"
  | "measure"
  | "crossSection"
  | "route";
