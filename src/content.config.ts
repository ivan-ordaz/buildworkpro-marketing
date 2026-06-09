import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro:schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // Docs freshness marker (see docs-rewrite-plan/03-style-guide.md).
      // `appVersion` records the app version a human last verified the page
      // against; `lastUpdated` (built into Starlight) records the date. Together
      // they make content drift mechanical to spot.
      extend: z.object({
        appVersion: z.string().optional(),
      }),
    }),
  }),
};
