type Env = {
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  BREVO_RECIPIENT_EMAIL: string;
};

export async function sendEmail(
  env: Env,
  opts: { subject: string; htmlContent: string; replyTo?: { email: string; name?: string } },
) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: env.BREVO_RECIPIENT_EMAIL }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error (${res.status}): ${err}`);
  }

  return res.json();
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildHtmlTable(fields: Record<string, string>) {
  const rows = Object.entries(fields)
    .map(([label, value]) => `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px">${escapeHtml(value || "(not provided)")}</td></tr>`)
    .join("");
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${rows}</table>`;
}
