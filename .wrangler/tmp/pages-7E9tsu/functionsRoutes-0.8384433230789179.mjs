import { onRequestGet as __api_weather_metar_ts_onRequestGet } from "D:\\STARLING-Airspace\\functions\\api\\weather\\metar.ts"

export const routes = [
    {
      routePath: "/api/weather/metar",
      mountPath: "/api/weather",
      method: "GET",
      middlewares: [],
      modules: [__api_weather_metar_ts_onRequestGet],
    },
  ]