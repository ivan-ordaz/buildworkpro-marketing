const APP_URL_RAW = import.meta.env.PUBLIC_APP_URL || 'app.buildworkpro.com';
const APP_ORIGIN = APP_URL_RAW.startsWith('http') ? APP_URL_RAW : `https://${APP_URL_RAW}`;

export const config = {
  siteUrl: import.meta.env.PUBLIC_SITE_URL || 'https://buildworkpro.com',
  appUrl: APP_URL_RAW,
  appOrigin: APP_ORIGIN,
  signupUrl: `${APP_ORIGIN}/signup`,
  loginUrl: `${APP_ORIGIN}/login`,
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
