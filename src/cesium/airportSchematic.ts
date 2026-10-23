import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  HeadingPitchRoll,
  Math as CesiumMath,
  Matrix4,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  Primitive,
  PrimitiveCollection,
  Transforms,
} from "cesium";
import type { AirportFeature } from "@/lib/types";

const DEFAULT_WIDTH_M = 45;
const SCHEMATIC_MAX_RANGE_M = 4_000;
const SCHEMATIC_MAX_GROUND_M = 4_000;

function primaryRunway(apt: AirportFeature) {
  let best = apt.runways.find((r) => r.trueHeading != null && r.lengthM && r.lengthM > 0);
  if (!best) {
    best = apt.runways.find((r) => r.lengthM && r.lengthM > 0);
  }
  return best;
}

function nearestAirport(
  airports: AirportFeature[],
  lat: number,
  lon: number,
): { apt: AirportFeature; distM: number } | null {
  let best: AirportFeature | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const apt of airports) {
    const dLat = (apt.lat - lat) * 111_000;
    const dLon = (apt.lon - lon) * 111_000 * Math.cos(CesiumMath.toRadians(lat));
    const d = Math.hypot(dLat, dLon);
    if (d < bestD) {
      bestD = d;
      best = apt;
    }
  }
  if (!best || bestD > SCHEMATIC_MAX_GROUND_M) return null;
  const rwy = primaryRunway(best);
  if (!rwy?.trueHeading) return null;
  return { apt: best, distM: bestD };
}

export class AirportSchematicLayer {
  readonly collection = new PrimitiveCollection();
  private captionEl: HTMLDivElement | null = null;
  private shownId: string | null = null;

  sync(
    container: HTMLElement,
    airports: AirportFeature[],
    lat: number,
    lon: number,
    cameraHeightM: number,
    onOpenGuide: () => void,
  ) {
    if (cameraHeightM > SCHEMATIC_MAX_RANGE_M) {
      this.hide(container);
      return;
    }
    const hit = nearestAirport(airports, lat, lon);
    if (!hit) {
      this.hide(container);
      return;
    }
    const { apt } = hit;
    const rwy = primaryRunway(apt);
    if (!rwy?.trueHeading) {
      this.hide(container);
      return;
    }
    if (this.shownId !== apt.id) {
      this.rebuild(apt, rwy);
      this.shownId = apt.id;
    }
    this.showCaption(container, apt, rwy.designator, onOpenGuide);
  }

  hide(_container: HTMLElement) {
    this.collection.removeAll();
    this.shownId = null;
    if (this.captionEl) {
      this.captionEl.remove();
      this.captionEl = null;
    }
  }

  private showCaption(
    container: HTMLElement,
    apt: AirportFeature,
    designator: string,
    onOpenGuide: () => void,
  ) {
    if (!this.captionEl) {
      const el = document.createElement("div");
      el.className = "airport-schematic-caption";
      el.innerHTML =
        '<p class="airport-schematic-title"></p><p class="airport-schematic-note muted tiny">Schematic layout — not surveyed.</p><button type="button" class="btn airport-schematic-guide">Runway guide</button>';
      container.append(el);
      this.captionEl = el;
      el.querySelector(".airport-schematic-guide")?.addEventListener("click", onOpenGuide);
    }
    const title = this.captionEl.querySelector(".airport-schematic-title");
    if (title) {
      title.textContent = `${apt.icao ?? apt.name} · RWY ${designator} (schematic)`;
    }
    this.captionEl.style.display = "block";
  }

  private rebuild(
    apt: AirportFeature,
    rwy: NonNullable<ReturnType<typeof primaryRunway>>,
  ) {
    this.collection.removeAll();
    const lengthM = Math.max(600, rwy.lengthM ?? 1200);
    const widthM = rwy.widthM ?? DEFAULT_WIDTH_M;
    const heading = CesiumMath.toRadians(rwy.trueHeading ?? 0);
    const center = Cartesian3.fromDegrees(apt.lon, apt.lat, apt.elevationFt ? apt.elevationFt * 0.3048 : 0);
    const hpr = new HeadingPitchRoll(heading, 0, 0);
    const modelMatrix = Transforms.headingPitchRollToFixedFrame(center, hpr);

    const halfL = lengthM / 2;
    const halfW = widthM / 2;
    const localCorners = [
      new Cartesian3(-halfL, -halfW, 0),
      new Cartesian3(halfL, -halfW, 0),
      new Cartesian3(halfL, halfW, 0),
      new Cartesian3(-halfL, halfW, 0),
    ];
    const world = localCorners.map((c) => Matrix4.multiplyByPoint(modelMatrix, c, new Cartesian3()));

    const surface = Color.fromCssColorString("#334155").withAlpha(0.85);
    this.collection.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new PolygonGeometry({
            polygonHierarchy: new PolygonHierarchy(world),
            height: center.z,
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(surface) },
        }),
        appearance: new PerInstanceColorAppearance({ closed: true, flat: true }),
        asynchronous: false,
      }),
    );

    const white = Color.fromCssColorString("#f8fafc");
    const z = center.z + 0.5;
    const midL = Matrix4.multiplyByPoint(modelMatrix, new Cartesian3(-halfL * 0.85, 0, 0), new Cartesian3());
    const midR = Matrix4.multiplyByPoint(modelMatrix, new Cartesian3(halfL * 0.85, 0, 0), new Cartesian3());
    midL.z = z;
    midR.z = z;
    this.addLine([midL, midR], white, 3);

    const barW = widthM * 0.6;
    for (const x of [-halfL * 0.92, halfL * 0.92]) {
      const a = Matrix4.multiplyByPoint(modelMatrix, new Cartesian3(x, -barW / 2, 0), new Cartesian3());
      const b = Matrix4.multiplyByPoint(modelMatrix, new Cartesian3(x, barW / 2, 0), new Cartesian3());
      a.z = z;
      b.z = z;
      this.addLine([a, b], white, 4);
    }

    const towerBase = Matrix4.multiplyByPoint(
      modelMatrix,
      new Cartesian3(-halfL * 0.35, halfW * 1.8, 0),
      new Cartesian3(),
    );
    const towerTop = Cartesian3.clone(towerBase);
    towerTop.z += 18;
    this.addLine([towerBase, towerTop], Color.fromCssColorString("#94a3b8"), 6);
  }

  private addLine(positions: Cartesian3[], color: Color, width: number) {
    this.collection.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new PolylineGeometry({ positions, width }),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
        }),
        appearance: new PerInstanceColorAppearance({ closed: false, flat: true }),
        asynchronous: false,
        allowPicking: false,
      }),
    );
  }
}
