import { NextResponse, type NextRequest } from "next/server";
import { passport, type LinkInfo, type SignedIn } from "@/lib/passport/bible";
import { bad, fromError, limited, readJson, sameOrigin, signedInResponse } from "@/lib/passport/route";
import { canSignIn } from "@/lib/passport/session";
import { isUsPhone, phoneDigits } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;

/**
 * One-time links from Passport emails (set a first password, or reset one).
 *   { action: "check", token }  → what the screen needs (first name, whether details are still needed)
 *   { action: "use", token, password, … } → set the password and sign in on this device
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const body = await readJson(req);
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token)) return bad("This link has expired or has already been used. Ask for a new one from the sign-in screen.");

  if (body.action === "check") {
    const stop = limited(req, "passport-member");
    if (stop) return stop;
    try {
      const out = await passport<{ link: LinkInfo }>("POST", "/link/check", { body: { token } });
      return NextResponse.json(out.link);
    } catch (e) {
      return fromError(e);
    }
  }

  const stop = limited(req, "passport-signin");
  if (stop) return stop;
  if (!canSignIn()) return NextResponse.json({ error: "Passport is temporarily unavailable." }, { status: 503 });
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  if (phone && !isUsPhone(phone)) return bad("Enter a 10-digit phone number.");
  try {
    const out = await passport<SignedIn>("POST", "/link/use", {
      body: {
        token,
        password,
        ...(phone ? { phone: phoneDigits(phone) } : {}),
        age_confirmed: body.age_confirmed === true,
        terms_version: Number(body.terms_version) || 0,
        marketing_consent: body.marketing_consent === true,
      },
    });
    return signedInResponse(out);
  } catch (e) {
    return fromError(e, { req, bucket: "passport-signin" });
  }
}
