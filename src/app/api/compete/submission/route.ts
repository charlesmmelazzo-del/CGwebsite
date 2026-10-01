import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendFormNotification } from "@/lib/email";
import { fillTemplate } from "@/lib/compete/defaults";
import {
  getContestantByToken,
  getEventById,
  getSponsorByToken,
  submissionLocked,
} from "@/lib/compete/data";
import { cleanContestant, cleanSponsor, missingContestant, missingSponsor } from "@/lib/compete/submissions";

export const dynamic = "force-dynamic";

/**
 * POST { kind: "contestant" | "partner", token, action: "save" | "submit", data }
 *
 * The private-link forms. "save" keeps progress as they move through the
 * steps; "submit" sends it to the admin for review. Locked once approved, or
 * after the deadline unless the admin reopened it or asked for changes.
 */
export async function POST(req: NextRequest) {
  let body: { kind?: string; token?: string; action?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const submit = body.action === "submit";
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (body.kind === "contestant") {
    const c = await getContestantByToken(String(body.token ?? ""));
    const ev = c && (await getEventById(c.eventId));
    if (!c || !ev) return NextResponse.json({ error: "This link isn’t valid." }, { status: 404 });
    const locked = submissionLocked(c, ev.contestantDeadline);
    if (locked) return NextResponse.json({ error: "This submission is locked.", locked }, { status: 409 });

    const clean = cleanContestant(body.data, ev);
    if (submit) {
      const missing = missingContestant(clean, ev);
      if (missing.length) return NextResponse.json({ error: `Please fill in: ${missing.join(", ")}.` }, { status: 400 });
    }
    const update: Record<string, unknown> = {
      contact: clean.contact,
      bartender: clean.bartender,
      cocktail: clean.cocktail,
    };
    if (clean.agreed && !c.agreedAt) {
      update.agreed_at = now;
      update.agreed_rules = fillTemplate(ev.rulesText, ev);
    }
    if (submit) {
      update.status = "submitted";
      update.submitted_at = now;
      update.reopened = false;
    }
    const { error } = await sb.from("comp_contestants").update(update).eq("id", c.id);
    if (error) {
      console.error("[compete/submission]", error);
      return NextResponse.json({ error: "We couldn’t save that. Please try again." }, { status: 500 });
    }
    if (submit) {
      await sendFormNotification(`Competition entry — ${ev.name}`, {
        bartender: clean.bartender.name,
        bar: clean.bartender.bar,
        cocktail: clean.cocktail.name,
        email: clean.contact.email,
        phone: clean.contact.phone,
        review: "Review and approve it in Admin → Competitions.",
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, status: submit ? "submitted" : c.status });
  }

  if (body.kind === "partner") {
    const s = await getSponsorByToken(String(body.token ?? ""));
    const ev = s && (await getEventById(s.eventId));
    if (!s || !ev) return NextResponse.json({ error: "This link isn’t valid." }, { status: 404 });
    const locked = submissionLocked(s, ev.partnerDeadline);
    if (locked) return NextResponse.json({ error: "This submission is locked.", locked }, { status: 409 });

    const clean = cleanSponsor(body.data);
    if (submit) {
      const missing = missingSponsor(clean);
      if (missing.length) return NextResponse.json({ error: `Please fill in: ${missing.join(", ")}.` }, { status: 400 });
    }
    const update: Record<string, unknown> = { contact: clean.contact, profile: clean.profile };
    if (submit) {
      update.status = "submitted";
      update.submitted_at = now;
      update.reopened = false;
    }
    const { error } = await sb.from("comp_sponsors").update(update).eq("id", s.id);
    if (error) {
      console.error("[compete/submission]", error);
      return NextResponse.json({ error: "We couldn’t save that. Please try again." }, { status: 500 });
    }
    if (submit) {
      await sendFormNotification(`Brand partner profile — ${ev.name}`, {
        brand: clean.profile.brandName,
        contact: clean.contact.name,
        email: clean.contact.email,
        phone: clean.contact.phone,
        review: "Review and approve it in Admin → Competitions.",
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, status: submit ? "submitted" : s.status });
  }

  return NextResponse.json({ error: "Invalid request." }, { status: 400 });
}
