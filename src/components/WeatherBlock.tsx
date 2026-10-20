import { useEffect, useState } from "react";
import type { AirportFeature } from "@/lib/types";

export function WeatherBlock({
  airports,
  nearLat,
  nearLon,
}: {
  airports: AirportFeature[];
  nearLat: number;
  nearLon: number;
}) {
  const [metar, setMetar] = useState<string | null>(null);
  const [icao, setIcao] = useState<string | null>(null);

  useEffect(() => {
    const withIcao = airports.filter((a) => a.icao);
    if (!withIcao.length) return;
    const pick = withIcao.find((a) => a.icao === "EGLL") ?? withIcao[0];
    setIcao(pick.icao ?? null);
    fetch(`/api/weather/metar?ids=${pick.icao}`)
      .then((r) => r.json())
      .then((d) => setMetar(JSON.stringify(d).slice(0, 200)))
      .catch(() => setMetar("Weather unavailable (deploy with Pages Functions)."));
  }, [airports, nearLat, nearLon]);

  if (!icao) return null;
  return (
    <div className="weather-block">
      <h3>Weather</h3>
      <p className="mono small">{icao} METAR</p>
      <p className="mono tiny muted">{metar ?? "Loading…"}</p>
    </div>
  );
}
