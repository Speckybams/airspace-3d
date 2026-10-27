import {
  Credit,
  ImageryLayer,
  Ion,
  IonImageryProvider,
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

const CARTO_CREDIT = new Credit("© OpenStreetMap contributors © CARTO");

/** CARTO raster URL; optional API key from https://carto.com/basemaps/apikey/ */
function cartoRasterUrl(style: "voyager" | "dark_all"): string {
  const key = import.meta.env.VITE_CARTO_BASEMAPS_KEY?.trim();
  const base = `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png`;
  if (!key) return base;
  return `${base}?key=${encodeURIComponent(key)}`;
}

/**
 * Chart + dark street maps via CARTO (OSM-derived). Direct tile.openstreetmap.org is blocked on
 * production sites per OSMF tile policy; localhost may still work in dev.
 */
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

/** Globe tint before tiles load; darker when using the dark basemap. */
export const DARK_SEA = "#0c1420";

export function globeSeaCssForBasemap(id: BasemapId): string {
  return id === "dark" ? DARK_SEA : OVERVIEW_SEA;
}

/** Bottom imagery layer: CARTO voyager (chart/satellite underlay) or dark matter (dark mode). */
export function createMapUnderlayLayer(id: "chart" | "dark"): ImageryLayer {
  if (id === "dark") return new ImageryLayer(createCartoDarkProvider());
  return new ImageryLayer(createCartoVoyagerProvider());
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
      return { layer: new ImageryLayer(createCartoDarkProvider()) };
    case "chart":
    default:
      return { layer: new ImageryLayer(createCartoVoyagerProvider()) };
  }
}

export function setIonToken(token: string): void {
  if (token) Ion.defaultAccessToken = token;
}
