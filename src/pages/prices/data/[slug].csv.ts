// /prices/data/{material}.csv and /prices/data/all.csv — the series behind
// each price page, prerendered at build time from src/data/prices/ppi.json.
import type { APIRoute } from 'astro';
import { COMPOSITE, MATERIALS, REPORT_EXTRAS } from '../../../data/prices/materials';
import { csvFor, SERIES_DEFS } from '../../../lib/prices/ppi';

export const prerender = true;

export function getStaticPaths() {
  const pages = MATERIALS.map((m) => ({
    params: { slug: m.slug },
    props: { ids: [...m.series, ...(m.regions ?? []).map((r) => r.id)] },
  }));
  const all = SERIES_DEFS.map((s) => s.id);
  // Keep the composite and the report-only series reachable in all.csv.
  for (const id of [COMPOSITE, ...REPORT_EXTRAS]) if (!all.includes(id)) all.push(id);
  return [...pages, { params: { slug: 'all' }, props: { ids: all } }];
}

export const GET: APIRoute = ({ props }) => {
  const body = `${csvFor((props as { ids: string[] }).ids)}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
};
