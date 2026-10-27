import { describe, expect, it } from "vitest";
import { MAX_RANGE, MIN_RANGE } from "../src/cesium/touchOrbit";
import { decodeAppHash, encodeAppHash } from "../src/lib/urlState";

describe("urlState", () => {
  it("round-trips basemap, tool, selection, altitude band, and camera", () => {
    const camera = {
      lon: -0.45,
      lat: 51.47,
      range: 180_000,
      heading: 0.2,
      pitch: -0.7,
    };
    const fragment = encodeAppHash({
      basemap: "dark",
      selectedId: "asp-123",
      altBandFt: [1000, 25000],
      tool: "query",
      camera,
    });
    const decoded = decodeAppHash(fragment);
    expect(decoded.basemap).toBe("dark");
    expect(decoded.tool).toBe("query");
    expect(decoded.selectedId).toBe("asp-123");
    expect(decoded.altBandFt).toEqual([1000, 25000]);
    expect(decoded.camera).toEqual(camera);
  });

  it("returns empty state for garbage hash", () => {
    expect(decodeAppHash("#vs=not-valid-base64!!!")).toEqual({});
    expect(decodeAppHash("#other=1")).toEqual({});
  });

  it("drops invalid camera fields", () => {
    const raw = {
      basemap: "chart",
      camera: { lon: 200, lat: 51, range: 1000, heading: 0, pitch: -0.5 },
    };
    const fragment = `#vs=${btoa(JSON.stringify(raw))}`;
    expect(decodeAppHash(fragment).camera).toBeUndefined();
    expect(decodeAppHash(fragment).basemap).toBe("chart");
  });

  it("drops out-of-range range", () => {
    const raw = {
      camera: { lon: 0, lat: 51, range: MIN_RANGE - 1, heading: 0, pitch: -0.5 },
    };
    const fragment = `#vs=${btoa(JSON.stringify(raw))}`;
    expect(decodeAppHash(fragment).camera).toBeUndefined();
  });

  it("accepts range at bounds", () => {
    const raw = {
      camera: { lon: 0, lat: 51, range: MAX_RANGE, heading: 0, pitch: -0.5 },
    };
    const fragment = `#vs=${btoa(JSON.stringify(raw))}`;
    expect(decodeAppHash(fragment).camera?.range).toBe(MAX_RANGE);
  });

  it("ignores unknown keys without throwing", () => {
    const raw = { basemap: "satellite", extra: { nested: true }, tool: "route" };
    const fragment = `#vs=${btoa(JSON.stringify(raw))}`;
    const decoded = decodeAppHash(fragment);
    expect(decoded.basemap).toBe("satellite");
    expect(decoded.tool).toBe("route");
    expect(Object.keys(decoded)).not.toContain("extra");
  });
});
