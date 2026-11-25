import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";
import { requestBody } from "@/lib/passport/bottles";

export const dynamic = "force-dynamic";

/** File 05: ask the bar for a bottle (from a bottle page, or one the bar doesn't carry). Only for the signed-in member. */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-bottles", async (auth, b) => {
    const r = requestBody(b);
    if ("error" in r) return bad(r.error, r.error === "Not found" ? 404 : 400);
    return passport("POST", "/bottles/requests", { auth, body: r.body });
  });
}
