import { defineMiddleware } from 'astro:middleware';

const PRODUCTION_HOST = 'buildworkpro.com';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const host = context.request.headers.get('host') ?? url.host;
  const isProduction = host === PRODUCTION_HOST;

  if (!isProduction && url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nDisallow: /\n', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const response = await next();

  if (!isProduction) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');
  }

  return response;
});
