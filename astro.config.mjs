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
  //
  // NOTE: /pricing/ used to 301 here as a stop-gap for the 404. It is now a real
  // page (src/pages/pricing.astro) — a redirect and a page cannot both own the
  // URL, so the rule had to go with it.
  redirects: {
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
    sitemap(),
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
              label: 'MCP (Claude / ChatGPT)',
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
    ssr: {
      resolve: {
        conditions: ['workerd', 'worker', 'node'],
        externalConditions: ['workerd', 'worker', 'node'],
      },
    },
  },
});
