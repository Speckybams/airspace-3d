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
const CARTO_CREDIT = new Credit("© OpenStreetMap contributors © CARTO");
const ESRI_CREDIT = new Credit("Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS user community");

const ESRI_DARK_GRAY =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ESRI_WORLD_STREET =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

function cartoBasemapKey(): string {
  const raw = import.meta.env.VITE_CARTO_BASEMAPS_KEY?.trim() ?? "";
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("your_key") || lower.includes("paste") || lower.includes("example.com")) return "";
  if (lower.includes("carto.com/basemaps/apikey")) return "";
  if (raw.length < 16) return "";
  return raw;
}

function hasCartoKey(): boolean {
  return Boolean(cartoBasemapKey());
}

/** CARTO raster URL; API key from https://carto.com/basemaps/apikey/ */
function cartoRasterUrl(style: "voyager" | "dark_all"): string {
  const key = cartoBasemapKey();
  const base = `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png`;
  return `${base}?key=${encodeURIComponent(key)}`;
}

function createOsmProvider(): OpenStreetMapImageryProvider {
  return new OpenStreetMapImageryProvider({ url: OSM_URL });
}

function createCartoVoyagerProvider(): UrlTemplateImageryProvider {
  return new UrlTemplateImageryProvider({
    url: cartoRasterUrl("voyager"),
    credit: CARTO_CREDIT,
    maximumLevel: 20,
  });
}

function createCartoDarkProvider(): UrlTemplateImageryProvider {
  return new UrlTemplateImageryProvider({
    url: cartoRasterUrl("dark_all"),
    credit: CARTO_CREDIT,
    maximumLevel: 20,
  });
}

function createEsriDarkGrayProvider(): UrlTemplateImageryProvider {
  return new UrlTemplateImageryProvider({
    url: ESRI_DARK_GRAY,
    credit: ESRI_CREDIT,
    maximumLevel: 16,
  });
}

function createEsriWorldStreetProvider(): UrlTemplateImageryProvider {
  return new UrlTemplateImageryProvider({
    url: ESRI_WORLD_STREET,
    credit: ESRI_CREDIT,
    maximumLevel: 19,
  });
}

function createChartStreetLayer(): ImageryLayer {
  if (hasCartoKey()) return new ImageryLayer(createCartoVoyagerProvider());
  if (import.meta.env.DEV) return new ImageryLayer(createOsmProvider());
  return new ImageryLayer(createEsriWorldStreetProvider());
}

function createDarkStreetLayer(): ImageryLayer {
  if (hasCartoKey()) return new ImageryLayer(createCartoDarkProvider());
  return new ImageryLayer(createEsriDarkGrayProvider());
}

/** Globe tint before tiles load; darker when using the dark basemap. */
export const DARK_SEA = "#0c1420";

export function globeSeaCssForBasemap(id: BasemapId): string {
  return id === "dark" ? DARK_SEA : OVERVIEW_SEA;
}

/** Bottom imagery layer: street map for chart/satellite underlay, or dark street map for dark mode. */
export function createMapUnderlayLayer(id: "chart" | "dark"): ImageryLayer {
  if (id === "dark") return createDarkStreetLayer();
  return createChartStreetLayer();
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
    default:
      return { layer: createChartStreetLayer() };
  }
}

export function setIonToken(token: string): void {
  if (token) Ion.defaultAccessToken = token;
}

export function basemapDevNotice(): string | null {
  if (!import.meta.env.DEV || hasCartoKey()) return null;
  return "No valid VITE_CARTO_BASEMAPS_KEY — CHART uses OSM, DARK uses Esri dark gray. Paste a real key from carto.com/basemaps/apikey/ into .env and restart dev.";
}
