import { NextResponse, type NextRequest } from "next/server";
import { passport, type Me } from "@/lib/passport/bible";
import { bad, fromError, limited, readJson, sameOrigin } from "@/lib/passport/route";
import { currentAuth } from "@/lib/passport/session";
import { isUsPhone, phoneDigits } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

/** The member's own account settings: marketing email on or off, "Suggest things for me", "Share order history with my household", and a phone number when theirs was taken. */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-member");
  if (stop) return stop;
  const auth = currentAuth();
  if (!auth) return NextResponse.json({ error: "Please sign in again.", signed_out: true }, { status: 401 });
  const body = await readJson(req);
  const change: Record<string, unknown> = {};
  if (typeof body.marketing_consent === "boolean") change.marketing_consent = body.marketing_consent;
  // File 12: "Suggest things for me".
  if (typeof body.suggest === "boolean") change.suggest = body.suggest;
  // File 13: "Share order history with my household".
  if (typeof body.household_history === "boolean") change.household_history = body.household_history;
  if (typeof body.phone === "string") {
    if (!isUsPhone(body.phone)) return bad("Enter a 10-digit phone number.");
    change.phone = phoneDigits(body.phone);
  }
  if (!Object.keys(change).length) return bad("Nothing to change.");
  try {
    const out = await passport<Me>("PUT", "/me", { auth, body: change });
    return NextResponse.json(out);
  } catch (e) {
    return fromError(e);
  }
}
