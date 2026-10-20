/** Same-origin OS raster proxy. The browser cannot call api.os.uk (no CORS). */

const EMPTY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const upstreamPath = `${url.pathname.replace(/^\/api\/os/, "")}${url.search}`;
  if (!upstreamPath.startsWith("/maps/raster/")) {
    return new Response("Not found", { status: 404 });
  }

  const level = Number(upstreamPath.match(/\/zxy\/[^/]+\/(\d+)\//)?.[1]);
  if (!Number.isFinite(level) || level < 7 || level > 16) {
    return emptyTile();
  }

  const upstream = await fetch(`https://api.os.uk${upstreamPath}`, {
    headers: { Accept: "image/png,image/jpeg,image/*" },
  });
  if (!upstream.ok) return emptyTile();

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

function emptyTile(): Response {
  return new Response(EMPTY_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
