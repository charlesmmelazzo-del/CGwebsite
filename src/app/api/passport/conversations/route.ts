import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { messageBody } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/** File 09: the first message to a friend: { friend_id (the friendship number), body }. Friends only (the Bible checks). */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const friend = posInt(b.friend_id);
    if (!friend) return bad("Not found", 404);
    const x = messageBody(b);
    if ("error" in x) return bad(x.error);
    return passport("POST", "/conversations", { auth, body: { friend_id: friend, body: x.body.body } });
  });
}
