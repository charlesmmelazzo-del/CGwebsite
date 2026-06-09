import { Resend } from "resend";

const NOTIFICATION_RECIPIENTS = [
  "mike@cgcocktails.com",
  "cheers@cgcocktails.com",
  "hello@cgcocktails.com",
];

const FROM_ADDRESS = "Common Good Website <forms@cgcocktails.com>";

function buildSubject(formName: string): string {
  const lower = formName.toLowerCase();
  if (lower.includes("event")) return "New Event Inquiry — Common Good";
  if (lower.includes("contact")) return "New Contact Message — Common Good";
  if (lower.includes("book") || lower.includes("reserv")) return "New Booking Request — Common Good";
  return `New Form Submission: ${formName} — Common Good`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(
  formName: string,
  data: Record<string, unknown>,
  opts: { intro?: string; submittedAt?: string } = {}
): string {
  const rows = Object.entries(data)
    .map(([key, val]) => {
      const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      return `
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eee;">${escapeHtml(capitalized)}</td>
          <td style="padding:8px 12px;color:#222;vertical-align:top;border-bottom:1px solid #eee;">${escapeHtml(val)}</td>
        </tr>`;
    })
    .join("");

  const intro = opts.intro ?? "A new submission was received on your website.";
  const submittedLine = opts.submittedAt
    ? `<p style="color:#888;margin:0 0 20px;font-size:13px;">Submitted ${escapeHtml(
        new Date(opts.submittedAt).toLocaleString()
      )}</p>`
    : "";

  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#2d3b1f;padding:24px 32px;">
        <p style="margin:0;color:#c8b878;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Common Good Cocktail House</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:normal;">${escapeHtml(formName)}</h1>
      </div>
      <div style="padding:24px 32px;">
        <p style="color:#555;margin:0 0 8px;">${escapeHtml(intro)}</p>
        ${submittedLine}
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:6px;overflow:hidden;">
          ${rows}
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#aaa;">
          Submitted via commongoodcocktailhouse.com · Manage submissions in your
          <a href="https://commongoodcocktailhouse.com/admin/forms" style="color:#2d3b1f;">admin dashboard</a>
        </p>
      </div>
    </div>`;
}

export async function sendFormNotification(
  formName: string,
  data: Record<string, unknown>
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email notification");
    return;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: NOTIFICATION_RECIPIENTS,
    subject: buildSubject(formName),
    html: buildHtml(formName, data),
  });

  if (error) {
    // Log but don't throw — email failure should never block a form submission
    console.error("[email] Resend error:", error);
  }
}

// Forward a single submission to an admin-chosen recipient.
// Returns a result object so the caller can surface failures in the UI.
export async function forwardSubmission(opts: {
  to: string;
  formName: string;
  data: Record<string, unknown>;
  submittedAt?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email is not configured yet (RESEND_API_KEY is missing)." };
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [opts.to],
    subject: `Form Submission: ${opts.formName} — Common Good`,
    html: buildHtml(opts.formName, opts.data, {
      intro: "A form submission was forwarded to you from the Common Good website.",
      submittedAt: opts.submittedAt,
    }),
  });

  if (error) {
    console.error("[email] Resend forward error:", error);
    return { ok: false, error: typeof error === "object" && "message" in error ? String(error.message) : "Failed to send email." };
  }

  return { ok: true };
}
