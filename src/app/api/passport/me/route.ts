import { NextResponse, type NextRequest } from "next/server";
import { passport, type Me } from "@/lib/passport/bible";
import { bad, fromError, limited, readJson, sameOrigin } from "@/lib/passport/route";
import { currentAuth } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

/** The member's own account settings. For now: marketing email on or off. */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-member");
  if (stop) return stop;
  const auth = currentAuth();
  if (!auth) return NextResponse.json({ error: "Please sign in again.", signed_out: true }, { status: 401 });
  const body = await readJson(req);
  if (typeof body.marketing_consent !== "boolean") return bad("Nothing to change.");
  try {
    const out = await passport<Me>("PUT", "/me", { auth, body: { marketing_consent: body.marketing_consent } });
    return NextResponse.json(out);
  } catch (e) {
    return fromError(e);
  }
}
