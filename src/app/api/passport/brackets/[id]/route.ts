import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { bracketVoteBody } from "@/lib/passport/votes";

export const dynamic = "force-dynamic";

/** File 10: one bracket this member may see, the whole tree. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-member", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("GET", `/brackets/${id}`, { auth });
  });
}
/** Vote in one matchup of the current round (or change it): { matchup_id, pick: "a" | "b" }. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-votes", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    const x = bracketVoteBody(b);
    if ("error" in x) return bad(x.error);
    return passport("POST", `/brackets/${id}/vote`, { auth, body: x.body });
  });
}
