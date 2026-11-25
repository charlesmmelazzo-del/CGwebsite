import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, isKind, memberRequest } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 04: search the Library (cocktails) or the spirits list and archive (bottles) to add to a list. */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-member", async (auth) => {
    const kind = req.nextUrl.searchParams.get("kind");
    const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
    if (!isKind(kind)) return bad("Choose cocktails or bottles.");
    return passport("GET", `/personal/search?${new URLSearchParams({ kind, q }).toString()}`, { auth });
  });
}
