import { useEffect, useState } from "react";
import type { AirportFeature } from "@/lib/types";
import { fetchStationWeather, pickWeatherStation, type StationWeather } from "@/lib/aviationWeather";

function formatUtc(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16) + "Z";
}

export function WeatherBlock({
  airports,
  nearLat,
  nearLon,
}: {
  airports: AirportFeature[];
  nearLat: number;
  nearLon: number;
}) {
  const [wx, setWx] = useState<StationWeather | null>(null);
  const icao = pickWeatherStation(airports, nearLat, nearLon);

  useEffect(() => {
    if (!icao) {
      setWx(null);
      return;
    }
    let cancelled = false;
    setWx(null);
    fetchStationWeather(icao).then((data) => {
      if (!cancelled) setWx(data);
    });
    return () => {
      cancelled = true;
    };
  }, [icao, nearLat, nearLon]);

  if (!icao) return null;

  return (
    <div className="weather-block">
      <h3>Weather</h3>
      <p className="mono small">{icao} · aviationweather.gov</p>
      {wx === null && <p className="mono tiny muted">Loading METAR / TAF…</p>}
      {wx?.error && !wx.metar && !wx.taf && <p className="mono tiny muted">{wx.error}</p>}
      {wx?.metar && (
        <div className="weather-report">
          <p className="weather-kind">
            METAR{formatUtc(wx.metarTime) ? ` · ${formatUtc(wx.metarTime)}` : ""}
          </p>
          <p className="mono tiny weather-raw">{wx.metar}</p>
        </div>
      )}
      {wx && !wx.metar && !wx.error && (
        <p className="mono tiny muted">No current METAR for {icao}.</p>
      )}
      {wx?.taf && (
        <div className="weather-report">
          <p className="weather-kind">
            TAF{formatUtc(wx.tafTime) ? ` · issued ${formatUtc(wx.tafTime)}` : ""}
          </p>
          <p className="mono tiny weather-raw">{wx.taf}</p>
        </div>
      )}
      {wx && !wx.taf && !wx.error && wx.metar && (
        <p className="mono tiny muted">No TAF published for {icao}.</p>
      )}
    </div>
  );
}
