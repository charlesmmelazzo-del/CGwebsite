import { NextResponse, type NextRequest } from "next/server";
import { passport, type SignedIn } from "@/lib/passport/bible";
import { bad, fromError, limited, looksLikeBot, readJson, sameOrigin, signedInResponse, silentOk } from "@/lib/passport/route";
import { canSignIn } from "@/lib/passport/session";
import { isEmail, isUsPhone, phoneDigits } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 100) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Sign-up. Built but hidden: while the Bible's sign-up setting is off, the
 * Bible refuses this (403) no matter who calls it.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-form");
  if (stop) return stop;
  const body = await readJson(req);
  if (looksLikeBot(body)) return silentOk();
  if (!canSignIn()) return NextResponse.json({ error: "Passport is temporarily unavailable." }, { status: 503 });

  const email = str(body.email, 200);
  const phone = str(body.phone, 40);
  if (!str(body.first_name) || !str(body.last_name)) return bad("Enter your first and last name.");
  if (!isEmail(email)) return bad("Enter a valid email address.");
  if (!isUsPhone(phone)) return bad("Enter a 10-digit phone number.");
  const household = (Array.isArray(body.household) ? body.household : []).slice(0, 6)
    .map((h) => (h && typeof h === "object" ? (h as Record<string, unknown>) : {}))
    .map((h) => ({ first_name: str(h.first_name), last_name: str(h.last_name), email: str(h.email, 200) }))
    .filter((h) => h.first_name || h.last_name || h.email);
  for (const h of household) {
    if (!h.first_name || !h.last_name || !isEmail(h.email)) return bad("Each person in your household needs a first name, last name and email.");
  }
  try {
    const out = await passport<SignedIn>("POST", "/signup", {
      body: {
        first_name: str(body.first_name), last_name: str(body.last_name), email, phone: phoneDigits(phone),
        password: typeof body.password === "string" ? body.password.slice(0, 200) : "",
        age_confirmed: body.age_confirmed === true,
        terms_version: Number(body.terms_version) || 0,
        marketing_consent: body.marketing_consent === true,
        household,
      },
    });
    return signedInResponse(out, { household_invited: out.household_invited ?? 0 });
  } catch (e) {
    return fromError(e, { req, bucket: "passport-form" });
  }
}
