import { NextResponse, type NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, fromError, limited, looksLikeBot, readJson, sameOrigin, silentOk } from "@/lib/passport/route";
import { currentAuth } from "@/lib/passport/session";
import { isEmail } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Invite someone in the member's household. They are emailed a link and set
 * their own password. Refused by the Bible while sign-up is off, except for
 * test members.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-form");
  if (stop) return stop;
  const auth = currentAuth();
  if (!auth) return NextResponse.json({ error: "Please sign in again.", signed_out: true }, { status: 401 });
  const body = await readJson(req);
  if (looksLikeBot(body)) return silentOk();
  const h = { first_name: str(body.first_name), last_name: str(body.last_name), email: str(body.email, 200) };
  if (!h.first_name || !h.last_name) return bad("Enter their first and last name.");
  if (!isEmail(h.email)) return bad("Enter their email address.");
  try {
    // The same answer whether or not that email already has a Passport (then they are emailed and nobody is added).
    await passport<{ ok: true }>("POST", "/household", { auth, body: h });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fromError(e, { req, bucket: "passport-form" });
  }
}
