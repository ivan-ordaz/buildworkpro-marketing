/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_EMAIL_HELLO: string;
  readonly PUBLIC_EMAIL_SUPPORT: string;
  readonly PUBLIC_EMAIL_PRIVACY: string;
  readonly PUBLIC_EMAIL_SECURITY: string;
  readonly PUBLIC_EMAIL_LEGAL: string;
  readonly PUBLIC_EMAIL_ACCESS: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Cloudflare Workers virtual module — exposes Worker env bindings at runtime.
// Server-only secrets (SENDGRID_API_KEY, TURNSTILE_SECRET_KEY) live here, not in
// import.meta.env. See: https://developers.cloudflare.com/workers/runtime-apis/bindings/
declare module 'cloudflare:workers' {
  export const env: {
    SENDGRID_API_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    [key: string]: string | undefined;
  };
}
