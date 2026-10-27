# Airspace 3D

3D interactive airspace map built with **React**, **Vite**, and **CesiumJS**. Understand controlled airspace in context — **not for navigation**. Europe & North America airspace pack (OpenAIP); cells load near the camera.

## Setup

```powershell
cd d:\STARLING-Airspace
copy .env.example .env
# Add VITE_CESIUM_ION_ACCESS_TOKEN (VITE_OS_API_KEY is optional; OS tile proxy is unused by the basemap today)
npm install
npm run build:data
npm run dev
```

Open http://localhost:5173

## Build & deploy (Cloudflare Pages)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Push live:** `.\scripts\push-live.ps1 "Your commit message"` (pushes `main` → GitHub → Pages rebuild)
- **Secrets:** never commit `.env`. Set `VITE_CESIUM_ION_ACCESS_TOKEN` in Cloudflare Pages → Environment variables (Production + Preview), then retry the latest deployment if you change them. Restrict the ion token to `https://voluspace.com`. CHART and DARK basemaps use OpenStreetMap; satellite uses Cesium ion (EOX fallback).

Full checklist: [docs/DEPLOY.md](docs/DEPLOY.md). Runtime: [docs/HOSTING.md](docs/HOSTING.md).

## Docs

- [docs/HOSTING.md](docs/HOSTING.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/LICENSING.md](docs/LICENSING.md)

## Data

Airspace is built from [OpenAIP](https://www.openaip.net/) exports (22 countries in the first pack) plus a Heathrow FRZ override. Refresh:

```powershell
npm run build:data
```
