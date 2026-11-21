import { NextResponse, type NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, fromError, limited, looksLikeBot, readJson, sameOrigin, silentOk } from "@/lib/passport/route";
import { isEmail } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

/** Always the same answer, whether or not the email belongs to a member. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-form");
  if (stop) return stop;
  const body = await readJson(req);
  if (looksLikeBot(body)) return silentOk();
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  if (!isEmail(email)) return bad("Enter the email you use for Passport.");
  try {
    await passport("POST", "/forgot", { body: { email } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fromError(e, { req, bucket: "passport-form" });
  }
}
