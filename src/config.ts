export const config = {
  siteUrl: import.meta.env.PUBLIC_SITE_URL || 'https://buildworkpro.com',
  appUrl: import.meta.env.PUBLIC_APP_URL || 'app.buildworkpro.com',
  email: {
    hello: import.meta.env.PUBLIC_EMAIL_HELLO || 'hello@buildworkpro.com',
    support: import.meta.env.PUBLIC_EMAIL_SUPPORT || 'support@buildworkpro.com',
    privacy: import.meta.env.PUBLIC_EMAIL_PRIVACY || 'privacy@buildworkpro.com',
    security: import.meta.env.PUBLIC_EMAIL_SECURITY || 'security@buildworkpro.com',
    legal: import.meta.env.PUBLIC_EMAIL_LEGAL || 'legal@buildworkpro.com',
    access: import.meta.env.PUBLIC_EMAIL_ACCESS || 'access@buildworkpro.com',
  },
  turnstileSiteKey: import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
};
