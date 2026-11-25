import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { flightVoteBody } from "@/lib/passport/votes";

export const dynamic = "force-dynamic";

/** File 10: one flight vote this member may see (open, or finished with its results). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-member", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("GET", `/votes/flights/${id}`, { auth });
  });
}
/** Vote in one slot (or change it) while voting is open: { slot_id, option_id }. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-votes", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    const x = flightVoteBody(b);
    if ("error" in x) return bad(x.error);
    return passport("POST", `/votes/flights/${id}/vote`, { auth, body: x.body });
  });
}
