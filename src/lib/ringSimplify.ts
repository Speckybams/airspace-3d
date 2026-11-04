interface RingLod {
  /** Allowed deviation as a fraction of the ring's widest side. */
  relative: number;
  /** Absolute floor and ceiling for the deviation, degrees. */
  floorDeg: number;
  ceilDeg: number;
  maxPoints: number;
}

/**
 * Close up: keep round zones round. A 0.07% deviation keeps about 55 of 64 spokes on a circle
 * and still thins long straight borders. The data pack never carries more than 64 vertices.
 */
const NEAR_LOD: RingLod = { relative: 0.0007, floorDeg: 0.00002, ceilDeg: 0.0015, maxPoints: 64 };
/** Flat plates seen from very high up: cheap to build, since these are made on the main thread. */
const OVERVIEW_LOD: RingLod = { relative: 0.006, floorDeg: 0.002, ceilDeg: 0.02, maxPoints: 32 };

function ringSpanDeg(ring: [number, number][]): number {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return Math.max(east - west, north - south);
}

/**
 * Ring to draw. The tolerance scales with the zone's own size, so a small circular ATZ keeps
 * its spokes while a large irregular TMA is still thinned.
 */
export function decimateForDisplay(ring: [number, number][], overview: boolean): [number, number][] {
  const lod = overview ? OVERVIEW_LOD : NEAR_LOD;
  const tolerance = Math.min(lod.ceilDeg, Math.max(lod.floorDeg, ringSpanDeg(ring) * lod.relative));
  return decimateRing(ring, tolerance, lod.maxPoints);
}

/** Drop ring vertices that sit within `toleranceDeg` of a chord, then tighten until `maxPoints`. */
export function decimateRing(
  ring: [number, number][],
  toleranceDeg: number,
  maxPoints: number,
): [number, number][] {
  const open =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring.slice();
  if (open.length <= 4) return open;
  let tol = Math.max(1e-8, toleranceDeg);
  let simplified = simplifyClosed(open, tol);
  let guard = 0;
  while (simplified.length > maxPoints && guard < 8) {
    tol *= 1.7;
    simplified = simplifyClosed(open, tol);
    guard += 1;
  }
  if (simplified.length < 3) {
    return [open[0], open[Math.floor(open.length / 2)], open[open.length - 1]];
  }
  return simplified;
}

function simplifyClosed(open: [number, number][], tolerance: number): [number, number][] {
  const simplified = douglasPeucker([...open, open[0]], tolerance);
  if (
    simplified.length > 1 &&
    simplified[0][0] === simplified[simplified.length - 1][0] &&
    simplified[0][1] === simplified[simplified.length - 1][1]
  ) {
    simplified.pop();
  }
  return simplified;
}

function douglasPeucker(points: [number, number][], tolerance: number): [number, number][] {
  const n = points.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distanceToSegment(points[i], points[a], points[b]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tolerance) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function distanceToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
