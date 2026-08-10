import { test, expect } from '@playwright/test';

// Regression guard for the compressHTML whitespace collapse (marketing issue #124).
//
// With `compressHTML: true` (Astro's default), the newline between a text node and
// an inline element on its own source line is stripped from the BUILT output —
// producing "softwarefor subcontractors" in the hero H1 and 314 run-together
// glitches sitewide. Prettier's 100-char wrap makes that source shape routine, so
// the config pins `compressHTML: false` and this spec fails if anyone flips it back.
//
// It lives in the `api-` project on purpose: that project targets `astro preview`
// over a fresh build. The dev server never compresses HTML, so the same assertions
// against `astro dev` would pass vacuously.

const PAGES = [
  '/',
  '/pricing/',
  '/solutions/electrical-contractors/',
  '/compare/procore-alternative/',
  '/blog/aia-pay-application-guide/',
];

// A lowercase letter or sentence punctuation butted directly against an inline
// element boundary is the collapse signature ("AIA-style<strong>pay</strong>",
// "accept.<a>Cookie Policy</a>", "</strong>pulled").
const COLLAPSED_OPEN = /[a-z.,]<(a|span|strong|em)\b/g;
const COLLAPSED_CLOSE = /<\/(a|strong|em)>[a-z]/g;

for (const path of PAGES) {
  test(`no collapsed inline-element whitespace on ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);

    // Script/style bodies can legitimately contain `<` next to letters.
    const html = (await res.text())
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '');

    const hits = [...html.matchAll(COLLAPSED_OPEN), ...html.matchAll(COLLAPSED_CLOSE)].map((m) =>
      html.slice(Math.max(0, (m.index ?? 0) - 45), (m.index ?? 0) + 45).replace(/\s+/g, ' ')
    );

    expect(
      hits,
      'Run-together text around inline elements — compressHTML has been re-enabled ' +
        '(astro.config.mjs) or new markup butts a text node against an inline tag. Contexts:'
    ).toEqual([]);
  });
}
