import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";
import { dismissBody } from "@/lib/passport/bar";

export const dynamic = "force-dynamic";

/** File 07: hide one message from the bar, or one What's new card, for the signed-in member only. */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const body = dismissBody(b.what, b.key);
    if (!body) return bad("Something is missing.");
    return passport("POST", "/bar/dismiss", { auth, body });
  });
}
