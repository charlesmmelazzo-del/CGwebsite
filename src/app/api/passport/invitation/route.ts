import { NextResponse, type NextRequest } from "next/server";
import { bad, limited, looksLikeBot, readJson, sameOrigin, silentOk } from "@/lib/passport/route";
import { BAD_CODE, checkCode, cleanCode } from "@/lib/passport/invitation";
import { UNAVAILABLE } from "@/lib/passport/bible";

export const dynamic = "force-dynamic";

/** A typed invitation code: is it good? Few tries per person; nothing is used up. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const stop = limited(req, "passport-code");
  if (stop) return stop;
  const body = await readJson(req);
  if (looksLikeBot(body)) return silentOk();
  const code = cleanCode(body.code);
  const r = await checkCode(code);
  if (r === "ok") return NextResponse.json({ ok: true, code });
  if (r === "paused") return NextResponse.json({ error: "Too many tries right now. Please try again in a little while." }, { status: 429 });
  if (r === "unavailable") return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  return bad(BAD_CODE);
}
