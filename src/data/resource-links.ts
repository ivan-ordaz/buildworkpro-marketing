// Cross-links between the free resource sections: calculators and tools
// (/tools/), material price pages (/prices/) and templates (/templates/). The
// registries store bare hrefs (ToolEntry.related, TemplateEntry.resources); this
// turns each into the label shown on the page. An href that matches nothing
// throws, so a renamed or removed page fails the build instead of shipping a
// broken link.
import { MATERIALS } from './prices/materials';
import { TEMPLATES, type TemplateSlug } from './templates';
import { TOOLS } from './tools';

export type ResourceLink = { href: string; label: string };

export function resourceLink(href: string): ResourceLink {
  if (href === '/prices/') return { href, label: 'Construction material prices' };
  const tool = TOOLS.find((t) => t.href === href);
  if (tool) return { href, label: tool.name };
  const price = /^\/prices\/([a-z0-9-]+)\/$/.exec(href);
  const material = price && MATERIALS.find((m) => m.slug === price[1]);
  if (material) return { href, label: material.h1 };
  const tpl = /^\/templates\/([a-z0-9-]+)\/$/.exec(href);
  const template = tpl && TEMPLATES[tpl[1] as TemplateSlug];
  if (template) return { href, label: template.title };
  throw new Error(`resource-links: ${href} is not a tool, price page or template`);
}

export const resourceLinks = (hrefs: string[] = []): ResourceLink[] => hrefs.map(resourceLink);
