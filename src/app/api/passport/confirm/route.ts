import { NextResponse, type NextRequest } from "next/server";
import { passport, type SignedIn } from "@/lib/passport/bible";
import { bad, fromError, limited, readJson, sameOrigin, signedInResponse } from "@/lib/passport/route";
import { canSignIn } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;

/** The link in the sign-up confirmation email: the Bible creates the member, and they're signed in here. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-signin");
  if (stop) return stop;
  if (!canSignIn()) return NextResponse.json({ error: "Passport is temporarily unavailable." }, { status: 503 });
  const body = await readJson(req);
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token)) return bad("This link has expired or has already been used. You can sign up again; it only takes a minute.");
  try {
    const out = await passport<SignedIn>("POST", "/signup/confirm", { body: { token } });
    return signedInResponse(out);
  } catch (e) {
    return fromError(e, { req, bucket: "passport-signin" });
  }
}
