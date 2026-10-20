/**
 * Rasterise a public-domain Natural Earth land outline into the opening basemap.
 * The PNG is equirectangular so Cesium can drape it with a geographic rectangle.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { OVERVIEW_BOUNDS, OVERVIEW_SIZE } from "../src/cesium/overviewMap.ts";

const SOURCE =
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/10m/physical/ne_10m_land.json";

const SEA = [214, 226, 234];
const LAND = [236, 234, 228];
const COAST = [148, 168, 184];

type Ring = [number, number][];
type Geom =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

const { west, south, east, north } = OVERVIEW_BOUNDS;
const { width, height } = OVERVIEW_SIZE;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 4, "ascii");
  const body = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, data, tail]);
}

function encodePng(rgb: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), row + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - west) / (east - west)) * (width - 1);
  const y = ((north - lat) / (north - south)) * (height - 1);
  return [x, y];
}

function bboxHits(ring: Ring): boolean {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minX) minX = lon;
    if (lon > maxX) maxX = lon;
    if (lat < minY) minY = lat;
    if (lat > maxY) maxY = lat;
  }
  return maxX >= west && minX <= east && maxY >= south && minY <= north;
}

function fillPolygon(mask: Uint8Array, rings: Ring[]) {
  const usable = rings.filter((ring) => ring.length >= 4 && bboxHits(ring));
  if (!usable.length) return;
  const edges: { y0: number; y1: number; x0: number; dx: number }[] = [];
  for (const ring of usable) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = project(ring[i][0], ring[i][1]);
      const [x1, y1] = project(ring[i + 1][0], ring[i + 1][1]);
      if (y0 === y1) continue;
      const yStart = y0 < y1 ? y0 : y1;
      const yEnd = y0 < y1 ? y1 : y0;
      edges.push({ y0: yStart, y1: yEnd, x0: y0 < y1 ? x0 : x1, dx: (x1 - x0) / (y1 - y0) });
    }
  }
  for (let y = 0; y < height; y++) {
    const xs: number[] = [];
    for (const edge of edges) {
      if (y + 0.5 < edge.y0 || y + 0.5 >= edge.y1) continue;
      xs.push(edge.x0 + (y + 0.5 - edge.y0) * edge.dx);
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      let x0 = Math.ceil(xs[i]);
      let x1 = Math.floor(xs[i + 1]);
      if (x0 < 0) x0 = 0;
      if (x1 >= width) x1 = width - 1;
      const row = y * width;
      for (let x = x0; x <= x1; x++) mask[row + x] = 1;
    }
  }
}

function strokeRing(rgb: Uint8Array, ring: Ring) {
  if (!bboxHits(ring)) return;
  for (let i = 0; i < ring.length - 1; i++) {
    let [x0, y0] = project(ring[i][0], ring[i][1]);
    let [x1, y1] = project(ring[i + 1][0], ring[i + 1][1]);
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    const steps = dx + dy + 1;
    for (let s = 0; s < steps; s++) {
      if (x >= 0 && y >= 0 && x < width && y < height) {
        const iPx = (y * width + x) * 3;
        rgb[iPx] = COAST[0];
        rgb[iPx + 1] = COAST[1];
        rgb[iPx + 2] = COAST[2];
      }
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
const geo = (await response.json()) as { features: { geometry: Geom }[] };

const mask = new Uint8Array(width * height);
let used = 0;
for (const feature of geo.features) {
  const geometry = feature.geometry;
  if (!geometry) continue;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of polygons) {
    if (!rings.some(bboxHits)) continue;
    fillPolygon(mask, rings);
    used += 1;
  }
}

const rgb = new Uint8Array(width * height * 3);
for (let i = 0; i < mask.length; i++) {
  const color = mask[i] ? LAND : SEA;
  rgb[i * 3] = color[0];
  rgb[i * 3 + 1] = color[1];
  rgb[i * 3 + 2] = color[2];
}
for (const feature of geo.features) {
  const geometry = feature.geometry;
  if (!geometry) continue;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of polygons) {
    if (!rings.some(bboxHits)) continue;
    for (const ring of rings) strokeRing(rgb, ring);
  }
}

const png = encodePng(rgb, width, height);
const out = resolve("public/basemap/uk-overview.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${used} polygons)`);
