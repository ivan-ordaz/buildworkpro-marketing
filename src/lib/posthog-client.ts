import type { PostHog, PostHogConfig } from 'posthog-js';

/**
 * marketing#227 — PostHog on the marketing site. Loaded only under the same
 * consent posture as the Meta Pixel (Layout.astro): after Accept, or by default
 * outside the EEA/UK/Switzerland. Decline never loads it and opts out a copy
 * already running on the page.
 *
 * The cookie is set on `.buildworkpro.com` (posthog-js's cross-subdomain
 * default, pinned here), so the visitor's anonymous id carries over to
 * app.buildworkpro.com; the app identifies the user at login and PostHog links
 * these earlier visits to them. No session replay on the marketing site.
 */

export type AnalyticsEnvironment = 'production' | 'development';

/** Only the live site counts as production; previews and dev are filtered out. */
export function posthogEnvironment(hostname: string): AnalyticsEnvironment {
  return hostname === 'buildworkpro.com' || hostname === 'www.buildworkpro.com'
    ? 'production'
    : 'development';
}

export function buildPosthogConfig(environment: AnalyticsEnvironment): Partial<PostHogConfig> {
  return {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    // Anonymous visitors stay cheap anonymous events until the app identifies them.
    person_profiles: 'identified_only',
    cross_subdomain_cookie: true,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    enable_recording_console_log: false,
    capture_exceptions: false,
    loaded: (posthog) => {
      posthog.register({ environment });
    },
  };
}

let loading: Promise<PostHog | null> | null = null;
let client: PostHog | null = null;

/** Load and init posthog-js once. Never throws: analytics must not break the page. */
export function loadPostHog(key: string, hostname: string): Promise<PostHog | null> {
  if (!key) return Promise.resolve(null);
  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(key, buildPosthogConfig(posthogEnvironment(hostname)));
        // We only get here when the visitor's current choice allows analytics.
        // An opt-out persisted by an earlier Decline must not outlive a later
        // Accept.
        if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
        client = posthog;
        return posthog;
      })
      .catch(() => {
        // Blocked by an extension or a failed chunk load: analytics stays off.
        loading = null;
        return null;
      });
  }
  return loading;
}

/** Decline on a page where PostHog already loaded (geo-default posture). */
export function optOutPostHog(): void {
  try {
    client?.opt_out_capturing();
  } catch {
    /* best-effort */
  }
}
