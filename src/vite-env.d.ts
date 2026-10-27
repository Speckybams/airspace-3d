/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESIUM_ION_ACCESS_TOKEN: string;
  readonly VITE_OS_API_KEY: string;
  /** Optional — https://carto.com/basemaps/apikey/ (free); uses Esri dark gray when unset. */
  readonly VITE_CARTO_BASEMAPS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const CESIUM_BASE_URL: string;
