import { AIRSPACE_TYPE } from "./openaip-enums";
import type { AirspaceCategory } from "./types";

export function classifyAirspace(
  typeCode: number,
  name: string,
  icaoClass: string,
): AirspaceCategory {
  const upper = name.toUpperCase();
  if (upper.includes("FRZ") || upper.includes("FLIGHT RESTRICTION")) return "frz";
  if (upper.includes(" RMZ") || upper.endsWith(" RMZ")) return "rmz";
  if (upper.includes(" TMZ") || upper.endsWith(" TMZ")) return "tmz";
  if (upper.includes("MATZ")) return "matz";
  if (upper.includes("GLIDER") || upper.includes("PARACHUTE") || upper.includes("HIRTA") || upper.includes("AIAA")) {
    return "glider";
  }

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
    default:
      if (upper.includes(" CTR")) return "ctr";
      if (upper.includes(" CTA")) return "cta";
      if (upper.includes(" TMA")) return "tma";
      if (upper.includes(" ATZ")) return "atz";
      if (icaoClass === "A" || upper.includes("UPPER")) return "airway";
      return "other";
  }
}
