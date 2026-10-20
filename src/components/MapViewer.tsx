import { useEffect, useRef } from "react";
import {
  Cartesian2,
  Cartographic,
  CesiumWidget,
  Color,
  createWorldTerrainAsync,
  Ellipsoid,
  EllipsoidTerrainProvider,
  ImageryLayer,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math as CesiumMath,
  type Scene,
} from "cesium";
import { AirspaceLayer, PICK_DRILL_CLICK, PICK_DRILL_HOVER } from "@/cesium/airspaceLayer";
import { BASE_IMAGERY_LAYERS, createBasemapLayer, createOverviewLayer, setIonToken } from "@/cesium/basemaps";
import { hideIonUpsell } from "@/cesium/credits";
import { attachOrbitCamera, type OrbitCamera } from "@/cesium/orbitCamera";
import { OVERVIEW_SEA } from "@/cesium/overviewMap";
import { applyAirspace3dSky, setSharpGlobe } from "@/cesium/skybox";
import { airspacesAtPoint } from "@/lib/airspace-query";
import { feetToMetres } from "@/lib/units";
import { viewRangeMetres } from "@/lib/viewRange";
import type { AirspaceFeature } from "@/lib/types";
import { useAppStore } from "@/store/appStore";

interface Props {
  airspaces: AirspaceFeature[];
  onPickAirspace: (f: AirspaceFeature | null) => void;
  onQueryResults?: (ids: string[]) => void;
  onCameraChange?: (lon: number, lat: number, heightM: number, heading: number) => void;
}

export function MapViewer({
  airspaces,
  onPickAirspace,
  onQueryResults,
  onCameraChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<CesiumWidget | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const overlayRef = useRef<{ labelsHost: HTMLDivElement; tip: HTMLDivElement } | null>(null);
  const layerRef = useRef<AirspaceLayer | null>(null);
  const orbitRef = useRef<OrbitCamera | null>(null);
  const basemap = useAppStore((s) => s.basemap);
  const categoryVisible = useAppStore((s) => s.categoryVisible);
  const altBandFt = useAppStore((s) => s.altBandFt);
  const isolateCategory = useAppStore((s) => s.isolateCategory);
  const terrainExaggeration = useAppStore((s) => s.terrainExaggeration);
  const tool = useAppStore((s) => s.tool);
  const queryAltFt = useAppStore((s) => s.queryAltFt);
  const chartTopDown = useAppStore((s) => s.chartTopDown);
  const cameraRequest = useAppStore((s) => s.cameraRequest);
  const requestCamera = useAppStore((s) => s.requestCamera);
  const selectedAirspaceId = useAppStore((s) => s.selectedAirspaceId);
  const setSatelliteNotice = useAppStore((s) => s.setSatelliteNotice);
  const appliedBasemap = useRef<typeof basemap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let stopCredits: (() => void) | undefined;
    let onKey: ((event: KeyboardEvent) => void) | undefined;
    const token = import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN ?? "";
    setIonToken(token);
    const setLoad = (value: number | null) => {
      if (!cancelled) useAppStore.getState().setLoadProgress(value);
    };
    setLoad(0.04);

    (async () => {
      try {
      if (cancelled || !containerRef.current) return;
      const widget = new CesiumWidget(containerRef.current, {
        terrainProvider: new EllipsoidTerrainProvider(),
        baseLayer: false,
        scene3DOnly: true,
        // Overlapping translucent volumes are cheaper without the extra OIT pass.
        orderIndependentTranslucency: false,
      });
      widgetRef.current = widget;
      stopCredits = hideIonUpsell(widget.creditContainer);
      const scene = widget.scene;
      scene.globe.enableLighting = false;
      scene.globe.baseColor = Color.fromCssColorString(OVERVIEW_SEA);
      setSharpGlobe(scene);
      scene.imageryLayers.add(
        new ImageryLayer(
          new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
        ),
      );
      const overview = createOverviewLayer();
      scene.imageryLayers.add(overview);
      widget.resize();
      orbitRef.current = attachOrbitCamera(scene);
      const pending = useAppStore.getState().cameraRequest;
      if (pending) orbitRef.current.flyTo(pending.lon, pending.lat, pending.range);
      scene.requestRender();
      setLoad(0.16);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (cancelled) return;

      try {
        await applyAirspace3dSky(scene);
      } catch (skyError) {
        console.warn("Sky setup skipped", skyError);
      }
      if (cancelled) return;
      setLoad(0.28);

      const osKey = import.meta.env.VITE_OS_API_KEY ?? "";
      const openingBasemap = useAppStore.getState().basemap;
      const { layer, notice } = await createBasemapLayer(openingBasemap, osKey);
      if (cancelled) return;
      const chartReady = waitForTiles(scene, (fraction) => setLoad(0.28 + fraction * 0.3));
      scene.imageryLayers.add(layer);
      appliedBasemap.current = openingBasemap;
      scene.requestRender();
      let holdNotice = notice ?? null;
      await chartReady;
      if (cancelled) return;
      fadeOutImagery(overview, scene);

      let terrain = widget.terrainProvider;
      setLoad(0.62);
      if (token) {
        try {
          terrain = await createWorldTerrainAsync();
          if (cancelled) return;
          scene.terrainProvider = terrain;
        } catch (terrainError) {
          console.warn(terrainError);
          holdNotice = "Cesium terrain did not load. Check the ion token.";
        }
      }
      if (cancelled) return;
      setLoad(0.74);

      const airLayer = new AirspaceLayer();
      layerRef.current = airLayer;
      scene.primitives.add(airLayer.collection);
      scene.primitives.add(airLayer.selectionOutline);
      const labelsHost = document.createElement("div");
      labelsHost.className = "airspace-labels";
      const tip = document.createElement("div");
      tip.className = "airspace-tip";
      tip.innerHTML =
        '<div class="airspace-tip-title"><span class="nm"></span><span class="ty"></span></div><div class="alt"></div>';
      tip.style.display = "none";
      containerRef.current?.append(labelsHost, tip);
      overlayRef.current = { labelsHost, tip };
      try {
        await airLayer.load(airspaces, terrain, (fraction) => setLoad(0.74 + fraction * 0.26));
      } catch (airspaceError) {
        console.warn(airspaceError);
        holdNotice = "Airspace volumes failed to draw. The map is still usable.";
      }
      if (cancelled) return;
      airLayer.setSelected(useAppStore.getState().selectedAirspaceId);
      setSatelliteNotice(holdNotice);
      setLoad(1);
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      setLoad(null);

      const handler = new ScreenSpaceEventHandler(scene.canvas);
      handlerRef.current = handler;
      let dragging = false;
      let altHeld = false;
      let lastPick = 0;
      onKey = (event: KeyboardEvent) => {
        if (event.key !== "Alt") return;
        const next = event.type === "keydown";
        if (next !== altHeld) lastPick = 0;
        altHeld = next;
      };
      window.addEventListener("keydown", onKey);
      window.addEventListener("keyup", onKey);
      const hideTip = () => {
        tip.style.display = "none";
        scene.canvas.style.cursor = "";
      };
      const placeTip = (feature: AirspaceFeature, at: Cartesian2) => {
        const title = tip.querySelector(".nm");
        const kind = tip.querySelector(".ty");
        const alt = tip.querySelector(".alt");
        if (title) title.textContent = feature.name.toUpperCase();
        if (kind) kind.textContent = feature.category.toUpperCase();
        if (alt) alt.textContent = `${feature.lower.display} — ${feature.upper.display}`;
        tip.style.display = "block";
        const margin = 8;
        let x = at.x + 16;
        let y = at.y + 18;
        if (x + tip.offsetWidth > scene.canvas.clientWidth - margin) x = at.x - tip.offsetWidth - 12;
        if (y + tip.offsetHeight > scene.canvas.clientHeight - margin) y = at.y - tip.offsetHeight - 12;
        tip.style.left = `${Math.max(margin, x)}px`;
        tip.style.top = `${Math.max(margin, y)}px`;
        scene.canvas.style.cursor = "pointer";
      };
      const pickAirspaceAt = (position: Cartesian2, drillLimit = PICK_DRILL_CLICK): AirspaceFeature | null => {
        const pickedId = airLayer.pickFeatureIdAt(scene, position, altHeld, drillLimit);
        if (!pickedId) return null;
        return airLayer.getFeatureAt(pickedId) ?? null;
      };

      const selectAirspace = (feature: AirspaceFeature | null) => {
        onPickAirspace(feature);
        airLayer.setSelected(feature?.id ?? null);
        if (feature) hideTip();
      };

      const focusAirspace = (feature: AirspaceFeature) => {
        const ring = feature.ring;
        const count =
          ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] ? ring.length - 1 : ring.length;
        let lon = 0;
        let lat = 0;
        for (let i = 0; i < count; i++) {
          lon += ring[i][0];
          lat += ring[i][1];
        }
        requestCamera(lon / count, lat / count, viewRangeMetres("airspace", feature.ring));
      };

      let clickDelay: ReturnType<typeof setTimeout> | null = null;
      const runSingleClick = (position: Cartesian2) => {
        const picked = pickAirspaceAt(position);
        if (picked) {
          selectAirspace(picked);
          return;
        }
        if (tool === "query") {
          const ray = widget.camera.getPickRay(position);
          if (!ray) return;
          const pos = scene.globe.pick(ray, scene);
          if (!pos) return;
          const carto = Cartographic.fromCartesian(pos, Ellipsoid.WGS84, new Cartographic());
          const terrainH = scene.globe.getHeight(carto) ?? 0;
          const altM = feetToMetres(queryAltFt) + terrainH;
          const hits = airspacesAtPoint(
            airspaces,
            CesiumMath.toDegrees(carto.longitude),
            CesiumMath.toDegrees(carto.latitude),
            altM,
            terrainH,
          );
          onQueryResults?.(hits.map((h) => h.id));
          if (hits[0]) selectAirspace(hits[0]);
          else selectAirspace(null);
        } else {
          selectAirspace(null);
        }
      };

      handler.setInputAction((movement: { position: Cartesian2 }) => {
        if (clickDelay) clearTimeout(clickDelay);
        clickDelay = setTimeout(() => {
          clickDelay = null;
          runSingleClick(movement.position);
        }, 220);
      }, ScreenSpaceEventType.LEFT_CLICK);

      handler.setInputAction((movement: { position: Cartesian2 }) => {
        if (clickDelay) {
          clearTimeout(clickDelay);
          clickDelay = null;
        }
        const picked = pickAirspaceAt(movement.position);
        if (!picked) return;
        selectAirspace(picked);
        focusAirspace(picked);
      }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      let hoverId: string | null = null;
      const endHover = () => {
        dragging = true;
        hoverId = null;
        airLayer.setHovered(null);
        hideTip();
      };
      handler.setInputAction(endHover, ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction(endHover, ScreenSpaceEventType.RIGHT_DOWN);
      handler.setInputAction(() => {
        dragging = false;
      }, ScreenSpaceEventType.LEFT_UP);
      handler.setInputAction(() => {
        dragging = false;
      }, ScreenSpaceEventType.RIGHT_UP);
      let lastPickX = -1;
      let lastPickY = -1;
      let lastPickAlt = altHeld;
      const clearHover = () => {
        hoverId = null;
        airLayer.setHovered(null);
        hideTip();
        lastPickX = -1;
        lastPickY = -1;
      };
      scene.canvas.addEventListener("pointerleave", clearHover);
      handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
        if (dragging) return;
        const at = movement.endPosition;
        const now = performance.now();
        const moved =
          Math.abs(at.x - lastPickX) > 2 ||
          Math.abs(at.y - lastPickY) > 2 ||
          altHeld !== lastPickAlt;
        if (moved && now - lastPick > 72) {
          lastPick = now;
          lastPickX = at.x;
          lastPickY = at.y;
          lastPickAlt = altHeld;
          const next = airLayer.pickFeatureIdAt(scene, at, altHeld, PICK_DRILL_HOVER);
          if (next !== hoverId) {
            hoverId = next;
            airLayer.setHovered(hoverId);
            syncLabelHoverHide(labelsHost, hoverId);
          }
        }
        if (!hoverId) hideTip();
        else {
          const feature = airLayer.getFeatureAt(hoverId);
          if (feature) placeTip(feature, at);
        }
      }, ScreenSpaceEventType.MOUSE_MOVE);

      const resize = () => widget.resize();
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(containerRef.current!);

      widget.clock.onTick.addEventListener(() => {
        const c = widget.camera.positionCartographic;
        onCameraChange?.(
          CesiumMath.toDegrees(c.longitude),
          CesiumMath.toDegrees(c.latitude),
          c.height,
          CesiumMath.toDegrees(widget.camera.heading),
        );
        airLayer.updateVisibility(c.height);
        const pills = airLayer.layoutLabels(scene);
        if (pills) paintPills(labelsHost, pills, airLayer.getHoveredId());
      });
      } catch (error) {
        console.error(error);
        setSatelliteNotice(error instanceof Error ? error.message : "Map failed to start");
      }
    })();

    return () => {
      cancelled = true;
      useAppStore.getState().setLoadProgress(null);
      if (onKey) {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("keyup", onKey);
      }
      handlerRef.current?.destroy();
      handlerRef.current = null;
      overlayRef.current?.labelsHost.remove();
      overlayRef.current?.tip.remove();
      overlayRef.current = null;
      orbitRef.current?.destroy();
      orbitRef.current = null;
      stopCredits?.();
      observer?.disconnect();
      widgetRef.current?.destroy();
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    (widget.scene.verticalExaggeration as number) = terrainExaggeration;
  }, [terrainExaggeration]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;
    orbitRef.current?.setTopDown(chartTopDown);
  }, [chartTopDown]);

  useEffect(() => {
    if (!cameraRequest) return;
    orbitRef.current?.flyTo(cameraRequest.lon, cameraRequest.lat, cameraRequest.range);
  }, [cameraRequest]);

  useEffect(() => {
    layerRef.current?.setSelected(selectedAirspaceId);
  }, [selectedAirspaceId]);

  useEffect(() => {
    return useAppStore.subscribe((state, previous) => {
      if (
        state.categoryVisible === previous.categoryVisible &&
        state.isolateCategory === previous.isolateCategory &&
        state.altBandFt === previous.altBandFt
      ) {
        return;
      }
      const widget = widgetRef.current;
      const layer = layerRef.current;
      if (!widget || !layer) return;
      layer.updateVisibility(widget.camera.positionCartographic.height);
      widget.scene.requestRender();
    });
  }, []);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || !layerRef.current) return;
    layerRef.current.updateVisibility(widget.camera.positionCartographic.height);
    widget.scene.requestRender();
  }, [categoryVisible, isolateCategory, altBandFt]);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || appliedBasemap.current === null || appliedBasemap.current === basemap) return;
    let dropped = false;
    (async () => {
      const layers = widget.scene.imageryLayers;
      while (layers.length > BASE_IMAGERY_LAYERS) {
        layers.remove(layers.get(layers.length - 1), true);
      }
      const osKey = import.meta.env.VITE_OS_API_KEY ?? "";
      const { layer, notice } = await createBasemapLayer(basemap, osKey);
      if (dropped) return;
      layers.add(layer);
      appliedBasemap.current = basemap;
      setSatelliteNotice(notice ?? null);
      widget.scene.requestRender();
    })();
    return () => {
      dropped = true;
    };
  }, [basemap, setSatelliteNotice]);

  useEffect(() => {
    const tp = widgetRef.current?.terrainProvider;
    if (tp) layerRef.current?.load(airspaces, tp);
  }, [airspaces]);

  return <div className="map-viewport" ref={containerRef} aria-label="3D map" />;
}

function syncLabelHoverHide(host: HTMLElement, hideFeatureId: string | null) {
  for (let i = 0; i < host.children.length; i++) {
    const el = host.children[i] as HTMLElement;
    const id = el.dataset.featureId;
    if (!id) continue;
    el.style.display = hideFeatureId && id === hideFeatureId ? "none" : "flex";
  }
}

function paintPills(
  host: HTMLElement,
  pills: { id: string; name: string; type: string; category: string; accent: string; x: number; y: number }[],
  hideFeatureId: string | null = null,
) {
  while (host.children.length < pills.length) {
    const el = document.createElement("div");
    el.className = "airspace-label";
    el.innerHTML = '<span class="nm"></span><span class="ty"></span>';
    host.appendChild(el);
  }
  for (let i = 0; i < host.children.length; i++) {
    const el = host.children[i] as HTMLElement;
    const pill = pills[i];
    if (!pill) {
      el.style.display = "none";
      continue;
    }
    if (!Number.isFinite(pill.x) || !Number.isFinite(pill.y)) {
      el.style.display = "none";
      el.dataset.featureId = pill.id;
      continue;
    }
    el.style.display = hideFeatureId && pill.id === hideFeatureId ? "none" : "flex";
    el.style.left = `${pill.x}px`;
    el.style.top = `${pill.y}px`;
    el.style.setProperty("--label-accent", pill.accent);
    el.dataset.category = pill.category;
    el.dataset.featureId = pill.id;
    const name = el.children[0];
    const type = el.children[1];
    if (name.textContent !== pill.name) name.textContent = pill.name;
    if (type.textContent !== pill.type) type.textContent = pill.type;
  }
}

/** Boot-only UK snapshot. Fade it out once live tiles are up so the rectangle does not stay on wide views. */
function fadeOutImagery(layer: ImageryLayer, scene: Scene, ms = 480): void {
  const start = performance.now();
  const step = (now: number) => {
    if (layer.isDestroyed()) return;
    const t = Math.min(1, (now - start) / ms);
    layer.alpha = 1 - t;
    scene.requestRender();
    if (t < 1) {
      requestAnimationFrame(step);
      return;
    }
    layer.show = false;
    layer.alpha = 0;
    scene.requestRender();
  };
  requestAnimationFrame(step);
}

function waitForTiles(
  scene: Scene,
  onProgress: (fraction: number) => void,
  timeoutMs = 2500,
): Promise<void> {
  return new Promise((resolve) => {
    let sawWork = false;
    let peak = 1;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      remove();
      window.clearTimeout(timer);
      onProgress(1);
      resolve();
    };
    const remove = scene.globe.tileLoadProgressEvent.addEventListener((remaining: number) => {
      if (remaining > peak) peak = remaining;
      if (remaining > 0) {
        sawWork = true;
        onProgress(Math.min(0.95, (peak - remaining) / peak));
      }
      if (sawWork && remaining === 0) finish();
    });
    const timer = window.setTimeout(finish, timeoutMs);
  });
}
