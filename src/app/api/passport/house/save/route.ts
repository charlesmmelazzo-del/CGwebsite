import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/**
 * File 07: "Save a copy to my lists". A house list ({ list }) or a chart ({ chart }) becomes a new list of the member's
 * own, with every item they can open. The Bible checks that this member may see it.
 */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(b.list);
    if (id) return passport("POST", `/bar/lists/${id}/save`, { auth });
    if (b.chart === "top" || b.chart === "critics") return passport("POST", `/bar/charts/${b.chart}/save`, { auth });
    return bad("Something is missing.");
  });
}
