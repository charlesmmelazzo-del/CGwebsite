import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";
import { shareBody } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/**
 * File 09: "Share with a friend": { kind, id, to: [friendship numbers], note? }. The Bible checks the member may share
 * it (and owns it, for a list or recipe), that each one is a friend, and that it opens for them only if they may open it.
 */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const x = shareBody(b);
    if ("error" in x) return bad(x.error, x.error === "Not found" ? 404 : 400);
    return passport("POST", "/share", { auth, body: x.body });
  });
}
