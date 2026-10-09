import astro from '@astrojs/cloudflare/entrypoints/server';
import { proxyToPosthog } from './lib/posthog-proxy';

/**
 * Worker entry (wrangler.toml `main`). It answers the first-party PostHog proxy
 * (marketing#227) BEFORE Astro routes the request. As an Astro route,
 * `trailingSlash: 'always'` 301s `/ingest/array/<key>/config` to a slashed path
 * PostHog 404s, and 404s `/ingest/static/*.js` outright, so posthog-js's remote
 * config and lazy extensions never load. Every other request goes to Astro
 * unchanged.
 */
type FetchArgs = Parameters<typeof astro.fetch>;

export default {
  fetch(request: FetchArgs[0], env: FetchArgs[1], ctx: FetchArgs[2]) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/ingest/')) {
      return proxyToPosthog(request as unknown as Request, pathname.slice('/ingest'.length));
    }
    return astro.fetch(request, env, ctx);
  },
};
