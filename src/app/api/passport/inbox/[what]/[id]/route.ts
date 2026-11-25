import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { textBody } from "@/lib/passport/inbox";

export const dynamic = "force-dynamic";

/** The member's own thread, request or inquiry by number (anyone else's is "Not found" at the Bible). */
const WHAT = { threads: ["reply"], requests: ["cancel", "answer"], events: ["cancel", "reply"] } as const;
type What = keyof typeof WHAT;
const isWhat = (v: string): v is What => v in WHAT;

/** Open one (it is then read, and no email goes out about it while it stays open). The open conversation asks every 30 seconds. */
export async function GET(req: NextRequest, { params }: { params: { what: string; id: string } }) {
  return memberRequest(req, "passport-inbox-read", async (auth) => {
    const id = posInt(params.id);
    if (!id || !isWhat(params.what)) return bad("Not found", 404);
    return passport("GET", `/inbox/${params.what}/${id}`, { auth });
  });
}

/** { action: "reply" | "answer", body } or { action: "cancel" }: the only things a member can do to their own. */
export async function POST(req: NextRequest, { params }: { params: { what: string; id: string } }) {
  return memberRequest(req, "passport-inbox", async (auth, b) => {
    const id = posInt(params.id);
    if (!id || !isWhat(params.what)) return bad("Not found", 404);
    const action = typeof b.action === "string" ? b.action : "";
    if (!(WHAT[params.what] as readonly string[]).includes(action)) return bad("That can't be done here");
    if (action === "cancel") return passport("POST", `/inbox/${params.what}/${id}/cancel`, { auth });
    const x = textBody(b);
    if ("error" in x) return bad(x.error);
    return passport("POST", `/inbox/${params.what}/${id}/${action}`, { auth, body: x.body });
  });
}
