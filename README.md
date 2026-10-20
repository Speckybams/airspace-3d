# VoluSpace

3D interactive UK airspace map built with **React**, **Vite**, and **CesiumJS**. Understand controlled airspace in context — **not for navigation**.

## Setup

```powershell
cd d:\STARLING-Airspace
copy .env.example .env
# Add VITE_CESIUM_ION_ACCESS_TOKEN and VITE_OS_API_KEY
npm install
npm run build:data
npm run dev
```

Open http://localhost:5173

## Build & deploy (Cloudflare Pages)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variables:** `VITE_CESIUM_ION_ACCESS_TOKEN`, `VITE_OS_API_KEY`

Pages Functions serve `/api/weather/metar` (METAR proxy). See [docs/HOSTING.md](docs/HOSTING.md).

## Docs

- [docs/HOSTING.md](docs/HOSTING.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/LICENSING.md](docs/LICENSING.md)

## Data

UK airspace is built from daily [OpenAIP](https://www.openaip.net/) exports plus a Heathrow FRZ override. Refresh:

```powershell
npm run build:data
```
