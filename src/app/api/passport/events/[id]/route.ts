import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { rsvpBody } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/** File 09: one Passport event the member may see (a draft, or a test-only event for a real member, is "Not found"). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-member", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("GET", `/events/${id}`, { auth });
  });
}
/** RSVP: { answer: "going", guests } or { answer: "cant" }. Past capacity the Bible puts the member on the waitlist. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    const x = rsvpBody(b);
    if ("error" in x) return bad(x.error);
    return passport("POST", `/events/${id}/rsvp`, { auth, body: x.body });
  });
}
