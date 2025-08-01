/**
 * Trello CORS Proxy for Cloudflare Workers.
 * Securely streams private Trello attachment URLs to bypass CORS restrictions in Power-Up apps.
 * Converts x-trello-auth request header to Authorization header.
 */
const allowedOriginDomain = "yourdomain.com";

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const originUrl = new URL(event.request.url);
  const targetUrl = originUrl.searchParams.get("url");

  if (!targetUrl) {
    return new Response("Missing 'url' parameter", { status: 400 });
  }

  const origin = event.request.headers.get("Origin");
  if (!origin || !origin.endsWith(allowedOriginDomain)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (event.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  const requestHeaders = {};
  for (const [key, value] of event.request.headers.entries()) {
    if (key.toLowerCase() === "x-trello-auth") {
      requestHeaders["Authorization"] = value;
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: event.request.method,
      headers: requestHeaders,
      redirect: "follow"
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Vary", "Origin");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders
    });

  } catch (err) {
    return new Response("Fetch error: " + err.message, { status: 500 });
  }
}
