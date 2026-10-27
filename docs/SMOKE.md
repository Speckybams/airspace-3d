# Pre-announce smoke checklist

Manual pass before calling a release live. No Playwright required.

## Environment

- Production or `npm run build && npm run preview` with `VITE_CESIUM_ION_ACCESS_TOKEN` set as on Pages.

## Steps

1. **Disclaimer** — Open `/`. Text should name **Europe & North America** (not UK-only). Accept and continue.
2. **Status bar** — Footer shows `Cells in view · tools use loaded airspace` and `OpenAIP · OSM · Cesium`.
3. **Search** — Press `/`, search **EGLL**, fly to Heathrow. Map loads airspace volumes near the airport.
4. **Share hash** — After the camera settles (~1 s), URL should contain `#vs=` with a base64 payload. Copy the full URL, open in a new tab: same basemap, tool, camera framing, and selection if one was active.
5. **Query** — Tools → **QUERY**. Click the map; set altitude **3000** ft; confirm listed volumes update.
6. **Section** — Tools → **SECTION**. Click two points; profile chart appears with terrain and bands.
7. **Weather API** — `GET /api/weather/metar?ids=EGLL` returns JSON (Pages only unless using `wrangler pages dev`).

## Basemap

- **CHART** and **DARK** load OpenStreetMap tiles (not Ordnance Survey raster). Satellite uses Cesium ion when configured.
