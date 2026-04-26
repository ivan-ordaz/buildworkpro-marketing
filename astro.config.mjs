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
  adapter: cloudflare(),
  integrations: [
    sitemap(),
    starlight({
      title: 'BuildWorkPro Docs',
      favicon: '/favicon.png',
      logo: {
        src: './public/logo.png',
      },
      social: [
        { icon: 'email', label: 'Email Support', href: `mailto:${env.PUBLIC_EMAIL_SUPPORT || 'support@buildworkpro.com'}` },
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
        { label: 'Getting Started', autogenerate: { directory: 'docs/getting-started' } },
        { label: 'Bids & Estimates', autogenerate: { directory: 'docs/bids' } },
        { label: 'Project Management', autogenerate: { directory: 'docs/projects' } },
        { label: 'Pay Applications', autogenerate: { directory: 'docs/pay-apps' } },
        { label: 'Change Orders', autogenerate: { directory: 'docs/change-orders' } },
        { label: 'Field Operations', autogenerate: { directory: 'docs/field' } },
        { label: 'CRM & Pipeline', autogenerate: { directory: 'docs/crm' } },
        { label: 'Account & Settings', autogenerate: { directory: 'docs/settings' } },
        {
          label: 'Developers',
          items: [
            { label: 'Overview', link: '/api/' },
            { label: 'Quickstart', link: '/api/quickstart/' },
            { label: 'Authentication', autogenerate: { directory: 'api/authentication' } },
            { label: 'Concepts', autogenerate: { directory: 'api/concepts' } },
            { label: 'Webhooks', autogenerate: { directory: 'api/webhooks' } },
            { label: 'MCP (Claude / ChatGPT)', autogenerate: { directory: 'api/mcp' } },
            { label: 'Jobs', link: '/api/jobs/' },
            { label: 'Recipes', autogenerate: { directory: 'api/recipes' } },
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
