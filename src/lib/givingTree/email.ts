// ─── The Giving Tree — emails (8) ────────────────────────────────────────────
//
// Sent through Resend, the email service the site already uses for form
// notifications, from the verified commongoodcocktailhouse.com domain, with
// replies going to the contact email in the Giving Tree settings.
// Plain, warm and short. Subjects carry "[TEST]" until the pop-up is live.
//
// Without RESEND_API_KEY (local development) emails are printed to the server
// log instead of sent, so every flow can still be followed end to end.

import "server-only";
import { Resend } from "resend";
import { getNotificationRecipients } from "@/lib/email";
import { COPY, EMAIL_COPY } from "./copy";
import { longDate, time12 } from "./format";
import { hoursLabel, money } from "./rules";
import type { Opportunity, Org, Pledge, Settings } from "./types";

const FROM = `${EMAIL_COPY.senderName} <forms@commongoodcocktailhouse.com>`;

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Block = { kind: "p"; text: string } | { kind: "strong"; text: string } | { kind: "button"; text: string; href: string } | { kind: "small"; text: string };

function render(blocks: Block[]): { html: string; text: string } {
  const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.55;font-size:16px;">
${blocks
  .map((b) => {
    if (b.kind === "p") return `<p style="margin:0 0 16px;">${esc(b.text).replace(/\n/g, "<br>")}</p>`;
    if (b.kind === "strong")
      return `<p style="margin:0 0 18px;padding:14px 16px;background:#f4efe3;border-left:4px solid #2d3b1f;font-size:17px;"><strong>${esc(b.text)}</strong></p>`;
    if (b.kind === "small") return `<p style="margin:16px 0 0;font-size:13px;color:#777;">${esc(b.text)}</p>`;
    return `<p style="margin:0 0 12px;"><a href="${esc(b.href)}" style="display:inline-block;padding:11px 18px;background:#2d3b1f;color:#fff;text-decoration:none;border-radius:4px;">${esc(b.text)}</a></p>`;
  })
  .join("\n")}
</div>`;
  const text = blocks.map((b) => (b.kind === "button" ? `${b.text}: ${b.href}` : b.text)).join("\n\n");
  return { html, text };
}

async function send(to: string, subject: string, blocks: Block[], opts: { test: boolean; replyTo: string }): Promise<boolean> {
  const fullSubject = `${opts.test ? EMAIL_COPY.testPrefix : ""}${subject}`;
  const { html, text } = render(blocks);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[giving-tree email, not sent: RESEND_API_KEY missing]\nTo: ${to}\nSubject: ${fullSubject}\n\n${text}\n`);
    return false;
  }
  try {
    const { error } = await new Resend(apiKey).emails.send({ from: FROM, to: [to], replyTo: opts.replyTo, subject: fullSubject, html, text });
    if (error) {
      console.error("[giving-tree email] Resend error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[giving-tree email] failed:", e);
    return false;
  }
}

export function manageUrl(origin: string, token: string, action?: "still" | "more" | "release"): string {
  return `${origin}/popup/giving-tree/manage/${encodeURIComponent(token)}${action ? `?do=${action}` : ""}`;
}

export interface EmailCtx {
  origin: string;
  test: boolean;
  settings: Settings;
}

/** What they signed up for, in one line. */
function whatLine(p: Pledge, o: Opportunity): string {
  if (o.type === "volunteer") {
    const h = p.hours ?? o.hoursFixed;
    const when = o.eventDate ? ` on ${longDate(o.eventDate)}${o.startTime ? `, ${time12(o.startTime)}${o.endTime ? `–${time12(o.endTime)}` : ""}` : ""}` : "";
    return `${o.title}${when}${h ? ` (${hoursLabel(h)})` : ""}`;
  }
  if (o.type === "cash") return `${money(p.amount ?? 0)} toward ${o.title}`;
  return o.title;
}

export async function sendConfirmation(p: Pledge, o: Opportunity, org: Org, ctx: EmailCtx): Promise<boolean> {
  if (!p.email) return false;
  const link = manageUrl(ctx.origin, p.manageToken);
  const s = ctx.settings;
  const blocks: Block[] = [{ kind: "p", text: `Hi ${p.name},` }];

  if (o.type === "gift") {
    blocks.push({ kind: "strong", text: COPY.giftCodeFirst(p.code) });
    blocks.push({ kind: "p", text: `You're bringing: ${o.title}${o.description ? `. ${o.description}` : ""}` });
    blocks.push({ kind: "p", text: `Where: ${o.dropoffInstructions || s.defaultDropoff}` });
    if (p.dueDate) blocks.push({ kind: "p", text: `By when: ${longDate(p.dueDate)}.` });
  } else if (o.type === "volunteer") {
    blocks.push({ kind: "p", text: `Thank you for signing up to volunteer with ${org.name}: ${whatLine(p, o)}.` });
    blocks.push({ kind: "p", text: COPY.volunteerNext(org.name) });
    if (o.location) blocks.push({ kind: "p", text: `Location: ${o.location}` });
    blocks.push({ kind: "p", text: `Your code is ${p.code}.` });
  } else {
    blocks.push({ kind: "p", text: `Thank you for pledging ${money(p.amount ?? 0)} toward ${o.title} with ${org.name}.` });
    blocks.push({ kind: "p", text: `We never handle the money. If you haven't yet, make your gift on ${org.name}'s own giving page:` });
    if (o.giveUrl) blocks.push({ kind: "button", text: COPY.cashContinue(org.name), href: o.giveUrl });
    blocks.push({ kind: "p", text: `Your code is ${p.code}.` });
  }

  blocks.push({ kind: "p", text: EMAIL_COPY.trust });
  blocks.push({ kind: "button", text: EMAIL_COPY.manageLink, href: link });
  blocks.push({ kind: "p", text: EMAIL_COPY.signoff });
  blocks.push({ kind: "small", text: COPY.manageQuestions(s.contactEmail) });
  return send(p.email, EMAIL_COPY.confirmSubject[o.type](o.title), blocks, { test: ctx.test, replyTo: s.contactEmail });
}

export async function sendReminder(p: Pledge, o: Opportunity, ctx: EmailCtx): Promise<boolean> {
  if (!p.email || !p.dueDate) return false;
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${p.name},` },
    { kind: "p", text: EMAIL_COPY.reminderIntro(longDate(p.dueDate)) },
    { kind: "strong", text: COPY.giftCodeFirst(p.code) },
    { kind: "p", text: `You're bringing: ${o.title}. Where: ${o.dropoffInstructions || ctx.settings.defaultDropoff}` },
    { kind: "button", text: COPY.manageStillOnIt, href: manageUrl(ctx.origin, p.manageToken, "still") },
  ];
  if (!p.extendedOnce) blocks.push({ kind: "button", text: COPY.manageMoreTime, href: manageUrl(ctx.origin, p.manageToken, "more") });
  blocks.push({ kind: "button", text: "Release it", href: manageUrl(ctx.origin, p.manageToken, "release") });
  blocks.push({ kind: "p", text: EMAIL_COPY.trust });
  blocks.push({ kind: "p", text: EMAIL_COPY.signoff });
  blocks.push({ kind: "small", text: COPY.manageQuestions(ctx.settings.contactEmail) });
  return send(p.email, EMAIL_COPY.reminderSubject(o.title), blocks, { test: ctx.test, replyTo: ctx.settings.contactEmail });
}

export async function sendReleaseThanks(p: Pledge, o: Opportunity, ctx: EmailCtx): Promise<boolean> {
  if (!p.email) return false;
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${p.name},` },
    { kind: "p", text: COPY.manageReleasedBody },
    { kind: "p", text: `(${o.title}, code ${p.code})` },
    { kind: "p", text: EMAIL_COPY.trust },
    { kind: "p", text: EMAIL_COPY.signoff },
  ];
  return send(p.email, EMAIL_COPY.releaseSubject, blocks, { test: ctx.test, replyTo: ctx.settings.contactEmail });
}

/** Tell the staff notification list a pledge was released (5.1). */
export async function notifyAdminRelease(p: Pledge, o: Opportunity, org: Org, reason: string, ctx: EmailCtx): Promise<void> {
  let recipients: string[] = [];
  try {
    recipients = await getNotificationRecipients();
  } catch {
    // fall through
  }
  const blocks: Block[] = [
    { kind: "p", text: `Pledge ${p.code} was released (${reason === "auto" ? "automatically, past due with no answer" : reason === "guest" ? "by the guest" : "in the admin"}).` },
    { kind: "p", text: `${org.name}: ${o.title}\n${p.name}${p.email ? ` <${p.email}>` : ""}` },
    { kind: "p", text: "The spot is back on the tree. Their star stays in the sky and their ornament stays on the wall." },
    { kind: "button", text: "Open the Giving Tree admin", href: `${ctx.origin}/admin/popup/giving-tree` },
  ];
  for (const to of recipients) {
    await send(to, EMAIL_COPY.adminReleaseSubject(p.code), blocks, { test: ctx.test, replyTo: ctx.settings.contactEmail });
  }
}
