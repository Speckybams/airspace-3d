import { proxyAviationWeather } from "./upstream";

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  return proxyAviationWeather("metar", context.request);
}
