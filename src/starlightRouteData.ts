// Starlight route middleware: keep the generated API reference out of the
// sidebar everywhere except the reference itself.
//
// starlight-openapi expands its "API Reference" group into ~247 links to
// /api/reference/operations/* — pages that are deliberately noindexed (see
// src/components/starlight/Head.astro). With one global sidebar, every product
// doc and developer guide (75 indexable pages) carried those links, about 18,500
// internal links into noindexed URLs that Googlebot has to crawl just to read
// the noindex. On this young domain that crawl went to waste while real pages
// sat in "Discovered – currently not indexed" (GSC URL Inspection, 2026-10-07).
//
// Outside /api/reference/ the group collapses to a single link to the reference
// overview; inside it, developers keep the full operation tree.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';

type SidebarEntry = StarlightRouteData['sidebar'][number];

export const API_REFERENCE_LABEL = 'API Reference';
export const API_REFERENCE_HREF = '/api/reference/';

export function collapseApiReference(entries: SidebarEntry[], pathname: string): SidebarEntry[] {
  if (pathname.startsWith(API_REFERENCE_HREF)) return entries;
  return entries.map((entry) => {
    if (entry.type !== 'group') return entry;
    if (entry.label === API_REFERENCE_LABEL) {
      return {
        type: 'link',
        label: API_REFERENCE_LABEL,
        href: API_REFERENCE_HREF,
        isCurrent: false,
        badge: undefined,
        attrs: {},
      };
    }
    return { ...entry, entries: collapseApiReference(entry.entries, pathname) };
  });
}

export const onRequest = defineRouteMiddleware(async (context, next) => {
  // starlight-openapi registers its sidebar middleware with order "post", so it
  // runs after this one; wait for it to expand the group, then collapse it.
  await next();
  const route = context.locals.starlightRoute;
  route.sidebar = collapseApiReference(route.sidebar, context.url.pathname);
});
