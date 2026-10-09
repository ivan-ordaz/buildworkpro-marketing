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
  /**
   * PostHog project key (marketing#227). Publishable by design — the same
   * project key the app serves from /api/config/public — so it may live here.
   */
  posthogKey:
    import.meta.env.PUBLIC_POSTHOG_KEY || 'phc_Aprfr56ZmrvJ2T9RA57tj2HRnntB24wtmv6BoEAMfn4x',
  /**
   * Byline for blog posts (visible byline + BlogPosting/AboutPage Person
   * schema). `profiles` feeds schema.org `sameAs` and the author box links —
   * only list profiles that exist and are filled out; a dead link is worse
   * than none.
   */
  author: {
    name: 'Ivan Ordaz',
    jobTitle: 'Founder, BuildWorkPro',
    bio: 'Ivan runs National Glass and Construction, a South Florida glass and glazing subcontractor, and built BuildWorkPro to run it. These guides come from the bids, change orders and pay applications that shop runs through every week.',
    url: '/about/',
    profiles: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/iordaz/' }],
  },
};
