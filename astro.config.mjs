// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';

const env = loadEnv('', process.cwd(), 'PUBLIC_');

// https://astro.build/config
export default defineConfig({
  site: env.PUBLIC_SITE_URL || 'https://buildworkpro.com',
  // compressHTML strips the whitespace between a text node and a following inline
  // element on its own source line, producing run-together copy ("softwarefor
  // subcontractors", "AIA-stylepay") — 314 instances sitewide including the
  // homepage hero H1. Prettier's 100-char wrap makes that source shape routine,
  // so compression must stay off. Guarded by tests/api-no-collapsed-spaces.spec.ts.
  compressHTML: false,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  // Permanent (301) redirects for dead URLs Google still crawls, so they resolve
  // to a live page instead of returning 404 / lingering in Search Console.
  // - /api/recipes/02-export-bids-to-pdf/  : removed recipe (GSC "Not found 404").
  // - /api/recipes/                        : only a sidebar group, no index page.
  // - /api/reference/operations/projectsid/patch/ : stale OpenAPI URL scheme; the
  //   current page is .../operations/patchprojectsbyid/.
  // - /features/ai-assistant/             : became the /agents/ hub (marketing#183).
  //
  // NOTE: /pricing/ used to 301 here as a stop-gap for the 404. It is now a real
  // page (src/pages/pricing.astro) — a redirect and a page cannot both own the
  // URL, so the rule had to go with it.
  redirects: {
    '/features/ai-assistant/': { status: 301, destination: '/agents/' },
    // Merged into the daily report guide (2026-10): same topic, the two posts split one intent.
    '/blog/construction-site-log-best-practices/': {
      status: 301,
      destination: '/blog/construction-daily-report-template/',
    },
    '/api/recipes/02-export-bids-to-pdf/': { status: 301, destination: '/api/' },
    '/api/recipes/': { status: 301, destination: '/api/' },
    '/api/reference/operations/projectsid/patch/': {
      status: 301,
      destination: '/api/reference/operations/patchprojectsbyid/',
    },
  },
  adapter: cloudflare({
    prerenderEnvironment: 'node',
  }),
  integrations: [
    // The sitemap should advertise the pages that can rank, not the whole build
    // (issue #126): 193 auto-generated /api/reference/operations/* pages (also
    // noindexed via the Starlight Head override) plus the noindexed legal and
    // app-store-compliance pages previously made up ~83% of a 285-URL sitemap
    // on a domain Google is still forming an opinion of. Paid /lp/ destinations
    // are noindex (Layout) and stay out of the sitemap so they don't compete
    // with the public compare pages.
    sitemap({
      filter: (page) =>
        !page.includes('/api/reference/operations/') &&
        !page.includes('/lp/') &&
        !['/terms/', '/privacy/', '/cookies/', '/delete-account/'].some((path) =>
          page.endsWith(path)
        ),
    }),
    starlight({
      title: 'BuildWorkPro Docs',
      favicon: '/favicon.png',
      logo: {
        src: './public/logo.png',
      },
      social: [
        {
          icon: 'email',
          label: 'Email Support',
          href: `mailto:${env.PUBLIC_EMAIL_SUPPORT || 'support@buildworkpro.com'}`,
        },
      ],
      customCss: ['./src/styles/docs.css'],
      components: {
        // Adds noindex to /api/reference/operations/* — see the component.
        Head: './src/components/starlight/Head.astro',
      },
      plugins: [
        starlightOpenAPI([
          {
            base: 'api/reference',
            schema: './public/openapi.json',
            label: 'API Reference',
          },
        ]),
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [{ autogenerate: { directory: 'docs/getting-started' } }],
        },
        { label: 'Bids & Estimates', items: [{ autogenerate: { directory: 'docs/bids' } }] },
        { label: 'Products & Catalog', items: [{ autogenerate: { directory: 'docs/products' } }] },
        { label: 'Project Management', items: [{ autogenerate: { directory: 'docs/projects' } }] },
        { label: 'Pay Applications', items: [{ autogenerate: { directory: 'docs/pay-apps' } }] },
        { label: 'Change Orders', items: [{ autogenerate: { directory: 'docs/change-orders' } }] },
        { label: 'Field Operations', items: [{ autogenerate: { directory: 'docs/field' } }] },
        { label: 'CRM & Pipeline', items: [{ autogenerate: { directory: 'docs/crm' } }] },
        { label: 'Documents', items: [{ autogenerate: { directory: 'docs/documents' } }] },
        { label: 'Reports', items: [{ autogenerate: { directory: 'docs/reports' } }] },
        { label: 'Calendar', items: [{ autogenerate: { directory: 'docs/calendar' } }] },
        { label: 'Account & Settings', items: [{ autogenerate: { directory: 'docs/settings' } }] },
        {
          label: 'Developers',
          items: [
            { label: 'Overview', link: '/api/' },
            { label: 'Quickstart', link: '/api/quickstart/' },
            {
              label: 'Authentication',
              items: [{ autogenerate: { directory: 'api/authentication' } }],
            },
            { label: 'Concepts', items: [{ autogenerate: { directory: 'api/concepts' } }] },
            { label: 'Webhooks', items: [{ autogenerate: { directory: 'api/webhooks' } }] },
            {
              label: 'MCP (AI agents)',
              items: [{ autogenerate: { directory: 'api/mcp' } }],
            },
            { label: 'Recipes', items: [{ autogenerate: { directory: 'api/recipes' } }] },
            { label: 'Changelog', link: '/api/changelog/' },
            ...openAPISidebarGroups,
          ],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // pdf-lib is imported on demand by /tools/pay-app/. Pre-bundling it keeps
    // Vite from discovering it mid-session and force-reloading the page (which
    // is what the Playwright warmup step guards against for the base graph).
    optimizeDeps: { include: ['pdf-lib'] },
    ssr: {
      resolve: {
        conditions: ['workerd', 'worker', 'node'],
        externalConditions: ['workerd', 'worker', 'node'],
      },
    },
  },
});
