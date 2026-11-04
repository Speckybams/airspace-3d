import { describe, expect, it } from "vitest";
import { decimateForDisplay } from "../src/lib/ringSimplify";

function circle(radiusDeg: number, points: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    out.push([-1 + Math.cos(a) * radiusDeg, 51 + Math.sin(a) * radiusDeg]);
  }
  return out;
}

describe("decimateForDisplay", () => {
  it("keeps a small round zone round close up", () => {
    // A 5 nm radius ATZ as shipped: 64 vertices.
    const ring = circle(0.083, 64);
    expect(decimateForDisplay(ring, false).length).toBeGreaterThanOrEqual(52);
  });

  it("keeps a round zone round whatever its size", () => {
    for (const radius of [0.03, 0.083, 0.25, 0.8]) {
      expect(decimateForDisplay(circle(radius, 64), false).length).toBeGreaterThanOrEqual(52);
    }
  });

  it("never draws more than the 64 vertices the data pack carries", () => {
    expect(decimateForDisplay(circle(0.5, 400), false).length).toBeLessThanOrEqual(64);
  });

  it("uses a cheaper ring for the flat overview plates", () => {
    const ring = circle(0.083, 64);
    const near = decimateForDisplay(ring, false).length;
    const far = decimateForDisplay(ring, true).length;
    expect(far).toBeLessThan(near);
    expect(far).toBeLessThanOrEqual(32);
    expect(far).toBeGreaterThanOrEqual(3);
  });

  it("still thins redundant points on a long straight border", () => {
    const ring: [number, number][] = [];
    for (let i = 0; i <= 40; i++) ring.push([i * 0.05, 51]);
    ring.push([2, 53], [0, 53]);
    expect(decimateForDisplay(ring, false).length).toBeLessThan(10);
  });

  it("leaves tiny rings alone", () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(decimateForDisplay(square, false)).toEqual(square);
  });
});
