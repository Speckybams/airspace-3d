import type { AirspaceCategory, AirportFeature } from "@/lib/types";

/** Local METAR/TAF is only shown for aerodrome-adjacent airspace, not en-route or hazard volumes. */
const WEATHER_CATEGORIES = new Set<AirspaceCategory>([
  "atz",
  "ctr",
  "cta",
  "frz",
  "rmz",
  "tmz",
  "matz",
]);

export function airspaceCategoryShowsWeather(category: AirspaceCategory): boolean {
  return WEATHER_CATEGORIES.has(category);
}

interface MetarRow {
  icaoId?: string;
  rawOb?: string;
  reportTime?: string;
}

interface TafRow {
  icaoId?: string;
  rawTAF?: string;
  issueTime?: string;
}

export interface StationWeather {
  icao: string;
  metar: string | null;
  metarTime: string | null;
  taf: string | null;
  tafTime: string | null;
  error: string | null;
}

export function pickWeatherStation(
  airports: AirportFeature[],
  nearLat: number,
  nearLon: number,
): string | null {
  const withIcao = airports.filter((a) => a.icao);
  if (!withIcao.length) return null;

  let best = withIcao[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const apt of withIcao) {
    const d = (apt.lat - nearLat) ** 2 + (apt.lon - nearLon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = apt;
    }
  }
  return best.icao ?? null;
}

async function readAviationJson<T>(res: Response): Promise<T[]> {
  if (!res.ok) {
    throw new Error(`Weather service returned ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as T[];
}

export async function fetchStationWeather(icao: string): Promise<StationWeather> {
  const base: StationWeather = {
    icao,
    metar: null,
    metarTime: null,
    taf: null,
    tafTime: null,
    error: null,
  };

  try {
    const [metarRes, tafRes] = await Promise.all([
      fetch(`/api/weather/metar?ids=${encodeURIComponent(icao)}`),
      fetch(`/api/weather/taf?ids=${encodeURIComponent(icao)}`),
    ]);

    const metars = await readAviationJson<MetarRow>(metarRes);
    const tafs = await readAviationJson<TafRow>(tafRes);

    const metar = metars.find((row) => row.icaoId === icao) ?? metars[0];
    const taf = tafs.find((row) => row.icaoId === icao) ?? tafs[0];

    base.metar = metar?.rawOb?.trim() ?? null;
    base.metarTime = metar?.reportTime ?? null;
    base.taf = taf?.rawTAF?.trim() ?? null;
    base.tafTime = taf?.issueTime ?? null;

    if (!base.metar && !base.taf) {
      base.error = "No METAR or TAF returned for this station.";
    }
  } catch {
    base.error =
      "Weather unavailable. Use Cloudflare Pages (production) or run: npm run build && npx wrangler pages dev dist";
  }

  return base;
}
