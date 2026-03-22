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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
