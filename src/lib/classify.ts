import { AIRSPACE_TYPE } from "./openaip-enums";
import type { AirspaceCategory } from "./types";

const CLASS_OWNED = new Set(["B", "C", "D", "E", "F"]);

/** Official designator, ignoring a trailing place name such as "TOULON CTR". */
export function categoryFromDesignator(name: string): AirspaceCategory | null {
  const upper = name.toUpperCase().trim();
  if (/^(ZRT|ZIT|ZDT|TSA|TRA)\b/.test(upper)) return "restricted";
  const european = upper.match(/^[A-Z]{2}[-\s]?([DRP])\d/) ?? upper.match(/^([DRP])\d/);
  if (european) {
    if (european[1] === "D") return "danger";
    if (european[1] === "R") return "restricted";
    return "prohibited";
  }
  const northAmerica = upper.match(/^([ARPW])-\d/);
  if (northAmerica) {
    if (northAmerica[1] === "R") return "restricted";
    if (northAmerica[1] === "P") return "prohibited";
    if (northAmerica[1] === "W") return "warning";
    return "alert";
  }
  return null;
}

export function volumeTypeLabel(name: string, category: string, icaoClass: string): string {
  if (icaoClass === "E" && /CLASS\s*E/i.test(name)) return "CLASS E";
  return category.toUpperCase();
}

export function classifyAirspace(
  typeCode: number,
  name: string,
  icaoClass: string,
): AirspaceCategory {
  const upper = name.toUpperCase();
  const designated = categoryFromDesignator(upper);
  if (designated) return designated;
  if (upper.includes("FRZ") || upper.includes("FLIGHT RESTRICTION")) return "frz";
  if (upper.includes(" RMZ") || upper.endsWith(" RMZ")) return "rmz";
  if (upper.includes(" TMZ") || upper.endsWith(" TMZ")) return "tmz";
  if (upper.includes("MATZ")) return "matz";
  if (/\bMOA\b/.test(upper)) return "moa";
  if (upper.includes("ALERT")) return "alert";
  if (/\bWARNING\b/.test(upper)) return "warning";
  if (/^R-\d/.test(upper)) return "restricted";
  if (upper.includes("GLIDER") || upper.includes("PARACHUTE") || upper.includes("HIRTA") || upper.includes("AIAA")) {
    return "glider";
  }
  if (/\bAIRWAY\b|\bAWY\b/.test(upper)) return "airway";
  if (CLASS_OWNED.has(icaoClass) && /CLASS\s*[BCDEF]/.test(upper)) return "cta";

  const t = AIRSPACE_TYPE[typeCode] ?? "OTHER";
  switch (t) {
    case "CTR":
      return "ctr";
    case "CTA":
      return "cta";
    case "TMA":
      return "tma";
    case "ATZ":
      return "atz";
    case "AIRWAY":
      return "airway";
    case "DANGER":
      return "danger";
    case "RESTRICTED":
      return "restricted";
    case "PROHIBITED":
      return "prohibited";
    case "RMZ":
      return "rmz";
    case "TMZ":
      return "tmz";
    case "MATZ":
      return "matz";
    case "GLIDER":
    case "PARACHUTE":
    case "AERIAL_SPORT":
      return "glider";
    case "WARNING":
      return "warning";
    default:
      if (upper.includes(" CTR") || upper.startsWith("CTR")) return "ctr";
      if (upper.includes(" CTA") || upper.startsWith("CTA")) return "cta";
      if (upper.includes(" TMA") || upper.startsWith("TMA")) return "tma";
      if (upper.includes(" ATZ") || upper.startsWith("ATZ")) return "atz";
      if (/^R-\d/.test(upper)) return "restricted";
      if (CLASS_OWNED.has(icaoClass)) return "cta";
      return "other";
  }
}
