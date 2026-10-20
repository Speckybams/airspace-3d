const USER_AGENT = "Airspace3D/0.1 (3D airspace viewer; educational use)";

export async function proxyAviationWeather(
  kind: "metar" | "taf",
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const ids = url.searchParams.get("ids");
  if (!ids) {
    return new Response(JSON.stringify({ error: "ids required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const upstream = `https://aviationweather.gov/api/data/${kind}?ids=${encodeURIComponent(ids)}&format=json`;
  const resp = await fetch(upstream, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
