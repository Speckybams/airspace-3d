import { describe, expect, it } from "vitest";
import { amslFtToEllipsoidM, ukGeoidOffsetM } from "../src/lib/geoid";
import { feetToMetres, flightLevelToMetres, formatFl } from "../src/lib/units";
import { classifyAirspace } from "../src/lib/classify";

describe("units", () => {
  it("converts feet and flight levels", () => {
    expect(feetToMetres(1000)).toBeCloseTo(304.8, 1);
    expect(flightLevelToMetres(100)).toBeCloseTo(3048, 0);
    expect(formatFl(195)).toBe("FL195");
  });
});

describe("geoid", () => {
  it("offsets AMSL for UK", () => {
    const off = ukGeoidOffsetM(51.47, -0.45);
    expect(off).toBeGreaterThan(40);
    expect(amslFtToEllipsoidM(0, 51.47, -0.45)).toBeCloseTo(off, 0);
  });
});

describe("classify", () => {
  it("maps CTR and FRZ", () => {
    expect(classifyAirspace(4, "LONDON CITY CTR", "D")).toBe("ctr");
    expect(classifyAirspace(0, "EGLL FRZ", "G")).toBe("frz");
  });
});
