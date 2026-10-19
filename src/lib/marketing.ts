// ─── Marketing — the email list ──────────────────────────────────────────────
//
// Two places hand us an email address:
//   * marketing_subscribers — guests who asked to hear about future pop-ups
//     (see db/marketing-subscribers.sql)
//   * Pop Up Zone guest accounts — everyone who has signed up to play
//
// The admin Marketing page shows them as ONE list with one row per address,
// whichever places it came from, ready to export as a CSV for Mailchimp.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listGuests } from "@/lib/popup/guests";

export interface MarketingContact {
  email: string;
  firstName: string;
  lastName: string;
  /** Every place this address came from, e.g. ["Pop Up Zone account", "Pop-up: Cocktail Creepypastas"]. */
  sources: string[];
  /** Asked to hear from us, as opposed to only having a Pop Up Zone account. */
  optedIn: boolean;
  /** The earliest we saw this address. */
  firstSeen: string;
}

export const ACCOUNT_SOURCE = "Pop Up Zone account";

/** Trimmed and lower-cased, or null if it isn't a plausible address. */
export function normalizeEmail(input: unknown): string | null {
  const email = String(input ?? "").trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Add one sign-up. Signing up again with the same address is not an error —
 * the unique index keeps the original row and its date.
 */
export async function addSubscriber(email: string, source: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("marketing_subscribers")
    .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    console.error("[marketing] addSubscriber failed", error);
    return false;
  }
  return true;
}

/** Everyone, one row per address, newest first. */
export async function listMarketingContacts(): Promise<MarketingContact[]> {
  noStore();
  const sb = getSupabaseAdmin();
  const [{ data: subs, error }, guests] = await Promise.all([
    sb.from("marketing_subscribers").select("email, source, created_at"),
    listGuests(),
  ]);
  // 42P01 = the table doesn't exist yet (db/marketing-subscribers.sql not run):
  // still show the account emails rather than an error.
  if (error && error.code !== "42P01") throw error;

  const byEmail = new Map<string, MarketingContact>();
  const add = (
    rawEmail: string,
    source: string,
    seen: string,
    extra: { firstName?: string; lastName?: string; optedIn?: boolean }
  ) => {
    const email = normalizeEmail(rawEmail);
    if (!email) return;
    const c =
      byEmail.get(email) ??
      { email, firstName: "", lastName: "", sources: [], optedIn: false, firstSeen: seen };
    if (!c.sources.includes(source)) c.sources.push(source);
    if (seen < c.firstSeen) c.firstSeen = seen;
    c.firstName ||= extra.firstName ?? "";
    c.lastName ||= extra.lastName ?? "";
    c.optedIn ||= Boolean(extra.optedIn);
    byEmail.set(email, c);
  };

  for (const g of guests) {
    add(g.email, ACCOUNT_SOURCE, g.createdAt, { firstName: g.firstName, lastName: g.lastName });
  }
  for (const s of subs ?? []) {
    add(String(s.email), String(s.source), String(s.created_at), { optedIn: true });
  }

  return Array.from(byEmail.values()).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
}

/** Mailchimp's import recognises these column names as-is. */
export function contactsToCsv(contacts: MarketingContact[]): string {
  const cell = (v: string) => {
    // Quote everything; neutralise a leading = + - @ so spreadsheets don't run it as a formula.
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = [
    ["Email Address", "First Name", "Last Name", "Asked To Hear From Us", "Source", "First Seen"],
    ...contacts.map((c) => [
      c.email,
      c.firstName,
      c.lastName,
      c.optedIn ? "Yes" : "No",
      c.sources.join("; "),
      c.firstSeen.slice(0, 10),
    ]),
  ];
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
