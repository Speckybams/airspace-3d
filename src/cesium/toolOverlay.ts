import {
  Cartesian3,
  Cartographic,
  Color,
  PointPrimitiveCollection,
  PolylineCollection,
  PrimitiveCollection,
} from "cesium";
import type { MapToolState, ToolMode } from "@/lib/types";

const MARKER = Color.fromCssColorString("#22d3ee");
const LINE = Color.fromCssColorString("#38bdf8");
const ROUTE = Color.fromCssColorString("#a78bfa");

function toPos(lon: number, lat: number, heightM = 4): Cartesian3 {
  return Cartesian3.fromDegrees(lon, lat, heightM);
}

export class ToolOverlayLayer {
  readonly collection = new PrimitiveCollection();
  private points = new PointPrimitiveCollection();
  private lines = new PolylineCollection();

  constructor() {
    this.collection.add(this.lines);
    this.collection.add(this.points);
  }

  sync(tool: ToolMode, state: MapToolState) {
    this.points.removeAll();
    this.lines.removeAll();

    if (tool === "query" && state.query) {
      const { lon, lat } = state.query;
      this.points.add({
        position: toPos(lon, lat, 8),
        color: MARKER,
        pixelSize: 14,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }

    if (tool === "measure" && state.measure.length > 0) {
      for (const p of state.measure) {
        this.points.add({
          position: toPos(p.lon, p.lat, 6),
          color: MARKER,
          pixelSize: 10,
          outlineColor: Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
      }
      if (state.measure.length >= 2) {
        const positions = state.measure.map((p) => toPos(p.lon, p.lat, 5));
        this.lines.add({ positions, width: 3, material: LINE });
      }
    }

    if (tool === "crossSection" && state.section.length > 0) {
      for (const p of state.section) {
        this.points.add({
          position: toPos(p.lon, p.lat, 6),
          color: MARKER,
          pixelSize: 12,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
      }
      if (state.section.length === 2) {
        const [a, b] = state.section;
        this.lines.add({
          positions: [toPos(a.lon, a.lat, 5), toPos(b.lon, b.lat, 5)],
          width: 4,
          material: LINE,
        });
      }
    }

    if (tool === "route" && state.route.length > 0) {
      for (const p of state.route) {
        this.points.add({
          position: toPos(p.lon, p.lat, 6),
          color: ROUTE,
          pixelSize: p.label ? 12 : 10,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
      }
      if (state.route.length >= 2) {
        const positions = state.route.map((p) => toPos(p.lon, p.lat, 5));
        this.lines.add({ positions, width: 3, material: ROUTE });
      }
    }
  }

  /** Sample terrain ellipsoid height at lon/lat (sync; requires globe heights loaded). */
  static terrainHeight(scene: { globe: { getHeight: (c: Cartographic) => number | undefined } }, lon: number, lat: number): number {
    const carto = Cartographic.fromDegrees(lon, lat);
    return scene.globe.getHeight(carto) ?? 0;
  }

  destroy() {
    this.collection.removeAll();
  }
}
