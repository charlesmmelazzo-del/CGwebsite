import { NextResponse, type NextRequest } from "next/server";
import { passport, type SignedIn } from "@/lib/passport/bible";
import { bad, fromError, limited, looksLikeBot, readJson, sameOrigin, signedInResponse } from "@/lib/passport/route";
import { canSignIn } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-signin");
  if (stop) return stop;
  const body = await readJson(req);
  // The hidden field or an instant submit: answer like a wrong password and do nothing.
  if (looksLikeBot(body)) return bad("That email and password do not match.");
  if (!canSignIn()) return NextResponse.json({ error: "Passport is temporarily unavailable." }, { status: 503 });
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!email || !password) return bad("Enter your email and password.");
  try {
    const out = await passport<SignedIn>("POST", "/signin", { body: { email, password } });
    return signedInResponse(out);
  } catch (e) {
    return fromError(e, { req, bucket: "passport-signin" });
  }
}
