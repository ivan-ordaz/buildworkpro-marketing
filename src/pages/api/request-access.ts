import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { sendEmail, verifyTurnstile, sanitizeField, isValidEmail, buildHtmlTable, type Env } from '../../lib/brevo';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const cfEnv = env as unknown as Env;
    const body = (await request.json()) as Record<string, string>;

    const turnstileToken = body["cf-turnstile-response"];
    if (!turnstileToken) {
      return new Response(JSON.stringify({ error: "Verification required." }), { status: 400 });
    }
    const ip = request.headers.get("CF-Connecting-IP") || undefined;
    const valid = await verifyTurnstile(cfEnv.TURNSTILE_SECRET_KEY, turnstileToken, ip);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Verification failed. Please try again." }), { status: 403 });
    }

    const name = sanitizeField("name", body.name);
    const email = sanitizeField("email", body.email);
    const company = sanitizeField("company", body.company);
    const trade = sanitizeField("trade", body.trade);
    const message = sanitizeField("message", body.message);

    if (!name || !email || !company) {
      return new Response(JSON.stringify({ error: "Name, email, and company are required." }), { status: 400 });
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Please provide a valid email address." }), { status: 400 });
    }

    const htmlContent = `
      <h2>New Early Access Request</h2>
      ${buildHtmlTable({ Name: name, Email: email, Company: company, Trade: trade, Message: message })}
    `;

    await sendEmail(cfEnv.BREVO_API_KEY, {
      subject: `Early Access Request: ${company}`,
      htmlContent,
      replyTo: { email, name },
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error("Request access form error:", err);
    return new Response(JSON.stringify({ error: "Failed to send request. Please try again." }), { status: 500 });
  }
};
