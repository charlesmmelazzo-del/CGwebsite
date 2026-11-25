import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { commentBody, isCommentType } from "@/lib/passport/votes";

export const dynamic = "force-dynamic";

/** File 10: the comments place on one curated item (null when comments are off there). Only what this member may see. */
export async function GET(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  return memberRequest(req, "passport-member", async (auth) => {
    const id = posInt(params.id);
    if (!id || !isCommentType(params.type)) return bad("Not found", 404);
    return passport("GET", `/comments/${params.type}/${id}`, { auth });
  });
}
/** Write a comment, or a reply ({ parent_id }) to a top-level comment. The Bible checks the words, the caps and the switches. */
export async function POST(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  return memberRequest(req, "passport-comments", async (auth, b) => {
    const id = posInt(params.id);
    if (!id || !isCommentType(params.type)) return bad("Not found", 404);
    const x = commentBody(b);
    if ("error" in x) return bad(x.error);
    return passport("POST", `/comments/${params.type}/${id}`, { auth, body: x.body });
  });
}
