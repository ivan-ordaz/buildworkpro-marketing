import type { APIRoute } from 'astro';

export const prerender = false;

// Country lookup for the geo-gated consent default (issue #125). Cloudflare
// stamps CF-IPCountry on every proxied request; the consent script in
// Layout.astro uses it to decide the default posture (opt-in for EEA/UK/CH,
// opt-out elsewhere). When the header is absent (local dev/preview, direct
// origin hits) or Cloudflare reports the unknown/Tor sentinels, we return null
// and the client fails closed to the opt-in posture.
//
// Deliberately does NOT import `cloudflare:workers` — the header comes off the
// plain Request, which keeps this route runnable under `astro dev` too.
export const GET: APIRoute = ({ request }) => {
  const raw = request.headers.get('cf-ipcountry')?.toUpperCase() ?? null;
  const country = raw && raw !== 'XX' && raw !== 'T1' ? raw : null;
  return Response.json({ country }, { headers: { 'Cache-Control': 'no-store' } });
};
