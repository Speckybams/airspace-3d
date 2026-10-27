import { describe, expect, it } from "vitest";
import { overviewLod } from "../src/cesium/overviewLod";
import { keepGlobeInView, MAX_PITCH, poseAfterPinch } from "../src/cesium/touchOrbit";
import { decimateRing } from "../src/lib/ringSimplify";
import { amslFtToEllipsoidM, ukGeoidOffsetM } from "../src/lib/geoid";
import { feetToMetres, flightLevelToMetres, formatFl } from "../src/lib/units";
import { classifyAirspace } from "../src/lib/classify";
import {
  airspaceListed,
  airspaceTypeLabel,
  dropDuplicateVolumes,
  filterRegionFor,
  markStackedShelves,
  normalizeAirspace,
} from "../src/lib/filterRegion";
import type { AirspaceFeature } from "../src/lib/types";

describe("overview lod", () => {
  it("uses flat plates when the camera is high and columns when it is low", () => {
    expect(overviewLod(false, 120_000)).toBe(false);
    expect(overviewLod(true, 120_000)).toBe(false);
    expect(overviewLod(false, 12_000)).toBe(false);
    expect(overviewLod(true, 12_000)).toBe(false);
    expect(overviewLod(false, 320_000)).toBe(true);
    expect(overviewLod(true, 300_000)).toBe(true);
    expect(overviewLod(false, 300_000)).toBe(false);
    expect(overviewLod(true, 280_000)).toBe(false);
  });
});

describe("globe pitch", () => {
  it("keeps a steep regional view", () => {
    const pitch = (-40 * Math.PI) / 180;
    expect(keepGlobeInView(180_000, pitch)).toBeCloseTo(pitch, 5);
  });

  it("pitches down when a long range would look past the horizon", () => {
    const next = keepGlobeInView(12_000_000, MAX_PITCH);
    expect(next).toBeLessThan(-0.4);
  });
});

describe("ring simplify", () => {
  it("drops colinear vertices", () => {
    const ring: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ];
    const out = decimateRing(ring, 0.01, 12);
    expect(out).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);
  });
});

describe("touch orbit", () => {
  const pose = { heading: 0, pitch: -0.7, range: 10_000 };

  it("tilts down when two fingers drag down, and zooms in when they spread", () => {
    const next = poseAfterPinch(pose, { prevDist: 10, nextDist: 20, dAngle: 0, dHeight: 25 });
    expect(next.range).toBeCloseTo(5_000, 0);
    expect(next.pitch).toBeCloseTo(pose.pitch - 0.4, 5);
    expect(next.heading).toBe(0);
  });

  it("raises the view toward the horizon and zooms out when fingers close", () => {
    const next = poseAfterPinch(pose, { prevDist: 20, nextDist: 10, dAngle: 0, dHeight: -10 });
    expect(next.range).toBeCloseTo(20_000, 0);
    expect(next.pitch).toBeGreaterThan(pose.pitch);
  });

  it("follows a finger twist without jumping across the angle wrap", () => {
    const next = poseAfterPinch(pose, { prevDist: 10, nextDist: 10, dAngle: Math.PI + 0.2, dHeight: 0 });
    expect(next.heading).toBeCloseTo(-Math.PI + 0.2, 5);
    expect(next.range).toBe(pose.range);
  });
});

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
    expect(classifyAirspace(28, "TRAG SCOTLAND UPPER", "A")).toBe("other");
    expect(classifyAirspace(28, "TUPPER SOUTH MOA, NY", "G")).toBe("moa");
    expect(classifyAirspace(1, "R-5201 FORT DRUM, NY", "G")).toBe("restricted");
    expect(classifyAirspace(2, "LF-D54A1 TOULON", "G")).toBe("danger");
    expect(classifyAirspace(1, "LF-R64A0 TOULON", "G")).toBe("restricted");
    expect(classifyAirspace(2, "LF-P62 TOULON", "G")).toBe("prohibited");
    expect(classifyAirspace(2, "CTR HYERES", "D")).toBe("ctr");
    expect(classifyAirspace(1, "ZRT ÉVOLUTION EST", "G")).toBe("restricted");
    expect(classifyAirspace(1, "CYR123 VANCOUVER", "F")).toBe("restricted");
    expect(classifyAirspace(28, "NEW YORK STATE CLASS E5", "E")).toBe("cta");
    expect(classifyAirspace(2, "V300 AIRWAY", "B")).toBe("airway");
    expect(classifyAirspace(28, "SAN JUAN LOW", "E")).toBe("cta");
    expect(classifyAirspace(28, "MOAB CLASS E5", "E")).toBe("cta");
  });
});

describe("filterRegion", () => {
  it("switches labels by camera position", () => {
    expect(filterRegionFor(51.5, -0.1)).toBe("uk");
    expect(filterRegionFor(43.7, 7.2)).toBe("icao");
    expect(filterRegionFor(40.7, -74)).toBe("na");
  });

  it("repairs UPPER and MOA volumes already stored as airways", () => {
    const feature = {
      id: "1",
      name: "TUPPER SOUTH MOA, NY",
      category: "airway",
      icaoClass: "G",
      lower: { value: 0, unit: "FT", datum: "AGL", ellipsoidM: 0, display: "SFC" },
      upper: { value: 100, unit: "FL", datum: "STD", ellipsoidM: 3000, display: "FL100" },
      lowerUsesTerrain: false,
      frequencies: [],
      source: "openaip",
      ring: [[0, 0], [1, 0], [1, 1], [0, 0]],
    } as AirspaceFeature;
    expect(normalizeAirspace(feature).category).toBe("moa");
  });

  it("binds every North American volume to a visible filter row", () => {
    const na = (name: string, category: AirspaceFeature["category"], icaoClass: string) =>
      normalizeAirspace({
        id: name,
        name,
        category,
        icaoClass,
        lower: { value: 0, unit: "FT", datum: "AGL", ellipsoidM: 0, display: "SFC" },
        upper: { value: 100, unit: "FL", datum: "STD", ellipsoidM: 3000, display: "FL100" },
        lowerUsesTerrain: false,
        frequencies: [],
        source: "openaip",
        ring: [[-74, 40.7], [-73, 40.7], [-73, 41], [-74, 40.7]],
      });
    const on = { B: true, C: true, D: true, E: true, F: true };
    const categories = { airway: true, other: true, cta: false, ctr: false };
    expect(na("V300 AIRWAY", "cta", "B").category).toBe("airway");
    expect(na("SAN JUAN LOW", "other", "E").category).toBe("cta");
    expect(na("CYA407(M) SOUTHPORT, MB", "cta", "F").category).toBe("cta");
    expect(na("EGLL FRZ", "frz", "G").category).toBe("other");
    const classE = na("NEW YORK STATE CLASS E5", "other", "E");
    expect(airspaceTypeLabel(classE)).toBe("CLASS E");
    expect(airspaceListed("na", classE.category, classE.icaoClass, categories, { ...on, E: false })).toBe(false);
    expect(airspaceListed("na", classE.category, classE.icaoClass, categories, on)).toBe(true);
    const airway = na("V300 AIRWAY", "cta", "B");
    expect(airspaceListed("na", airway.category, airway.icaoClass, { airway: false }, on)).toBe(false);
    expect(airspaceListed("icao", "cta", "E", { cta: false }, on)).toBe(false);
    expect(airspaceListed("uk", "ctr", "D", { ctr: true }, { ...on, D: false })).toBe(true);
  });

  it("keeps the lowest shelf solid and drops a twin restricted copy", () => {
    const ring: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 0]];
    const lower = { value: 1500, unit: "FT" as const, datum: "MSL" as const, ellipsoidM: 450, display: "1,500 ft AMSL" };
    const mid = { value: 2500, unit: "FT" as const, datum: "MSL" as const, ellipsoidM: 760, display: "2,500 ft AMSL" };
    const upper = { value: 3500, unit: "FT" as const, datum: "MSL" as const, ellipsoidM: 1070, display: "3,500 ft AMSL" };
    const base = {
      icaoClass: "A",
      lowerUsesTerrain: false,
      frequencies: [],
      source: "openaip" as const,
      ring,
    };
    const lowerShelf = { ...base, id: "low", name: "TMA PARIS 2", category: "tma" as const, lower, upper: mid };
    const upperShelf = { ...base, id: "high", name: "TMA PARIS 3", category: "tma" as const, lower: mid, upper };
    const twin = { ...base, id: "twin", name: "LF-R205/2 PARIS 2", category: "restricted" as const, icaoClass: "G", lower, upper: mid };
    const kept = dropDuplicateVolumes([lowerShelf, twin, upperShelf]);
    expect(kept.map((feature) => feature.id).sort()).toEqual(["high", "low"]);
    markStackedShelves(kept);
    expect(kept.find((feature) => feature.id === "low")?.thinFill).toBe(false);
    expect(kept.find((feature) => feature.id === "high")?.thinFill).toBe(true);
  });
});
