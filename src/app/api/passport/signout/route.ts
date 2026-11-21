import { NextResponse, type NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, sameOrigin } from "@/lib/passport/route";
import { clearCookie, currentAuth } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const auth = currentAuth();
  // Ends the sign-in in the Bible too; the cookie goes either way.
  if (auth) await passport("POST", "/signout", { auth }).catch(() => {});
  const res = NextResponse.json({ ok: true });
  clearCookie(res);
  return res;
}
