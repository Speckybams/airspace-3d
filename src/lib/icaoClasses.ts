/** ICAO Annex 11 airspace classes (OpenAIP codes 0–6; 7–8 unclassified → G). */
export const ICAO_AIRSPACE_CLASS_IDS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export type IcaoAirspaceClass = (typeof ICAO_AIRSPACE_CLASS_IDS)[number];

export interface IcaoClassDefinition {
  id: IcaoAirspaceClass;
  title: string;
  blurb: string;
  /** Accent for labels and chips */
  color: string;
  /** Chip / badge background */
  background: string;
}

export const ICAO_CLASS_DEFINITIONS: Record<IcaoAirspaceClass, IcaoClassDefinition> = {
  A: {
    id: "A",
    title: "Class A",
    blurb: "IFR only. All traffic separated.",
    color: "#fda4af",
    background: "rgba(190, 18, 60, 0.35)",
  },
  B: {
    id: "B",
    title: "Class B",
    blurb: "IFR and VFR. All traffic separated.",
    color: "#fdba74",
    background: "rgba(194, 65, 12, 0.32)",
  },
  C: {
    id: "C",
    title: "Class C",
    blurb: "IFR and VFR. IFR separated from IFR and VFR; VFR receives traffic information.",
    color: "#fde047",
    background: "rgba(161, 98, 7, 0.32)",
  },
  D: {
    id: "D",
    title: "Class D",
    blurb: "IFR and VFR. Traffic information provided; IFR receives separation from IFR.",
    color: "#86efac",
    background: "rgba(21, 128, 61, 0.28)",
  },
  E: {
    id: "E",
    title: "Class E",
    blurb: "Controlled airspace. IFR traffic receives ATC service; VFR rules apply with restrictions.",
    color: "#67e8f9",
    background: "rgba(14, 116, 144, 0.32)",
  },
  F: {
    id: "F",
    title: "Class F",
    blurb: "Advisory airspace. ATC provides advisory service to IFR.",
    color: "#93c5fd",
    background: "rgba(29, 78, 216, 0.28)",
  },
  G: {
    id: "G",
    title: "Class G",
    blurb: "Uncontrolled. VFR minima and see-and-avoid apply.",
    color: "#cbd5e1",
    background: "rgba(71, 85, 105, 0.45)",
  },
};

export function normalizeIcaoClass(value: string): IcaoAirspaceClass {
  const letter = value.trim().charAt(0).toUpperCase();
  if ((ICAO_AIRSPACE_CLASS_IDS as readonly string[]).includes(letter)) {
    return letter as IcaoAirspaceClass;
  }
  return "G";
}

export function getIcaoClassDefinition(value: string): IcaoClassDefinition {
  return ICAO_CLASS_DEFINITIONS[normalizeIcaoClass(value)];
}

/** @deprecated Use getIcaoClassDefinition().blurb */
export const ICAO_CLASS_BLURB: Record<IcaoAirspaceClass, string> = Object.fromEntries(
  ICAO_AIRSPACE_CLASS_IDS.map((id) => [id, ICAO_CLASS_DEFINITIONS[id].blurb]),
) as Record<IcaoAirspaceClass, string>;
