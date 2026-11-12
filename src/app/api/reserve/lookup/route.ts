import { NextResponse, type NextRequest } from "next/server";
import { lookupGuest } from "@/lib/reserve/bible";
import { guard, fromError, readJson, bad, looksLikeBot, silentOk } from "@/lib/reserve/route";
import { isEmail, isUsPhone, phoneDigits } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

// Rate-limited tighter than other reads: this is the route someone would use
// to probe which phone numbers belong to guests.
export async function POST(req: NextRequest) {
  const stop = guard(req, "lookup");
  if (stop) return stop;
  const body = await readJson(req);
  if (looksLikeBot(body)) return silentOk();

  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return bad("Enter your email or phone number.");
  let by: { email: string } | { phone: string };
  if (value.includes("@")) {
    if (!isEmail(value)) return bad("That email address doesn't look right.");
    by = { email: value.slice(0, 200) };
  } else {
    if (!isUsPhone(value)) return bad("Enter a 10-digit phone number, or your email.");
    by = { phone: phoneDigits(value) };
  }
  try {
    const out = await lookupGuest(by);
    // Only the masked hints and the short-lived lookup token ever reach the browser.
    if (out.match) return NextResponse.json({ match: true, masked: out.masked, lookup_token: out.lookup_token });
    return NextResponse.json({ match: false });
  } catch (e) {
    return fromError(e);
  }
}
