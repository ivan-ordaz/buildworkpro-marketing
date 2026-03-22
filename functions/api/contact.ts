import { sendEmail, jsonResponse, corsHeaders, buildHtmlTable } from "./_brevo";

type Env = {
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  BREVO_RECIPIENT_EMAIL: string;
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json()) as Record<string, string>;

    const { name, email, company, message } = body;
    if (!name || !email || !message) {
      return jsonResponse({ error: "Name, email, and message are required." }, 400);
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
