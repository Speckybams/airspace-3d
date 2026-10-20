# Hosting — VoluSpace

**Cloudflare Pages** (static `dist/` + **Pages Functions** for weather).

## Pages settings

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | 20+ (22 recommended) |

## Environment variables

| Name | Purpose |
|------|---------|
| `VITE_CESIUM_ION_ACCESS_TOKEN` | Terrain + optional Bing satellite |
| `VITE_OS_API_KEY` | Ordnance Survey raster basemaps (Light / Road / Outdoor) |

Set the same vars for **Production** and **Preview** in Pages → Settings → Environment variables.

## Functions

- [`functions/api/weather/metar.ts`](../functions/api/weather/metar.ts) → `GET /api/weather/metar?ids=EGLL`
- [`public/_routes.json`](../public/_routes.json) limits Functions to `/api/*` so static assets stay free.

## Headers

Root [`_headers`](../_headers) is copied into `dist` via Vite `public/`. Extend CSP if you add tile hosts.

## Custom domain

Connect in Pages → Custom domains. No `CNAME` file required when DNS is on Cloudflare.

## Local preview of production build

```powershell
npm run build
npm run preview
```

Weather proxy works on Pages deploy; locally `/api/weather/*` returns unless using `wrangler pages dev`.
