// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

const env = loadEnv('', process.cwd(), 'PUBLIC_');

// https://astro.build/config
export default defineConfig({
  site: env.PUBLIC_SITE_URL,
  output: 'static',
  integrations: [
    sitemap(),
    starlight({
      title: 'BuildWorkPro Docs',
      logo: {
        src: './public/logo.png',
      },
      social: [
        { icon: 'email', label: 'Email Support', href: `mailto:${env.PUBLIC_EMAIL_SUPPORT}` },
      ],
      customCss: ['./src/styles/docs.css'],
      sidebar: [
        { label: 'Getting Started', autogenerate: { directory: 'docs/getting-started' } },
        { label: 'Bids & Estimates', autogenerate: { directory: 'docs/bids' } },
        { label: 'Project Management', autogenerate: { directory: 'docs/projects' } },
        { label: 'Pay Applications', autogenerate: { directory: 'docs/pay-apps' } },
        { label: 'Change Orders', autogenerate: { directory: 'docs/change-orders' } },
        { label: 'Field Operations', autogenerate: { directory: 'docs/field' } },
        { label: 'CRM & Pipeline', autogenerate: { directory: 'docs/crm' } },
        { label: 'Account & Settings', autogenerate: { directory: 'docs/settings' } },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
