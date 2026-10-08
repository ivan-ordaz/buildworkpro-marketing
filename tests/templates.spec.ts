import { test, expect } from '@playwright/test';
import { CATEGORIES, TEMPLATE_LIST } from '../src/data/templates';

// The /templates/ hub and every template page (issues #134, #145; rebuilt in
// the templates v2 pass). The downloads must stay ungated — the file being
// freely fetchable is the whole link-magnet strategy (Q5 decision: open file,
// optional email only for the bundle).

const MAGIC: Record<string, string> = { pdf: '%PDF', xlsx: 'PK', docx: 'PK' };

/** Trades with a /solutions/<trade>-contractors/ page — their estimate template must link it. */
const SOLUTION_TRADES = [
  'concrete',
  'electrical',
  'framing',
  'glazing',
  'hvac',
  'plumbing',
  'roofing',
];

test.describe('templates hub', () => {
  test('lists every registered template with a link to its page', async ({ page }) => {
    await page.goto('/templates/');
    await expect(page.locator('main h1')).toHaveText(/Free construction templates/i);
    for (const t of TEMPLATE_LIST) {
      await expect(page.locator(`main a[href="/templates/${t.slug}/"]`).first()).toBeVisible();
    }
  });

  test('groups templates by category with anchor navigation', async ({ page }) => {
    await page.goto('/templates/');
    await expect(page.locator('main section#billing h2')).toHaveText(/Billing & payment/);
    await expect(page.locator('main section#safety h2')).toHaveText(/Safety/);
    await expect(page.locator('main nav[aria-label="Template categories"] a')).toHaveCount(
      Object.keys(CATEGORIES).length
    );
  });

  test('the complete-pack email form renders without gating the downloads', async ({ page }) => {
    await page.goto('/templates/');
    const form = page.locator('#template-pack-form');
    await expect(form).toBeVisible();
    await expect(form.locator('input[type="email"]')).toBeVisible();
    // Consent stays explicit — same GDPR pattern as the contact form.
    await expect(form.locator('#template-pack-consent')).toBeAttached();
    // Transactional only: no ESP / nurture list exists on this site.
    await expect(page.getByText(/not\s+a newsletter/i)).toBeVisible();
    // The individual downloads above the form must remain ungated links, not
    // form-triggered — the open-file strategy is the whole point (Q5).
    await expect(page.locator('main a[href="/templates/aia-g702-g703/"]').first()).toBeVisible();
  });

  test('the complete-pack form requires Turnstile before posting', async ({ page }) => {
    // Stub Turnstile so the widget never issues a token. Aborting the real
    // script 404s Vite and puts an overlay over the submit button.
    await page.addInitScript(() => {
      (window as unknown as { turnstile: { render: () => string; reset: () => void } }).turnstile =
        {
          render() {
            return 'mock';
          },
          reset() {},
        };
    });
    await page.route('https://challenges.cloudflare.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
    );
    const posts: string[] = [];
    await page.route('**/api/template-pack/**', async (route) => {
      posts.push(route.request().url());
      await route.abort();
    });
    await page.goto('/templates/');
    await page.locator('#template-pack-form input[name="email"]').fill('test@example.com');
    await page.locator('#template-pack-consent').check();
    await page.locator('#template-pack-submit').click();
    await expect(page.locator('#template-pack-status')).toContainText(/verification/i);
    expect(posts).toHaveLength(0);
  });

  test('carries FAQPage structured data', async ({ page }) => {
    await page.goto('/templates/');
    const json = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(json.some((j) => j.includes('"FAQPage"'))).toBe(true);
  });
});

// Every registered template page: renders, every advertised format downloads
// as a real file of that type (magic bytes), the completed example exists, the
// preview image resolves, FAQ schema is present, and it cross-links the hub.
for (const t of TEMPLATE_LIST) {
  test.describe(`/templates/${t.slug}/`, () => {
    test('renders with the H1, downloads and preview', async ({ page, request }) => {
      await page.goto(`/templates/${t.slug}/`);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page).toHaveTitle(/Free/i);

      const links = page.locator('main a.template-download');
      const count = await links.count();
      expect(count).toBeGreaterThanOrEqual(t.formats.length + 1); // formats + completed example

      const seen = new Set<string>();
      for (let i = 0; i < count; i++) {
        const href = (await links.nth(i).getAttribute('href'))!;
        expect(href.startsWith('/templates-files/')).toBe(true);
        const ext = href.split('.').pop()!;
        seen.add(ext);
        const res = await request.get(href);
        expect(res.status(), href).toBe(200);
        const body = await res.body();
        expect(body.length, href).toBeGreaterThan(3000);
        expect(body.subarray(0, MAGIC[ext].length).toString(), href).toBe(MAGIC[ext]);
        expect(href.endsWith('-example.pdf') || href.includes(t.basename), href).toBe(true);
      }
      for (const f of t.formats) {
        const ext = { PDF: 'pdf', Excel: 'xlsx', Word: 'docx' }[f];
        expect(seen.has(ext), `${t.slug} should offer ${f}`).toBe(true);
      }

      // Completed-example preview image (page 1 of the sample render).
      const img = page.locator('main figure img').first();
      await expect(img).toBeVisible();
      const src = (await img.getAttribute('src'))!;
      expect(src.startsWith('/templates-previews/')).toBe(true);
      const imgRes = await request.get(src);
      expect(imgRes.status()).toBe(200);
    });

    test('links in prose to its feature page (or its trade page)', async ({ page }) => {
      await page.goto(`/templates/${t.slug}/`);
      // Inside a paragraph, so the feature-funnel button and the CTA buttons don't count.
      const prose = page.locator('main p a[href^="/features/"], main p a[href^="/solutions/"]');
      expect(await prose.count()).toBeGreaterThanOrEqual(1);
      const trade = t.slug.replace(/-estimate$/, '');
      if (t.category === 'trades' && SOLUTION_TRADES.includes(trade)) {
        await expect(
          page.locator(`main a[href="/solutions/${trade}-contractors/"]`).first()
        ).toBeAttached();
      }
    });

    test('has FAQ schema, related templates and the hub link', async ({ page }) => {
      await page.goto(`/templates/${t.slug}/`);
      const json = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(json.some((j) => j.includes('"FAQPage"'))).toBe(true);
      expect(json.some((j) => j.includes('"DigitalDocument"'))).toBe(true);
      await expect(page.locator('main a[href="/templates/"]').first()).toBeVisible();
      const related = page.locator('main a[href^="/templates/"]:not([href="/templates/"])');
      expect(await related.count()).toBeGreaterThanOrEqual(3);
    });
  });
}

test.describe('cross-links from guides', () => {
  test('the daily-report post links to the template page and still downloads the file', async ({
    page,
    request,
  }) => {
    await page.goto('/blog/construction-daily-report-template/');
    await expect(page.locator('main a[href="/templates/daily-report/"]').first()).toBeVisible();
    const link = page.locator('main a.template-download').first();
    await expect(link).toBeVisible();
    const res = await request.get((await link.getAttribute('href'))!);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
  });

  for (const [post, slug] of [
    ['/blog/how-to-create-construction-bid/', 'construction-bid-proposal'],
    ['/blog/construction-markup-vs-margin/', 'construction-estimate'],
    ['/blog/schedule-of-values-guide/', 'schedule-of-values'],
    ['/blog/aia-pay-application-guide/', 'aia-g702-g703'],
    ['/blog/construction-change-order-management/', 'change-order'],
    ['/blog/construction-lien-waivers-explained/', 'lien-waiver'],
    ['/blog/construction-lien-waivers-explained/', 'conditional-lien-waiver'],
    ['/blog/construction-lien-waivers-explained/', 'unconditional-lien-waiver'],
    ['/blog/how-to-create-construction-bid/', 'construction-estimate'],
    ['/blog/aia-pay-application-guide/', 'schedule-of-values'],
    ['/blog/job-costing-for-subcontractors/', 'construction-budget'],
    ['/blog/prevailing-wage-certified-payroll/', 'timesheet'],
    ['/blog/construction-project-closeout-checklist/', 'certificate-of-completion'],
    ['/blog/punch-list-management-for-subcontractors/', 'punch-list'],
  ] as const) {
    test(`${post} links to /templates/${slug}/`, async ({ page }) => {
      await page.goto(post);
      await expect(page.locator(`main a[href="/templates/${slug}/"]`).first()).toBeVisible();
    });
  }
});

// One owner per topic (2026-10 cannibalization pass): the guide owns the
// explanatory query, the template owns the form query. Each guide links its
// template in the first three paragraphs, and the template links back.
test.describe('topic owners', () => {
  for (const [post, slug] of [
    ['/blog/construction-lien-waivers-explained/', 'conditional-lien-waiver'],
    ['/blog/construction-lien-waivers-explained/', 'unconditional-lien-waiver'],
    ['/blog/aia-pay-application-guide/', 'aia-g702-g703'],
    ['/blog/schedule-of-values-guide/', 'schedule-of-values'],
    ['/blog/construction-daily-report-template/', 'daily-report'],
    ['/blog/how-to-create-construction-bid/', 'construction-estimate'],
  ] as const) {
    test(`${post} links /templates/${slug}/ early, and the template links back`, async ({
      page,
    }) => {
      await page.goto(post);
      const early = await page
        .locator('main article > div.prose')
        .first()
        .evaluate(
          (el, href) =>
            Array.from(el.querySelectorAll(':scope > p'))
              .slice(0, 3)
              .some((p) => p.querySelector(`a[href="${href}"]`) !== null),
          `/templates/${slug}/`
        );
      expect(early, 'template link should sit in the first three paragraphs').toBe(true);

      await page.goto(`/templates/${slug}/`);
      await expect(page.locator(`main a[href="${post}"]`).first()).toBeAttached();
    });
  }

  for (const post of [
    '/blog/construction-lien-waivers-explained/',
    '/blog/aia-pay-application-guide/',
    '/blog/schedule-of-values-guide/',
    '/blog/construction-daily-report-template/',
    '/blog/how-to-create-construction-bid/',
  ]) {
    test(`${post} leads with the explanatory intent, not "template"`, async ({ page }) => {
      await page.goto(post);
      await expect(page.locator('main h1')).not.toHaveText(/template|form/i);
      await expect(page).not.toHaveTitle(/template|form/i);
    });
  }

  test('the merged site-log post redirects to the daily report guide', async ({ page }) => {
    await page.goto('/blog/construction-site-log-best-practices/');
    await expect(page).toHaveURL(/\/blog\/construction-daily-report-template\/$/);
    await expect(page.locator('main h1')).toBeVisible();
  });

  test('every trade estimate template is linked from the takeoff guide', async ({ page }) => {
    await page.goto('/blog/how-to-read-construction-plans-takeoff/');
    for (const t of TEMPLATE_LIST.filter((x) => x.category === 'trades')) {
      await expect(page.locator(`main a[href="/templates/${t.slug}/"]`).first()).toBeAttached();
    }
  });

  test('the templates hub links the compare hub', async ({ page }) => {
    await page.goto('/templates/');
    await expect(page.locator('main a[href="/compare/"]')).toHaveCount(1);
  });
});

test.describe('disclaimers', () => {
  test('the pay application page carries the AIA trademark disclaimer', async ({ page }) => {
    await page.goto('/templates/aia-g702-g703/');
    await expect(page.getByText(/Not an official AIA document/i).first()).toBeVisible();
  });

  test('the subcontractor agreement page carries the not-legal-advice disclaimer', async ({
    page,
  }) => {
    await page.goto('/templates/subcontractor-agreement/');
    await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
  });

  test('the lien waiver page names the statutory-form states', async ({ page }) => {
    await page.goto('/templates/lien-waiver/');
    await expect(page.getByText(/statutory/i).first()).toBeVisible();
  });

  for (const slug of ['conditional-lien-waiver', 'unconditional-lien-waiver'] as const) {
    test(`/templates/${slug}/ names the statutory-form states and Florida's statute`, async ({
      page,
    }) => {
      await page.goto(`/templates/${slug}/`);
      await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
      await expect(page.getByText(/§ 713\.20/).first()).toBeVisible();
    });
  }

  for (const [slug, statute] of [
    ['notice-of-commencement', '§ 713.13'],
    ['notice-to-owner', '§ 713.06'],
  ] as const) {
    test(`/templates/${slug}/ is labelled as a Florida form under ${statute}`, async ({ page }) => {
      await page.goto(`/templates/${slug}/`);
      await expect(page.locator('main h1')).toContainText(/Florida/);
      await expect(page.getByText(statute).first()).toBeVisible();
      await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
    });
  }

  for (const slug of ['equipment-rental-agreement', 'letter-of-intent'] as const) {
    test(`/templates/${slug}/ carries the not-legal-advice disclaimer`, async ({ page }) => {
      await page.goto(`/templates/${slug}/`);
      await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
    });
  }
});

test.describe('lien waiver pages cross-link', () => {
  const pages = ['lien-waiver', 'conditional-lien-waiver', 'unconditional-lien-waiver'];
  for (const from of pages) {
    test(`/templates/${from}/ links to the other two waiver pages`, async ({ page }) => {
      await page.goto(`/templates/${from}/`);
      for (const to of pages.filter((p) => p !== from)) {
        await expect(page.locator(`main a[href="/templates/${to}/"]`).first()).toBeAttached();
      }
    });
  }
});
