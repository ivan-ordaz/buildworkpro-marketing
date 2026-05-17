# Product docs screenshots

Screenshots embedded in the product docs (`src/content/docs/docs/`).

## Layout

`public/docs-screenshots/<area>/<name>.png` — `<area>` matches the docs sidebar
group (`getting-started`, `bids`, `projects`, `pay-apps`, `change-orders`,
`field`, `crm`, `settings`).

## Naming

`<area>/<page-or-feature>-<what>.png` — all lowercase, hyphen-separated.
Example: `bids/bid-line-items-tab.png`.

## Referencing from a docs page

```md
![Descriptive caption](/docs-screenshots/bids/bid-create-form.png)
```

Pair each embed with a source comment so the capture pass knows what to shoot.
In `.mdx` files use a JSX comment (HTML comments break MDX); in `.md` files an
HTML comment is fine:

```mdx
{/* SCREENSHOT NEEDED: precise description of the UI state to capture */}
```

The full shot-list lives in `docs/PRODUCT-DOCS-REWRITE-PLAN.md`. Live capture
against `app.buildworkpro.com` is a follow-up task (#196) that needs an
authenticated browser session.
