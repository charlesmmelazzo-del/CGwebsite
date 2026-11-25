import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { messageBody } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/** File 09: one conversation the member is in (anyone else's is "Not found"). Asked every 30 seconds while open. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-social-read", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("GET", `/conversations/${id}`, { auth });
  });
}

/** { action: "send", body } or { action: "report", message_id?, reason? } (a message, or the friend in this conversation). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    if (b.action === "send") {
      const x = messageBody(b);
      if ("error" in x) return bad(x.error);
      return passport("POST", `/conversations/${id}/messages`, { auth, body: x.body });
    }
    if (b.action === "report") {
      const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
      const message = posInt(b.message_id);
      return passport("POST", "/report", { auth, body: message ? { message_id: message, reason } : { target: `thread:${id}`, reason } });
    }
    return bad("That can't be done here");
  });
}
