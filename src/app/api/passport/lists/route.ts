import type { NextRequest } from "next/server";
import { getLists, passport } from "@/lib/passport/bible";
import { bad, isKind, memberRequest, posInt, text } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 06: the member's own lists, for the "+ add to list" sheet. */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-member", async (auth) => ({ lists: await getLists(auth) }));
}

/** File 04: make a list (cocktails or bottles; a playlist, or a top 10). Private to the member. */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const name = text(b.name, 61).trim();
    if (!name) return bad("Give the list a name.");
    if (!isKind(b.kind)) return bad("Choose cocktails or bottles.");
    return passport("POST", "/lists", { auth, body: { name, kind: b.kind, ranked: b.ranked === true } });
  });
}

/** Put the member's lists in a new order: every one of their list numbers, in order. */
export async function PUT(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const ids = Array.isArray(b.ids) ? b.ids.slice(0, 200).map(posInt) : [];
    if (!ids.length || ids.some((x) => !x)) return bad("Something is missing.");
    return passport("PUT", "/lists/order", { auth, body: { ids } });
  });
}
