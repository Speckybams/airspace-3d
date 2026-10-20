import {
  Credit,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  OpenStreetMapImageryProvider,
  Rectangle,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
} from "cesium";
import type { BasemapId } from "@/lib/types";
import { OVERVIEW_BOUNDS, OVERVIEW_SIZE, OVERVIEW_URL } from "@/cesium/overviewMap";

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
  osKey: string,
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
    case "chart":
    default: {
      if (osKey) {
        // Outdoor Open Data (z7–16) has coast, towns, and terrain. Mute it so volumes stay the colour.
        const url = `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${osKey}`;
        return {
          layer: new ImageryLayer(
            new UrlTemplateImageryProvider({
              url,
              credit: new Credit("© Ordnance Survey"),
              maximumLevel: 16,
            }),
            // Contrast above 1 lifts already-light paper back to white, so darken with brightness.
            { brightness: 0.68, contrast: 1.06, saturation: 0.92, gamma: 0.82 },
          ),
        };
      }
      return {
        layer: new ImageryLayer(new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" })),
        notice: "Add VITE_OS_API_KEY for the OS Outdoor chart basemap.",
      };
    }
  }
}

export function setIonToken(token: string): void {
  if (token) Ion.defaultAccessToken = token;
}
