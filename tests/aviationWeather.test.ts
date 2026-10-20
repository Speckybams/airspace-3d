import { describe, expect, it } from "vitest";
import { pickWeatherStation } from "@/lib/aviationWeather";
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

describe("pickWeatherStation", () => {
  it("picks nearest ICAO airport to map centre", () => {
    expect(pickWeatherStation(airports, 51.5, -0.5)).toBe("EGLL");
    expect(pickWeatherStation(airports, 53.4, -2.3)).toBe("EGCC");
  });
});
