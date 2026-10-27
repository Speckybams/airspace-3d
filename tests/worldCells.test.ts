import { describe, expect, it } from "vitest";
import { cellIdFor, cellsInView, sortCellsFrom, viewRectangleFromCamera } from "@/lib/worldCells";

describe("worldCells", () => {
  it("bins lat/lon into 10 degree cells", () => {
    expect(cellIdFor(51.5, -0.5)).toBe("50_-10");
    expect(cellIdFor(-5, -15)).toBe("-10_-20");
  });

  it("lists cells intersecting a view box", () => {
    const ids = cellsInView(50, -2, 52, 1, 0);
    expect(ids).toContain("50_-10");
  });

  it("keeps a London regional view to the cells on screen", () => {
    const rect = viewRectangleFromCamera(-0.45, 51.47, 120_000);
    const ids = sortCellsFrom(cellsInView(rect.south, rect.west, rect.north, rect.east), 51.47, -0.45);
    expect(ids[0]).toBe("50_-10");
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(ids).not.toContain("30_-20");
  });
});
