import { describe, expect, it } from "vitest";
import { cellIdFor, cellsInView } from "@/lib/worldCells";

describe("worldCells", () => {
  it("bins lat/lon into 10 degree cells", () => {
    expect(cellIdFor(51.5, -0.5)).toBe("50_-10");
    expect(cellIdFor(-5, -15)).toBe("-10_-20");
  });

  it("lists cells intersecting a view box", () => {
    const ids = cellsInView(50, -2, 52, 1, 0);
    expect(ids).toContain("50_-10");
  });
});
