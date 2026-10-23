import { describe, expect, it } from "vitest";
import { airspaceCategoryShowsWeather, pickWeatherStation } from "@/lib/aviationWeather";
import type { AirportFeature } from "@/lib/types";

const airports: AirportFeature[] = [
  {
    id: "egll",
    icao: "EGLL",
    name: "Heathrow",
    lat: 51.47,
    lon: -0.46,
    runways: [],
    frequencies: [],
  },
  {
    id: "egcc",
    icao: "EGCC",
    name: "Manchester",
    lat: 53.35,
    lon: -2.27,
    runways: [],
    frequencies: [],
  },
];

describe("airspaceCategoryShowsWeather", () => {
  it("shows for aerodrome-adjacent categories only", () => {
    expect(airspaceCategoryShowsWeather("atz")).toBe(true);
    expect(airspaceCategoryShowsWeather("ctr")).toBe(true);
    expect(airspaceCategoryShowsWeather("tma")).toBe(false);
    expect(airspaceCategoryShowsWeather("airway")).toBe(false);
    expect(airspaceCategoryShowsWeather("danger")).toBe(false);
  });
});

describe("pickWeatherStation", () => {
  it("picks nearest ICAO airport to map centre", () => {
    expect(pickWeatherStation(airports, 51.5, -0.5)).toBe("EGLL");
    expect(pickWeatherStation(airports, 53.4, -2.3)).toBe("EGCC");
  });
});
