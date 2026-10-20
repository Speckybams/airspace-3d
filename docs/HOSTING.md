# Hosting — Airspace 3D

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

Set the same vars for **Production** and **Preview** in Pages → Settings → Environment variables. **Do not commit `.env`** (see `.gitignore`); only `.env.example` belongs in git.

After changing env vars in Cloudflare, **Retry deployment** on the latest build so `VITE_*` values are rebaked.

Restrict **Cesium ion** and **OS Data Hub** keys to `https://voluspace.com` (and `https://www.voluspace.com` if you use www). Details: [DEPLOY.md — Lock map keys](DEPLOY.md#4-lock-map-keys-to-production-url).

## Functions

- [`functions/api/weather/metar.ts`](../functions/api/weather/metar.ts) → `GET /api/weather/metar?ids=EGLL`
- [`functions/api/weather/taf.ts`](../functions/api/weather/taf.ts) → `GET /api/weather/taf?ids=EGLL`
- [`functions/api/os/[[path]].ts`](../functions/api/os/[[path]].ts) → `GET /api/os/maps/raster/...` (OS tile proxy; avoids browser CORS to `api.os.uk`)
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
