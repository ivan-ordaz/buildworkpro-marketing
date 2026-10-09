/**
 * First-party reverse proxy for posthog-js on the marketing site
 * (`api_host: '/ingest'`, marketing#227). Same contract as the app's proxy
 * (buildworkpro server/lib/posthog-proxy.ts):
 *
 *   /ingest/static/*  → https://us-assets.i.posthog.com/static/*
 *   /ingest/*         → https://us.i.posthog.com/*
 *
 * Same-origin so tracker blockers that drop `*.posthog.com` don't hollow out
 * the visitor → signup funnel. What it forwards is an ALLOW-list: never
 * cookies, the client IP (CF-Connecting-IP / X-Forwarded-For) or the Referer.
 * The upstreams are fixed constants — an unauthenticated relay must not be
 * steerable to another host.
 */

export const POSTHOG_API_ORIGIN = 'https://us.i.posthog.com';
export const POSTHOG_ASSETS_ORIGIN = 'https://us-assets.i.posthog.com';

/** Marks every response that came through this route (routing tests key on it). */
export const INGEST_MARKER_HEADER = 'x-bwp-ingest';

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);
const FORWARDED_REQUEST_HEADERS = ['content-type', 'content-encoding', 'accept', 'user-agent'];
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'expires',
];

/**
 * Upstream URL for the path after `/ingest`. The path goes through the URL's
 * pathname setter rather than being resolved against the origin, so
 * `//evil.example.com/x` stays a path on the PostHog host.
 */
export function posthogUpstreamUrl(path: string, search: string): URL {
  const pathname = path.startsWith('/') ? path : `/${path}`;
  const origin = pathname.startsWith('/static/') ? POSTHOG_ASSETS_ORIGIN : POSTHOG_API_ORIGIN;
  const url = new URL(origin);
  url.pathname = pathname;
  url.search = search;
  return url;
}

/** Only the headers PostHog needs — no cookies, IP or Referer. */
export function forwardedRequestHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function marked(response: Response): Response {
  response.headers.set(INGEST_MARKER_HEADER, '1');
  return response;
}

export async function proxyToPosthog(
  request: Request,
  path: string,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return marked(Response.json({ error: 'Method not allowed' }, { status: 405 }));
  }
  const target = posthogUpstreamUrl(path, new URL(request.url).search);
  if (target.origin !== POSTHOG_API_ORIGIN && target.origin !== POSTHOG_ASSETS_ORIGIN) {
    return marked(Response.json({ error: 'Bad request' }, { status: 400 }));
  }

  const body = request.method === 'POST' ? await request.arrayBuffer() : undefined;
  let upstream: Response;
  try {
    upstream = await fetchImpl(target, {
      method: request.method,
      headers: forwardedRequestHeaders(request.headers),
      body: body && body.byteLength > 0 ? body : undefined,
    });
  } catch (error) {
    console.error('[posthog-proxy] upstream unreachable', error);
    return marked(
      Response.json({ error: 'Analytics is temporarily unavailable.' }, { status: 502 })
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const payload = request.method === 'HEAD' ? null : await upstream.arrayBuffer();
  return marked(new Response(payload, { status: upstream.status, headers }));
}
