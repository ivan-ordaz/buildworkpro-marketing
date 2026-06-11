const SENDER_EMAIL = 'noreply@buildworkpro.com';
const SENDER_NAME = 'BuildWorkPro';
const RECIPIENT_EMAIL = 'hello@buildworkpro.com';

export type Env = {
  SENDGRID_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
};

// Transactional email via SendGrid (matches the main app). SendGrid returns
// 202 Accepted with an empty body on success — do NOT parse it as JSON.
export async function sendEmail(
  apiKey: string,
  opts: { subject: string; htmlContent: string; replyTo?: { email: string; name?: string } }
) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: RECIPIENT_EMAIL }] }],
      from: { email: SENDER_EMAIL, name: SENDER_NAME },
      subject: opts.subject,
      content: [{ type: 'text/html', value: opts.htmlContent }],
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SendGrid API error (${res.status}): ${err}`);
  }

  // 202 Accepted with no body; nothing to parse.
  return { status: res.status };
}

export async function verifyTurnstile(secretKey: string, token: string, ip?: string) {
  const params = new URLSearchParams({
    secret: secretKey,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const data = (await res.json()) as { success: boolean };
  return data.success;
}

// --- Input validation ---

const MAX_LENGTHS: Record<string, number> = {
  name: 120,
  email: 254,
  company: 150,
  trade: 100,
  message: 2000,
};

export function sanitizeField(key: string, value: unknown): string {
  const str = String(value ?? '').trim();
  const max = MAX_LENGTHS[key] ?? 500;
  return str.length > max ? str.slice(0, max) : str;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

// --- HTML helpers ---

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildHtmlTable(fields: Record<string, string>) {
  const rows = Object.entries(fields)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px">${escapeHtml(value || '(not provided)')}</td></tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`;
}
