import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 09: something shared with the member (or by them). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-member", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("GET", `/shares/${id}`, { auth });
  });
}
/** { action: "save" } (a shared list becomes the member's own copy) or { action: "dismiss" } (off Home). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    if (b.action !== "save" && b.action !== "dismiss") return bad("That can't be done here");
    return passport("POST", `/shares/${id}/${b.action}`, { auth });
  });
}
