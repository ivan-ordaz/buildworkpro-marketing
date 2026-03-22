export const config = {
  siteUrl: import.meta.env.PUBLIC_SITE_URL,
  appUrl: import.meta.env.PUBLIC_APP_URL,
  email: {
    hello: import.meta.env.PUBLIC_EMAIL_HELLO,
    support: import.meta.env.PUBLIC_EMAIL_SUPPORT,
    privacy: import.meta.env.PUBLIC_EMAIL_PRIVACY,
    security: import.meta.env.PUBLIC_EMAIL_SECURITY,
    legal: import.meta.env.PUBLIC_EMAIL_LEGAL,
    access: import.meta.env.PUBLIC_EMAIL_ACCESS,
  },
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY,
};
