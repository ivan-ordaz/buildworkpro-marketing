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

    const { name, email, company, trade, message } = body;
    if (!name || !email || !company) {
      return jsonResponse({ error: "Name, email, and company are required." }, 400);
    }

    const htmlContent = `
      <h2>New Early Access Request</h2>
      ${buildHtmlTable({ Name: name, Email: email, Company: company, Trade: trade, Message: message })}
    `;

    await sendEmail(env, {
      subject: `Early Access Request: ${company}`,
      htmlContent,
      replyTo: { email, name },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("Request access form error:", err);
    return jsonResponse({ error: "Failed to send request. Please try again." }, 500);
  }
};
