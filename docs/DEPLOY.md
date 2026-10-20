# Deploy VoluSpace to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare → **Workers & Pages** → **Create** → **Pages** → Connect the repo.
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Environment variables (Production + Preview):
   - `VITE_CESIUM_ION_ACCESS_TOKEN`
   - `VITE_OS_API_KEY`
5. Deploy. Open the `*.pages.dev` URL.
6. Optional: **Custom domains** for your hostname.

METAR requests use `/api/weather/metar` (Pages Function). Test: `/api/weather/metar?ids=EGLL`.

Local production preview does not run Functions unless you use Wrangler:

```powershell
npx wrangler pages dev dist
```
