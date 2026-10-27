import {
  Credit,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  OpenStreetMapImageryProvider,
  Rectangle,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  type Scene,
} from "cesium";
import type { BasemapId } from "@/lib/types";
import {
  OVERVIEW_BOUNDS,
  OVERVIEW_SEA,
  OVERVIEW_SIZE,
  OVERVIEW_URL,
} from "@/cesium/overviewMap";

const OSM_URL = "https://tile.openstreetmap.org/";

function createCartoDarkProvider(): UrlTemplateImageryProvider | null {
  const cartoKey = import.meta.env.VITE_CARTO_BASEMAPS_KEY?.trim();
  if (!cartoKey) return null;
  const key = encodeURIComponent(cartoKey);
  return new UrlTemplateImageryProvider({
    url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${key}`,
    credit: new Credit("© OpenStreetMap contributors © CARTO"),
    maximumLevel: 20,
  });
}

/** Same OSM tiles as CHART, tuned for a dark street-map look (runways, roads, labels). */
function applyDarkStreetImageryStyle(layer: ImageryLayer): void {
  layer.brightness = 0.36;
  layer.contrast = 1.28;
  layer.saturation = 0.12;
  layer.gamma = 0.82;
}

/** Dark street map: CARTO Dark Matter when keyed, otherwise styled OSM. */
function createDarkStreetLayer(): ImageryLayer {
  const carto = createCartoDarkProvider();
  if (carto) return new ImageryLayer(carto);
  const layer = new ImageryLayer(createOsmProvider());
  applyDarkStreetImageryStyle(layer);
  return layer;
}

/** Globe tint before tiles load; darker when using the dark basemap. */
export const DARK_SEA = "#0c1420";

export function globeSeaCssForBasemap(id: BasemapId): string {
  return id === "dark" ? DARK_SEA : OVERVIEW_SEA;
}

function createOsmProvider(): OpenStreetMapImageryProvider {
  return new OpenStreetMapImageryProvider({ url: OSM_URL });
}

/** Bottom imagery layer: OSM for chart/satellite, dark street map for dark mode. */
export function createMapUnderlayLayer(id: "chart" | "dark"): ImageryLayer {
  if (id === "dark") return createDarkStreetLayer();
  return new ImageryLayer(createOsmProvider());
}

export function replaceMapUnderlay(scene: Scene, id: "chart" | "dark"): void {
  const layers = scene.imageryLayers;
  if (layers.length < 1) return;
  layers.remove(layers.get(0), true);
  layers.add(createMapUnderlayLayer(id), 0);
}

/** OSM underlay plus the local overview. Live basemaps stack above these. */
export const BASE_IMAGERY_LAYERS = 2;

export function createOverviewLayer(): ImageryLayer {
  return new ImageryLayer(
    new SingleTileImageryProvider({
      url: OVERVIEW_URL,
      tileWidth: OVERVIEW_SIZE.width,
      tileHeight: OVERVIEW_SIZE.height,
      rectangle: Rectangle.fromDegrees(
        OVERVIEW_BOUNDS.west,
        OVERVIEW_BOUNDS.south,
        OVERVIEW_BOUNDS.east,
        OVERVIEW_BOUNDS.north,
      ),
      credit: new Credit("Natural Earth"),
    }),
  );
}

const EOX =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg";

export async function createBasemapLayer(
  id: BasemapId,
  _osKey: string,
): Promise<{ layer: ImageryLayer; notice?: string }> {
  switch (id) {
    case "satellite": {
      try {
        const provider = await IonImageryProvider.fromAssetId(2);
        return {
          layer: new ImageryLayer(provider, { show: true }),
        };
      } catch {
        const fallback = new UrlTemplateImageryProvider({
          url: EOX,
          credit: new Credit(
            "EOxCloudless (CC BY-NC-SA) — Sentinel-2; not for commercial use",
          ),
          maximumLevel: 15,
        });
        return {
          layer: new ImageryLayer(fallback),
          notice: "Using EOX Sentinel-2 fallback (10 m). Cesium ion imagery unavailable.",
        };
      }
    }
    case "dark":
      return { layer: createDarkStreetLayer() };
    case "chart":
    default: {
      // OSM everywhere on CHART, including Britain, so aerodrome runways and taxiways stay visible when zoomed in.
      return { layer: new ImageryLayer(createOsmProvider()) };
    }
  }
}

export function setIonToken(token: string): void {
  if (token) Ion.defaultAccessToken = token;
}
