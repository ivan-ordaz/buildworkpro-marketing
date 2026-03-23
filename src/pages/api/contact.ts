import type { APIRoute } from 'astro';
import { sendEmail, verifyTurnstile, sanitizeField, isValidEmail, buildHtmlTable } from '../../lib/brevo';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const runtime = (locals as any).runtime;
    if (!runtime?.env) {
      console.error('Runtime env not available. locals:', JSON.stringify(Object.keys(locals)));
      return Response.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const { env } = runtime;

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
    const valid = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip);
    if (!valid) {
      return Response.json({ error: 'Verification failed. Please try again.' }, { status: 403 });
    }

    const name = sanitizeField('name', body.name);
    const email = sanitizeField('email', body.email);
    const company = sanitizeField('company', body.company);
    const message = sanitizeField('message', body.message);

    if (!name || !email || !message) {
      return Response.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return Response.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    const htmlContent = `
      <h2>New Contact Form Submission</h2>
      ${buildHtmlTable({ Name: name, Email: email, Company: company, Message: message })}
    `;

    await sendEmail(env.BREVO_API_KEY, {
      subject: `Contact Form: ${name}`,
      htmlContent,
      replyTo: { email, name },
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'Failed to send message. Please try again.', debug: message }, { status: 500 });
  }
};
