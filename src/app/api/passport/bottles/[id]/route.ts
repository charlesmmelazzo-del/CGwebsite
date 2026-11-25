import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { isAction } from "@/lib/passport/bottles";

export const dynamic = "force-dynamic";

/**
 * File 05: the member's answer on one of their own requests: { action: "accept", quote_id } | { action: "decline" } |
 * { action: "cancel" }. The Bible refuses anyone else's request ("Not found") and anything not allowed now.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-bottles", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    if (!isAction(b.action)) return bad("Choose accept, decline or cancel");
    if (b.action === "accept") {
      const quoteId = posInt(b.quote_id);
      if (!quoteId) return bad("This price has changed. Please look again.", 409);
      return passport("POST", `/bottles/requests/${id}/accept`, { auth, body: { quote_id: quoteId } });
    }
    return passport("POST", `/bottles/requests/${id}/${b.action}`, { auth });
  });
}
