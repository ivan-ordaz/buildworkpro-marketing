export const SITEWIDE_SEO_LASTMOD = '2026-06-02';

const NOINDEX_SITEMAP_PATHS = new Set(['/privacy/', '/terms/', '/cookies/']);

const OPERATION_ID_OVERRIDES = new Map([
  ['post /webhook-deliveries/{id}/replay', 'replaywebhookdelivery'],
]);

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

export function shouldIncludeInSitemap(pageUrl) {
  const { pathname } = new URL(pageUrl);
  return !NOINDEX_SITEMAP_PATHS.has(ensureTrailingSlash(pathname));
}

export function serializeSitemapItem(item) {
  return {
    ...item,
    lastmod: SITEWIDE_SEO_LASTMOD,
  };
}

export function getStableOperationId(method, pathname) {
  const normalizedMethod = method.toLowerCase();
  const override = OPERATION_ID_OVERRIDES.get(`${normalizedMethod} ${pathname}`);

  if (override) {
    return override;
  }

  return (
    normalizedMethod +
    pathname
      .replace(/\{([^}]+)\}/g, 'by$1')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
  );
}

export function buildOpenApiOperationSeoIndex(spec, basePath = '/api/reference/') {
  const operations = new Map();
  const paths = spec?.paths ?? {};

  for (const [pathname, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== 'object') {
        continue;
      }

      const operationId = operation.operationId ?? getStableOperationId(method, pathname);
      const routePath = `${ensureTrailingSlash(basePath)}operations/${slugOperationId(operationId)}/`;
      const methodLabel = method.toUpperCase();
      const summary = cleanText(operation.summary);
      const description = makeMetaDescription({
        method: methodLabel,
        pathname,
        summary,
        description: cleanText(operation.description),
      });

      operations.set(routePath, {
        description,
        title: summary || `${methodLabel} ${pathname}`,
      });
    }
  }

  return operations;
}

function makeMetaDescription({ method, pathname, summary, description }) {
  const firstSentence = description.split(/(?<=[.!?])\s+/)[0]?.trim();
  const summaryText = summary || `${method} ${pathname}`;

  if (firstSentence) {
    const combined = firstSentence.toLowerCase().startsWith(summaryText.toLowerCase())
      ? firstSentence
      : `${summaryText}. ${firstSentence}`;

    if (combined.length <= 158) {
      return combined;
    }
  }

  const text = `BuildWorkPro API reference for ${method} ${pathname}: ${summaryText}.`;

  return text.length <= 158 ? text : `${text.slice(0, 155).trimEnd()}...`;
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureTrailingSlash(pathname) {
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function slugOperationId(operationId) {
  return String(operationId)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
