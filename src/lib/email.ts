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

function buildHtml(formName: string, data: Record<string, unknown>): string {
  const rows = Object.entries(data)
    .map(([key, val]) => {
      const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
      const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
      return `
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eee;">${capitalized}</td>
          <td style="padding:8px 12px;color:#222;vertical-align:top;border-bottom:1px solid #eee;">${String(val ?? "")}</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#2d3b1f;padding:24px 32px;">
        <p style="margin:0;color:#c8b878;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Common Good Cocktail House</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:normal;">${formName}</h1>
      </div>
      <div style="padding:24px 32px;">
        <p style="color:#555;margin:0 0 20px;">A new submission was received on your website.</p>
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
