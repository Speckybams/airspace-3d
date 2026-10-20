export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const ids = url.searchParams.get("ids");
  if (!ids) {
    return new Response(JSON.stringify({ error: "ids required" }), { status: 400 });
  }
  const upstream = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`;
  const resp = await fetch(upstream, {
    headers: {
      "User-Agent": "Airspace3D/0.1 (3D airspace viewer; educational use)",
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
