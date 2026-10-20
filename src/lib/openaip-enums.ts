/** OpenAIP export integer codes (GB ndgeojson). */
export const AIRSPACE_TYPE: Record<number, string> = {
  0: "CTA",
  1: "TMA",
  2: "CTR",
  3: "DANGER",
  4: "CTR",
  5: "TMZ",
  6: "RMZ",
  7: "TMA",
  8: "RESTRICTED",
  9: "PROHIBITED",
  10: "GLIDER",
  11: "PARACHUTE",
  12: "AIRWAY",
  13: "ATZ",
  14: "MATZ",
  15: "AERIAL_SPORT",
  16: "WARNING",
  28: "OTHER",
};

export const ICAO_CLASS: Record<number, string> = {
  0: "A",
  1: "B",
  2: "C",
  3: "D",
  4: "E",
  5: "F",
  6: "G",
  7: "G",
  8: "G",
};

export const ALT_UNIT: Record<number, "FT" | "FL" | "M"> = {
  0: "M",
  1: "FT",
  6: "FL",
};

export const ALT_DATUM: Record<number, "GND" | "MSL" | "STD" | "AGL"> = {
  0: "GND",
  1: "MSL",
  2: "STD",
};
