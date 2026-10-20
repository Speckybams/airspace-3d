# Deploy Airspace 3D to Cloudflare Pages

**Product name:** Airspace 3D  
**GitHub:** [Speckybams/airspace-3d](https://github.com/Speckybams/airspace-3d)  
**Planned domain:** `voluspace.com` (short URL; app title stays “Airspace 3D”)

## 1. Domain on Cloudflare

1. Buy **`voluspace.com`** at your registrar (avoid **`voluspaces.com`** unless you mean the plural name).
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → enter `voluspace.com` → **Free** plan.
3. At the registrar, set nameservers to the two Cloudflare gives you (no A record at the registrar).
4. Wait until the site shows **Active**.

If the domain is registered **with Cloudflare**, skip nameserver changes.

## 2. Create the Pages project

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub → select **`Speckybams/airspace-3d`**.
3. Build settings:

| Setting | Value |
|---------|--------|
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. **Environment variables** (add for **Production** and **Preview** — copy from local `.env`):

| Name | Notes |
|------|--------|
| `VITE_CESIUM_ION_ACCESS_TOKEN` | From [Cesium ion](https://ion.cesium.com/tokens) |
| `VITE_OS_API_KEY` | From [OS Data Hub](https://osdatahub.os.uk/) |
| `NODE_VERSION` | `22` |

5. **Save and Deploy**. Open the `*.pages.dev` URL.
6. Smoke test: `/api/weather/metar?ids=EGLL` should return JSON.

If you change env vars later, use **Deployments → Retry deployment** (Vite bakes `VITE_*` at build time).

## 3. Custom domain

In the Pages project → **Custom domains**:

1. Add **`voluspace.com`** (apex) — accept Cloudflare’s proxied record (orange cloud).
2. Add **`www.voluspace.com`** → redirect **www → apex** (or the reverse; pick one canonical host).
3. Wait for SSL **Active** (usually minutes).

## 4. Lock map keys to production URL

Both keys are in the client bundle; restrict by hostname:

- **Cesium ion** → token → allowed URLs: `https://voluspace.com`, `https://www.voluspace.com` (if you use www).
- **OS Data Hub** → project → same hostnames if referrer/domain limits apply.

Until these match the live site, terrain or OS tiles may work locally but fail in production.

## Local Pages Functions preview

```powershell
npm run build
npx wrangler pages dev dist
```

METAR proxy: `GET /api/weather/metar?ids=EGLL` ([`functions/api/weather/metar.ts`](../functions/api/weather/metar.ts)).
