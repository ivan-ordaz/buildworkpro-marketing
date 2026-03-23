import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { sendEmail, verifyTurnstile, sanitizeField, isValidEmail, buildHtmlTable } from '../../lib/brevo';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = (env as any).BREVO_API_KEY as string;
    const turnstileSecret = (env as any).TURNSTILE_SECRET_KEY as string;

    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const turnstileToken = body['cf-turnstile-response'];
    if (!turnstileToken) {
      return Response.json({ error: 'Verification required.' }, { status: 400 });
    }

    const ip = request.headers.get('CF-Connecting-IP') || undefined;
    const valid = await verifyTurnstile(turnstileSecret, turnstileToken, ip);
    if (!valid) {
      return Response.json({ error: 'Verification failed. Please try again.' }, { status: 403 });
    }

    const name = sanitizeField('name', body.name);
    const email = sanitizeField('email', body.email);
    const company = sanitizeField('company', body.company);
    const trade = sanitizeField('trade', body.trade);
    const message = sanitizeField('message', body.message);

    if (!name || !email || !company) {
      return Response.json({ error: 'Name, email, and company are required.' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return Response.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    const htmlContent = `
      <h2>New Early Access Request</h2>
      ${buildHtmlTable({ Name: name, Email: email, Company: company, Trade: trade, Message: message })}
    `;

    await sendEmail(apiKey, {
      subject: `Early Access Request: ${company}`,
      htmlContent,
      replyTo: { email, name },
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Request access form error:', err);
    return Response.json({ error: 'Failed to send request. Please try again.' }, { status: 500 });
  }
};
