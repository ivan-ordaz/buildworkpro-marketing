import type { APIContext } from 'astro';
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

import openApiSpec from '../../public/openapi.json';
import { buildOpenApiOperationSeoIndex } from '../lib/seo.mjs';

type HeadItem = NonNullable<APIContext['locals']['starlightRoute']>['head'][number];

const operationSeoByPath = buildOpenApiOperationSeoIndex(openApiSpec);

export const onRequest = defineRouteMiddleware((context, next) => {
  const pathname = context.url.pathname.endsWith('/')
    ? context.url.pathname
    : `${context.url.pathname}/`;
  const seo = operationSeoByPath.get(pathname);

  if (seo) {
    upsertMeta(context.locals.starlightRoute.head, 'name', 'description', seo.description);
    upsertMeta(context.locals.starlightRoute.head, 'property', 'og:description', seo.description);
    upsertMeta(context.locals.starlightRoute.head, 'name', 'twitter:description', seo.description);
  }

  return next();
});

function upsertMeta(head: HeadItem[], attrName: 'name' | 'property', attrValue: string, content: string) {
  const existing = head.find((item) => {
    return item.tag === 'meta' && item.attrs?.[attrName] === attrValue;
  });

  if (existing?.attrs) {
    existing.attrs.content = content;
    return;
  }

  head.push({
    tag: 'meta',
    attrs: {
      [attrName]: attrValue,
      content,
    },
  });
}
