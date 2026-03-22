import { sendEmail, jsonResponse, corsHeaders, buildHtmlTable, verifyTurnstile, sanitizeField, isValidEmail } from "./_brevo";

type Env = {
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  BREVO_RECIPIENT_EMAIL: string;
  TURNSTILE_SECRET_KEY: string;
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json()) as Record<string, string>;

    const turnstileToken = body["cf-turnstile-response"];
    if (!turnstileToken) {
      return jsonResponse({ error: "Verification required." }, 400);
    }
    const ip = request.headers.get("CF-Connecting-IP") || undefined;
    const valid = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip);
    if (!valid) {
      return jsonResponse({ error: "Verification failed. Please try again." }, 403);
    }

    const name = sanitizeField("name", body.name);
    const email = sanitizeField("email", body.email);
    const company = sanitizeField("company", body.company);
    const message = sanitizeField("message", body.message);

    if (!name || !email || !message) {
      return jsonResponse({ error: "Name, email, and message are required." }, 400);
    }
    if (!isValidEmail(email)) {
      return jsonResponse({ error: "Please provide a valid email address." }, 400);
    }

    const htmlContent = `
      <h2>New Contact Form Submission</h2>
      ${buildHtmlTable({ Name: name, Email: email, Company: company, Message: message })}
    `;

    await sendEmail(env, {
      subject: `Contact Form: ${name}`,
      htmlContent,
      replyTo: { email, name },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return jsonResponse({ error: "Failed to send message. Please try again." }, 500);
  }
};
