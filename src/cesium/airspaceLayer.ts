import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineGeometry,
  Primitive,
  PrimitiveCollection,
  sampleTerrainMostDetailed,
  Ellipsoid,
  Math as CesiumMath,
  Ray,
  SceneTransforms,
  ShowGeometryInstanceAttribute,
  type Scene,
} from "cesium";
import { altitudeBandActive } from "@/lib/airspace-query";
import { CATEGORY_STYLES } from "@/lib/colors";
import { feetToMetres } from "@/lib/units";
import type { AirspaceCategory, AirspaceFeature } from "@/lib/types";
import { useAppStore } from "@/store/appStore";
import {
  createEdgeAppearance,
  createFillAppearance,
  type SliceBand,
} from "@/cesium/sliceAppearance";

/** How many volumes share one draw. Keeps an angled view from issuing thousands of draw calls. */
const BATCH_FEATURES = 36;
const BATCH_EDGES = 1800;
const SHOW_ON = [...ShowGeometryInstanceAttribute.toValue(true)];
const SHOW_OFF = [...ShowGeometryInstanceAttribute.toValue(false)];

/** Small zones are hard to tell apart, so their names appear at a smaller screen size. */
const EARLY_LABEL = new Set([
  "atz",
  "ctr",
  "danger",
  "restricted",
  "prohibited",
  "frz",
  "matz",
  "glider",
  "rmz",
  "tmz",
]);

const MAX_PILLS = 12;
/** Hover picks stay shallow; clicks drill deeper through stacked translucent fills. */
export const PICK_DRILL_HOVER = 16;
export const PICK_DRILL_CLICK = 32;

export interface AirspacePill {
  id: string;
  name: string;
  type: string;
  category: AirspaceCategory;
  accent: string;
  x: number;
  y: number;
}

interface VolumeRecord {
  feature: AirspaceFeature;
  fillColor: Color;
  /** Smaller values sort first when resolving stacked picks at one pixel. */
  footprint: number;
  west: number;
  south: number;
  east: number;
  north: number;
  anchor: Cartesian3;
  samples: Cartesian3[];
  /** Top-ring edge endpoints, stored as pairs, for border tags. */
  edgeEnds: Cartesian3[];
  edgeIds: string[];
  shown: boolean;
  showPending: boolean;
  fillPrimitive: Primitive | null;
  edgePrimitive: Primitive | null;
  showAttrs: { show: number[] }[] | null;
}

interface VolumeBatch {
  category: string;
  fill: Primitive;
  edges: Primitive;
  records: VolumeRecord[];
}

interface CategoryQueue {
  fills: GeometryInstance[];
  edges: GeometryInstance[];
  records: VolumeRecord[];
}

export class AirspaceLayer {
  readonly collection = new PrimitiveCollection();
  readonly selectionOutline = new PrimitiveCollection();
  private byId = new Map<string, VolumeRecord>();
  private batches: VolumeBatch[] = [];
  private queues = new Map<string, CategoryQueue>();
  private terrainHeights = new Map<string, number>();
  private readonly band: SliceBand = { u_low: 0, u_high: feetToMetres(66000) };
  private readonly fillAppearance = createFillAppearance(this.band);
  private readonly edgeAppearance = createEdgeAppearance(this.band);
  private cameraHeightM = 150_000;
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private labelsDirty = true;
  private settleAt = 0;
  private settlingAfterPan = false;
  private activePills: AirspacePill[] = [];
  private readonly pillTagWorld = new Map<string, Cartesian3>();
  private visKey = "";
  private hasPendingShows = true;
  private readonly camMark = new Cartesian3(Number.NaN, Number.NaN, Number.NaN);
  private readonly dirMark = new Cartesian3(Number.NaN, Number.NaN, Number.NaN);
  private readonly toCam = new Cartesian3();
  private readonly windowScratch = [new Cartesian2(), new Cartesian2(), new Cartesian2(), new Cartesian2()];
  private readonly edgeA = new Cartesian2();
  private readonly edgeB = new Cartesian2();
  private readonly tagAnchor = new Cartesian3();
  private readonly pickRay = new Ray();
  private readonly pickCarto = new Cartographic();

  async load(
    features: AirspaceFeature[],
    terrainProvider: Parameters<typeof sampleTerrainMostDetailed>[0],
    onProgress?: (fraction: number) => void,
  ) {
    this.clearHover();
    this.clearSelection();
    this.collection.removeAll();
    this.byId.clear();
    this.batches = [];
    this.queues.clear();
    this.terrainHeights.clear();
    this.labelsDirty = true;
    this.settlingAfterPan = false;
    this.activePills = [];
    this.pillTagWorld.clear();

    const terrainFeatures = features.filter((f) => f.lowerUsesTerrain);
    const samplePositions = terrainFeatures.map((f) => {
      const c = centroid(f.ring);
      return Cartographic.fromDegrees(c.lon, c.lat);
    });
    if (samplePositions.length && terrainProvider) {
      try {
        const updated = await sampleTerrainMostDetailed(terrainProvider, samplePositions);
        terrainFeatures.forEach((f, i) => {
          this.terrainHeights.set(f.id, updated[i]?.height ?? 0);
        });
      } catch {
        /* ignore */
      }
    }

    const total = features.length || 1;
    for (let i = 0; i < features.length; i++) {
      this.addFeature(features[i]);
      if (i % 40 === 0) {
        onProgress?.(i / total);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    for (const category of this.queues.keys()) this.flushCategory(category);
    onProgress?.(1);
    this.updateVisibility(this.cameraHeightM);
  }

  private heights(f: AirspaceFeature): { bottom: number; top: number } {
    const terrain = this.terrainHeights.get(f.id) ?? 0;
    const bottom = f.lowerUsesTerrain ? terrain + f.lower.ellipsoidM : f.lower.ellipsoidM;
    const top = Math.max(bottom + 1, f.upper.ellipsoidM);
    return { bottom, top };
  }

  private addFeature(f: AirspaceFeature) {
    const style = CATEGORY_STYLES[f.category];
    const { bottom, top } = this.heights(f);
    const ring = f.ring.slice(0, -1).length === f.ring.length - 1 ? f.ring : f.ring;
    const flat = ring[0][0] === ring[ring.length - 1][0] ? ring.slice(0, -1) : ring;

    const positions = flat.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
    const hierarchy = new PolygonHierarchy(positions);

    const fillColor = Color.fromCssColorString(style.fill);
    const outlineColor = Color.fromCssColorString(style.outline);
    const queue = this.queueFor(f.category);

    queue.fills.push(
      new GeometryInstance({
        geometry: new PolygonGeometry({
          polygonHierarchy: hierarchy,
          height: bottom,
          extrudedHeight: top,
          vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
          arcType: ArcType.GEODESIC,
        }),
        id: f.id,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(fillColor),
        },
      }),
    );

    const topLine: Cartesian3[] = [];
    const bottomLine: Cartesian3[] = [];
    for (const [lon, lat] of flat) {
      topLine.push(Cartesian3.fromDegrees(lon, lat, top));
      bottomLine.push(Cartesian3.fromDegrees(lon, lat, bottom));
    }
    const edgeIds: string[] = [];
    let edgeN = 0;
    const pushEdge = (positions: Cartesian3[]) => {
      const id = `${f.id}#${edgeN++}`;
      edgeIds.push(id);
      queue.edges.push(
        new GeometryInstance({
          geometry: new PolylineGeometry({ positions, width: 2, arcType: ArcType.GEODESIC }),
          id,
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(outlineColor) },
        }),
      );
    };
    pushEdge([...topLine, topLine[0]]);
    pushEdge([...bottomLine, bottomLine[0]]);
    for (let i = 0; i < flat.length; i++) pushEdge([bottomLine[i], topLine[i]]);

    const { west, south, east, north } = ringBounds(flat);
    const c = centroid(f.ring);
    const edgeEnds: Cartesian3[] = [];
    const edgeStep = Math.max(1, Math.ceil(flat.length / 32));
    for (let i = 0; i < flat.length; i += edgeStep) {
      const [lon1, lat1] = flat[i];
      const [lon2, lat2] = flat[(i + 1) % flat.length];
      edgeEnds.push(
        Cartesian3.fromDegrees(lon1, lat1, top),
        Cartesian3.fromDegrees(lon2, lat2, top),
      );
    }
    const rec: VolumeRecord = {
      feature: f,
      fillColor,
      footprint: ringFootprint(flat),
      west,
      south,
      east,
      north,
      anchor: Cartesian3.fromDegrees(c.lon, c.lat, top),
      samples: [
        Cartesian3.fromDegrees(west, south, top),
        Cartesian3.fromDegrees(east, south, top),
        Cartesian3.fromDegrees(east, north, top),
        Cartesian3.fromDegrees(west, north, top),
      ],
      edgeEnds,
      edgeIds,
      shown: true,
      showPending: false,
      fillPrimitive: null,
      edgePrimitive: null,
      showAttrs: null,
    };
    queue.records.push(rec);
    this.byId.set(f.id, rec);
    if (queue.fills.length >= BATCH_FEATURES || queue.edges.length >= BATCH_EDGES) {
      this.flushCategory(f.category);
    }
  }

  private queueFor(category: string): CategoryQueue {
    let queue = this.queues.get(category);
    if (!queue) {
      queue = { fills: [], edges: [], records: [] };
      this.queues.set(category, queue);
    }
    return queue;
  }

  private flushCategory(category: string) {
    const queue = this.queues.get(category);
    if (!queue || queue.fills.length === 0) return;
    const fill = this.collection.add(
      new Primitive({
        geometryInstances: queue.fills,
        appearance: this.fillAppearance,
        asynchronous: true,
        cull: true,
      }),
    );
    const edges = this.collection.add(
      new Primitive({
        geometryInstances: queue.edges,
        appearance: this.edgeAppearance,
        asynchronous: true,
        cull: true,
        allowPicking: false,
      }),
    );
    for (const rec of queue.records) {
      rec.fillPrimitive = fill;
      rec.edgePrimitive = edges;
    }
    this.batches.push({ category, fill, edges, records: queue.records });
    this.queues.set(category, { fills: [], edges: [], records: [] });
  }

  private writeShow(rec: VolumeRecord, show: boolean): boolean {
    const fill = rec.fillPrimitive;
    const edges = rec.edgePrimitive;
    if (!fill?.ready || !edges?.ready) return false;
    if (!rec.showAttrs) {
      try {
        const attrs = [fill.getGeometryInstanceAttributes(rec.feature.id)];
        for (const id of rec.edgeIds) attrs.push(edges.getGeometryInstanceAttributes(id));
        if (attrs.some((item) => !item)) return false;
        rec.showAttrs = attrs as { show: number[] }[];
      } catch {
        return false;
      }
    }
    const value = show ? SHOW_ON : SHOW_OFF;
    for (const attrs of rec.showAttrs) attrs.show = value;
    return true;
  }

  updateVisibility(cameraHeightM: number) {
    this.cameraHeightM = cameraHeightM;
    const { categoryVisible, isolateCategory, altBandFt } = useAppStore.getState();
    const visKey = `${isolateCategory ?? ""}|${altBandFt[0]}|${altBandFt[1]}|${categorySignature(categoryVisible)}`;
    if (visKey === this.visKey && !this.hasPendingShows) return;
    this.visKey = visKey;
    const bandLow = feetToMetres(altBandFt[0]);
    const bandHigh = feetToMetres(altBandFt[1]);
    this.band.u_low = bandLow;
    this.band.u_high = Math.max(bandLow + 1, bandHigh);
    let dirty = false;
    for (const batch of this.batches) {
      const categoryOn =
        categoryVisible[batch.category] !== false &&
        (isolateCategory === null || isolateCategory === batch.category);
      if (!categoryOn) {
        if (batch.fill.show || batch.edges.show) {
          batch.fill.show = false;
          batch.edges.show = false;
          for (const rec of batch.records) {
            rec.shown = false;
            rec.showPending = false;
          }
          dirty = true;
        }
        continue;
      }
      if (!batch.fill.show || !batch.edges.show) {
        batch.fill.show = true;
        batch.edges.show = true;
        dirty = true;
      }
      for (const rec of batch.records) {
        const terrain = this.terrainHeights.get(rec.feature.id) ?? 0;
        const show = altitudeBandActive(rec.feature, bandLow, bandHigh, terrain);
        if (show === rec.shown && !rec.showPending) continue;
        rec.shown = show;
        rec.showPending = !this.writeShow(rec, show);
        dirty = true;
      }
    }
    if (this.hoveredId && !this.byId.get(this.hoveredId)?.shown) {
      this.clearHover();
      dirty = true;
    }
    if (this.selectedId && !this.byId.get(this.selectedId)?.shown) {
      this.clearSelection();
      dirty = true;
    }
    if (dirty) this.labelsDirty = true;
    this.hasPendingShows = false;
    for (const batch of this.batches) {
      if (batch.records.some((rec) => rec.showPending)) {
        this.hasPendingShows = true;
        break;
      }
    }
  }

  getHoveredId(): string | null {
    return this.hoveredId;
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  setSelected(id: string | null) {
    const key = id ? this.featureKey(id) : null;
    if (key === this.selectedId) return;
    this.clearSelection();
    this.selectedId = key;
    if (!key) return;
    const rec = this.byId.get(key);
    if (!rec?.shown) {
      this.selectedId = null;
      return;
    }
    this.applySelectionFill(rec);
    this.addSelectionEdges(rec);
    if (this.hoveredId === key) this.clearHover();
  }

  setHovered(id: string | null) {
    const key = id ? this.featureKey(id) : null;
    if (key === this.hoveredId) return;
    id = key;
    this.clearHover();
    if (!id || id === this.selectedId) return;
    const rec = this.byId.get(this.featureKey(id));
    if (!rec?.shown) return;
    this.hoveredId = id;
    this.applyHoverFill(rec);
  }

  /** Screen pills for volumes large enough to read. Null when the camera has not moved. */
  layoutLabels(scene: Scene): AirspacePill[] | null {
    const camera = scene.camera;
    const position = camera.positionWC;
    const direction = camera.directionWC;
    if (Number.isNaN(this.camMark.x)) {
      Cartesian3.clone(position, this.camMark);
      Cartesian3.clone(direction, this.dirMark);
    }
    const moved =
      Math.abs(position.x - this.camMark.x) > 2 ||
      Math.abs(position.y - this.camMark.y) > 2 ||
      Math.abs(position.z - this.camMark.z) > 2 ||
      Math.abs(direction.x - this.dirMark.x) > 0.002 ||
      Math.abs(direction.y - this.dirMark.y) > 0.002 ||
      Math.abs(direction.z - this.dirMark.z) > 0.002;
    if (moved) {
      Cartesian3.clone(position, this.camMark);
      Cartesian3.clone(direction, this.dirMark);
      this.labelsDirty = true;
      this.settlingAfterPan = true;
      this.settleAt = performance.now() + 180;
      if (this.activePills.length === 0) return [];
      return this.layoutLabelsTrack(scene);
    }

    if (!this.labelsDirty) return null;

    const readyForFull =
      this.activePills.length === 0 ||
      !this.settlingAfterPan ||
      performance.now() >= this.settleAt;
    if (readyForFull) {
      this.settlingAfterPan = false;
      this.labelsDirty = false;
      const pills = this.layoutLabelsFull(scene);
      this.activePills = pills;
      Cartesian3.clone(position, this.camMark);
      Cartesian3.clone(direction, this.dirMark);
      return pills;
    }

    return this.layoutLabelsTrack(scene);
  }

  private layoutLabelsFull(scene: Scene): AirspacePill[] {
    const camera = scene.camera;
    const position = camera.positionWC;
    const direction = camera.directionWC;
    const width = scene.canvas.clientWidth;
    const height = scene.canvas.clientHeight;
    const candidates: { pill: AirspacePill; depth: number; w: number; h: number }[] = [];
    this.pillTagWorld.clear();

    for (const rec of this.byId.values()) {
      if (!rec.shown) continue;
      Cartesian3.subtract(rec.anchor, position, this.toCam);
      const depth = Cartesian3.dot(this.toCam, direction);
      if (depth <= 0) continue;

      const border = this.borderTagPoint(scene, rec);
      if (!border) continue;
      const x = border.x;
      const y = border.y;
      this.pillTagWorld.set(rec.feature.id, Cartesian3.clone(border.world));
      const name = pillName(rec.feature.name, rec.feature.category);
      const type = rec.feature.category.toUpperCase();
      const pillW = Math.ceil(name.length * 7.3 + type.length * 6.2 + 18);
      const pillH = 22;
      if (x < pillW / 2 + 4 || y < pillH / 2 + 4 || x > width - pillW / 2 - 4 || y > height - pillH / 2 - 4) {
        continue;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let seen = 0;
      for (let i = 0; i < rec.samples.length; i++) {
        const projected = SceneTransforms.worldToWindowCoordinates(scene, rec.samples[i], this.windowScratch[i]);
        if (!projected) continue;
        seen += 1;
        if (projected.x < minX) minX = projected.x;
        if (projected.y < minY) minY = projected.y;
        if (projected.x > maxX) maxX = projected.x;
        if (projected.y > maxY) maxY = projected.y;
      }
      if (seen < 2) continue;
      const span = Math.max(maxX - minX, maxY - minY);
      const minimum = EARLY_LABEL.has(rec.feature.category) ? 48 : 80;
      if (span < minimum) continue;

      candidates.push({
        pill: {
          id: rec.feature.id,
          name,
          type,
          category: rec.feature.category,
          accent: CATEGORY_STYLES[rec.feature.category].outline,
          x,
          y,
        },
        depth,
        w: pillW,
        h: pillH,
      });
    }

    return this.packLabelCandidates(candidates);
  }

  /** Reposition the current label set without changing which volumes are tagged. */
  private layoutLabelsTrack(scene: Scene): AirspacePill[] {
    const width = scene.canvas.clientWidth;
    const height = scene.canvas.clientHeight;
    const pills: AirspacePill[] = [];
    for (const pill of this.activePills) {
      const rec = this.byId.get(pill.id);
      if (!rec?.shown) {
        pills.push({ ...pill, x: Number.NaN, y: Number.NaN });
        continue;
      }
      const world = this.pillTagWorld.get(pill.id) ?? rec.anchor;
      const projected = SceneTransforms.worldToWindowCoordinates(scene, world, this.edgeA);
      const pillW = Math.ceil(pill.name.length * 7.3 + pill.type.length * 6.2 + 18);
      const pillH = 22;
      if (
        !projected ||
        projected.x < pillW / 2 + 4 ||
        projected.y < pillH / 2 + 4 ||
        projected.x > width - pillW / 2 - 4 ||
        projected.y > height - pillH / 2 - 4
      ) {
        pills.push({ ...pill, x: Number.NaN, y: Number.NaN });
        continue;
      }
      pills.push({ ...pill, x: projected.x, y: projected.y });
    }
    return pills;
  }

  private packLabelCandidates(
    candidates: { pill: AirspacePill; depth: number; w: number; h: number }[],
  ): AirspacePill[] {
    candidates.sort((a, b) => a.depth - b.depth);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const pills: AirspacePill[] = [];
    for (const candidate of candidates) {
      if (pills.length >= MAX_PILLS) break;
      const rect = {
        x: candidate.pill.x - candidate.w / 2 - 4,
        y: candidate.pill.y - candidate.h / 2 - 4,
        w: candidate.w + 8,
        h: candidate.h + 8,
      };
      const hit = placed.some(
        (other) =>
          rect.x < other.x + other.w &&
          rect.x + rect.w > other.x &&
          rect.y < other.y + other.h &&
          rect.y + rect.h > other.y,
      );
      if (hit) continue;
      placed.push(rect);
      pills.push(candidate.pill);
    }
    return pills;
  }

  private applyHoverFill(rec: VolumeRecord) {
    try {
      const attrs = rec.fillPrimitive?.getGeometryInstanceAttributes(rec.feature.id);
      if (!attrs) return;
      attrs.color = ColorGeometryInstanceAttribute.toValue(lighten(rec.fillColor, 0.55, 0.28));
    } catch {
      /* The primitive has not uploaded yet. */
    }
  }

  private restoreFill(rec: VolumeRecord) {
    try {
      const attrs = rec.fillPrimitive?.getGeometryInstanceAttributes(rec.feature.id);
      if (!attrs) return;
      attrs.color = ColorGeometryInstanceAttribute.toValue(rec.fillColor);
    } catch {
      /* The primitive has not uploaded yet. */
    }
  }

  private addSelectionEdges(rec: VolumeRecord) {
    const edge = Color.fromCssColorString("#f8fafc");
    edge.alpha = 1;
    this.addVolumeOutline(this.selectionOutline, rec, edge, 4);
  }

  private addVolumeOutline(
    target: PrimitiveCollection,
    rec: VolumeRecord,
    outline: Color,
    width: number,
  ) {
    const { bottom, top } = this.heights(rec.feature);
    const flat = openRing(rec.feature.ring);
    const edgeInstances: GeometryInstance[] = [];
    const color = ColorGeometryInstanceAttribute.fromColor(outline);
    for (let i = 0; i < flat.length; i++) {
      const [lon1, lat1] = flat[i];
      const [lon2, lat2] = flat[(i + 1) % flat.length];
      const groundA = Cartesian3.fromDegrees(lon1, lat1, bottom);
      const groundB = Cartesian3.fromDegrees(lon2, lat2, bottom);
      const topA = Cartesian3.fromDegrees(lon1, lat1, top);
      const topB = Cartesian3.fromDegrees(lon2, lat2, top);
      edgeInstances.push(
        new GeometryInstance({
          geometry: new PolylineGeometry({ positions: [groundA, groundB], width }),
          attributes: { color },
        }),
        new GeometryInstance({
          geometry: new PolylineGeometry({ positions: [topA, topB], width }),
          attributes: { color },
        }),
        new GeometryInstance({
          geometry: new PolylineGeometry({ positions: [groundA, topA], width }),
          attributes: { color },
        }),
      );
    }
    target.add(
      new Primitive({
        geometryInstances: edgeInstances,
        appearance: this.edgeAppearance,
        asynchronous: false,
        allowPicking: false,
      }),
    );
  }

  private applySelectionFill(rec: VolumeRecord) {
    try {
      const attrs = rec.fillPrimitive?.getGeometryInstanceAttributes(rec.feature.id);
      if (!attrs) return;
      attrs.color = ColorGeometryInstanceAttribute.toValue(lighten(rec.fillColor, 0.48, 0.22));
    } catch {
      /* The primitive has not uploaded yet. */
    }
  }

  private clearHover() {
    if (this.hoveredId && this.hoveredId !== this.selectedId) {
      const rec = this.byId.get(this.hoveredId);
      if (rec) this.restoreFill(rec);
    }
    this.hoveredId = null;
  }

  private clearSelection() {
    if (this.selectedId) {
      const rec = this.byId.get(this.selectedId);
      if (rec) this.restoreFill(rec);
    }
    this.selectedId = null;
    this.selectionOutline.removeAll();
  }

  getFeatureAt(id: string): AirspaceFeature | undefined {
    return this.byId.get(this.featureKey(id))?.feature;
  }

  /**
   * Resolve stacked volumes at a screen pixel. Default prefers the smallest footprint
   * (nested ATZ/CTR inside TMA). Hold Alt for the front-most / largest enclosing volume.
   */
  pickFeatureIdAt(
    scene: Scene,
    windowPosition: Cartesian2,
    preferTopmost: boolean,
    drillLimit = PICK_DRILL_CLICK,
  ): string | null {
    if (preferTopmost) {
      const top = this.idFromPick(scene.pick(windowPosition));
      if (top) return top;
    }

    const merged = new Map<string, { footprint: number; order: number }>();
    let order = 0;
    const picked = scene.drillPick(windowPosition, drillLimit);
    for (let i = 0; i < picked.length; i++) {
      const id = this.idFromPick(picked[i]);
      if (!id || merged.has(id)) continue;
      merged.set(id, { footprint: this.byId.get(id)!.footprint, order: order++ });
    }

    if (drillLimit >= PICK_DRILL_CLICK && !preferTopmost) {
      for (const hit of this.geoHitsAtScreen(scene, windowPosition)) {
        if (merged.has(hit.id)) continue;
        merged.set(hit.id, { footprint: hit.footprint, order: order++ });
      }
    }

    if (merged.size === 0) return null;
    const hits = [...merged.entries()].map(([id, meta]) => ({ id, ...meta }));
    if (preferTopmost) {
      hits.sort((a, b) => b.footprint - a.footprint || a.order - b.order);
    } else {
      hits.sort((a, b) => a.footprint - b.footprint || a.order - b.order);
    }
    return hits[0]?.id ?? null;
  }

  /** Fallback when GPU drill finds nothing: volumes containing the pick ray hit point. */
  private geoHitsAtScreen(scene: Scene, windowPosition: Cartesian2): { id: string; footprint: number }[] {
    const ray = scene.camera.getPickRay(windowPosition, this.pickRay);
    if (!ray) return [];
    const pos = scene.pickPosition(windowPosition) ?? scene.globe.pick(ray, scene);
    if (!pos) return [];
    Cartographic.fromCartesian(pos, Ellipsoid.WGS84, this.pickCarto);
    const lon = CesiumMath.toDegrees(this.pickCarto.longitude);
    const lat = CesiumMath.toDegrees(this.pickCarto.latitude);
    const altM = this.pickCarto.height;
    const terrainH = scene.globe.getHeight(this.pickCarto) ?? 0;
    const hits: { id: string; footprint: number }[] = [];
    for (const rec of this.byId.values()) {
      if (!rec.shown) continue;
      if (lon < rec.west || lon > rec.east || lat < rec.south || lat > rec.north) continue;
      if (!pointInRingLocal(lon, lat, rec.feature.ring)) continue;
      const f = rec.feature;
      const lower = f.lowerUsesTerrain ? terrainH + f.lower.ellipsoidM : f.lower.ellipsoidM;
      const upper = f.upper.ellipsoidM;
      if (altM < lower || altM > upper) continue;
      hits.push({ id: f.id, footprint: rec.footprint });
    }
    return hits;
  }

  private idFromPick(picked: unknown): string | null {
    if (typeof picked !== "object" || picked === null) return null;
    const raw = (picked as { id?: unknown }).id;
    if (typeof raw !== "string") return null;
    const id = this.featureKey(raw);
    const rec = this.byId.get(id);
    if (!rec?.shown) return null;
    return id;
  }

  /** Midpoint of the longest, flattest on-screen edge so the tag sits in the outline. */
  private borderTagPoint(
    scene: Scene,
    rec: VolumeRecord,
  ): { x: number; y: number; world: Cartesian3 } | null {
    let best = -1;
    let x = 0;
    let y = 0;
    const ends = rec.edgeEnds;
    for (let i = 0; i < ends.length; i += 2) {
      const a = SceneTransforms.worldToWindowCoordinates(scene, ends[i], this.edgeA);
      if (!a) continue;
      const ax = a.x;
      const ay = a.y;
      const b = SceneTransforms.worldToWindowCoordinates(scene, ends[i + 1], this.edgeB);
      if (!b) continue;
      const dx = b.x - ax;
      const dy = b.y - ay;
      const len = Math.hypot(dx, dy);
      if (len < 28) continue;
      const horizontal = 1 - Math.min(1, Math.abs(dy) / len);
      const score = len * (0.4 + horizontal);
      if (score <= best) continue;
      best = score;
      x = (ax + b.x) / 2;
      y = (ay + b.y) / 2;
      Cartesian3.midpoint(ends[i], ends[i + 1], this.tagAnchor);
    }
    if (best < 0) return null;
    return { x, y, world: this.tagAnchor };
  }

  private featureKey(id: string): string {
    const cut = id.indexOf("#");
    return cut === -1 ? id : id.slice(0, cut);
  }
}

function categorySignature(visible: Record<string, boolean | undefined>): string {
  let key = "";
  for (const id of Object.keys(visible)) {
    if (visible[id] === false) key += `${id},`;
  }
  return key;
}

function ringFootprint(flat: [number, number][]): number {
  if (flat.length < 3) return Infinity;
  let sum = 0;
  for (let i = 0; i < flat.length; i++) {
    const j = (i + 1) % flat.length;
    sum += flat[i][0] * flat[j][1] - flat[j][0] * flat[i][1];
  }
  return Math.abs(sum);
}

function openRing(ring: [number, number][]): [number, number][] {
  const closed =
    ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  return closed ? ring.slice(0, -1) : ring;
}

function pointInRingLocal(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = yi > lat !== yj > lat;
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringBounds(ring: [number, number][]): { west: number; south: number; east: number; north: number } {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lat < south) south = lat;
    if (lon > east) east = lon;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

function pillName(name: string, category: string): string {
  const cat = category.toUpperCase();
  const upper = name.toUpperCase().replace(/\s+/g, " ").trim();
  const stripped = upper.replace(new RegExp(`\\s+${cat}$`), "").trim();
  const label = stripped || upper;
  return label.length > 24 ? `${label.slice(0, 23)}…` : label;
}

function lighten(color: Color, toward: number, alphaBoost: number): Color {
  return new Color(
    color.red + (1 - color.red) * toward,
    color.green + (1 - color.green) * toward,
    color.blue + (1 - color.blue) * toward,
    Math.min(0.78, color.alpha + alphaBoost),
  );
}

function centroid(ring: [number, number][]): { lon: number; lat: number } {
  let lon = 0;
  let lat = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    lon += ring[i][0];
    lat += ring[i][1];
  }
  return { lon: lon / n, lat: lat / n };
}
