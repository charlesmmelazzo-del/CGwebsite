import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt, text } from "@/lib/passport/route";
import { commentBody } from "@/lib/passport/votes";

export const dynamic = "force-dynamic";

/** File 10: change the member's own comment (within 10 minutes; the Bible checks). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-comments", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    const x = commentBody({ body: b.body });
    if ("error" in x) return bad(x.error);
    return passport("PUT", `/comments/${id}`, { auth, body: { body: x.body.body } });
  });
}
/** Delete the member's own comment, any time. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-comments", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("DELETE", `/comments/${id}`, { auth });
  });
}
/** { action: "report", reason } or { action: "block" } (file 09's silent block of the comment's author). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-comments", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    if (b.action === "report") return passport("POST", `/comments/${id}/report`, { auth, body: { reason: text(b.reason, 500) } });
    if (b.action === "block") return passport("POST", `/comments/${id}/block`, { auth });
    return bad("Not found", 404);
  });
}
