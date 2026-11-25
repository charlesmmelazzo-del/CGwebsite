import type { NextRequest } from "next/server";
import { findAll } from "@/lib/passport/bible";
import { memberRequest } from "@/lib/passport/route";
import { searchable } from "@/lib/passport/shell";

export const dynamic = "force-dynamic";

/**
 * File 06: the one search bar (Menu and Index). Cocktails, bottles and producers, only what the signed-in member may
 * open (the Bible decides). Members only, rate limited per IP; nothing is sent for fewer than two letters.
 */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-search", async (auth) => {
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    if (!searchable(q)) return { cocktails: [], bottles: [], producers: [] };
    return findAll(auth, q);
  });
}
