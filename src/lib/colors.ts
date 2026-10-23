import type { AirspaceCategory } from "./types";

export interface CategoryStyle {
  fill: string;
  outline: string;
  dashed: boolean;
}

export const CATEGORY_STYLES: Record<AirspaceCategory, CategoryStyle> = {
  ctr: { fill: "rgba(96, 165, 250, 0.22)", outline: "rgba(147, 197, 253, 0.95)", dashed: false },
  cta: { fill: "rgba(59, 130, 246, 0.18)", outline: "rgba(96, 165, 250, 0.9)", dashed: false },
  tma: { fill: "rgba(37, 99, 235, 0.16)", outline: "rgba(59, 130, 246, 0.85)", dashed: false },
  airway: { fill: "rgba(30, 64, 175, 0.14)", outline: "rgba(37, 99, 235, 0.8)", dashed: false },
  atz: { fill: "rgba(34, 211, 238, 0.2)", outline: "rgba(103, 232, 249, 0.95)", dashed: false },
  frz: { fill: "rgba(239, 68, 68, 0.22)", outline: "rgba(248, 113, 113, 1)", dashed: true },
  rmz: { fill: "rgba(251, 191, 36, 0.18)", outline: "rgba(252, 211, 77, 0.95)", dashed: true },
  tmz: { fill: "rgba(245, 158, 11, 0.18)", outline: "rgba(251, 191, 36, 0.95)", dashed: true },
  danger: { fill: "rgba(220, 38, 38, 0.2)", outline: "rgba(248, 113, 113, 0.95)", dashed: false },
  restricted: { fill: "rgba(234, 88, 12, 0.2)", outline: "rgba(251, 146, 60, 0.95)", dashed: false },
  prohibited: { fill: "rgba(127, 29, 29, 0.35)", outline: "rgba(185, 28, 28, 0.95)", dashed: false },
  matz: { fill: "rgba(101, 163, 13, 0.2)", outline: "rgba(163, 230, 53, 0.9)", dashed: false },
  glider: { fill: "rgba(250, 204, 21, 0.18)", outline: "rgba(253, 224, 71, 0.95)", dashed: true },
  moa: { fill: "rgba(234, 88, 12, 0.16)", outline: "rgba(251, 146, 60, 0.9)", dashed: true },
  alert: { fill: "rgba(244, 114, 182, 0.16)", outline: "rgba(251, 207, 232, 0.95)", dashed: true },
  warning: { fill: "rgba(249, 115, 22, 0.16)", outline: "rgba(253, 186, 116, 0.95)", dashed: true },
  other: { fill: "rgba(148, 163, 184, 0.15)", outline: "rgba(203, 213, 225, 0.8)", dashed: false },
};

/** Short filter-rail hints; general guidance only. */
/** North American class rows. Polygon color matches the filter swatch. */
export const NA_CLASS_STYLES: Record<string, CategoryStyle> = {
  B: { fill: "rgba(37, 99, 235, 0.2)", outline: "rgba(37, 99, 235, 0.9)", dashed: false },
  C: { fill: "rgba(147, 51, 234, 0.2)", outline: "rgba(147, 51, 234, 0.9)", dashed: false },
  D: { fill: "rgba(96, 165, 250, 0.22)", outline: "rgba(96, 165, 250, 0.95)", dashed: false },
  E: { fill: "rgba(125, 211, 252, 0.22)", outline: "rgba(125, 211, 252, 0.95)", dashed: false },
  F: { fill: "rgba(132, 204, 22, 0.2)", outline: "rgba(132, 204, 22, 0.95)", dashed: false },
};

export const NA_CLASS_HINTS: Record<string, string> = {
  B: "Class B. Busy terminal airspace. Clearance required before entry.",
  C: "Class C. Controlled airspace around a radar airport. Two-way radio required.",
  D: "Class D. Control zone around a towered airport.",
  E: "Class E. Controlled airspace. VFR rules apply, with IFR separation.",
  F: "Class F. Advisory airspace. In Canada this includes CYA areas.",
};

export const CATEGORY_HINTS: Record<AirspaceCategory, string> = {
  airway: "Published IFR route structure between fixes.",
  tma: "Terminal area around a major airport, IFR and VFR with ATC.",
  cta: "Controlled area linking terminal and en-route airspace.",
  ctr: "Control zone around an aerodrome, out to a published limit.",
  atz: "Aerodrome traffic zone for traffic at or near an airfield.",
  danger: "Hazardous activity; flight is not prohibited but may be unsafe.",
  restricted: "Entry limited when active; check NOTAM before entering.",
  prohibited: "Entry forbidden at all times.",
  frz: "Drone flight restriction zone around protected aerodromes.",
  rmz: "Radio mandatory — establish contact before entering.",
  tmz: "Transponder mandatory with assigned code or Mode S.",
  matz: "Military aerodrome traffic zone.",
  glider: "Gliding or soaring activity; expect unpowered traffic.",
  moa: "Military operations area. Transit when it is not active, or with clearance.",
  alert: "Alert area. High pilot training or unusual activity; no clearance required.",
  warning: "Warning area. Hazardous activity, often over water.",
  other: "Other published airspace not in a standard category.",
};

export { ICAO_CLASS_BLURB } from "./icaoClasses";
