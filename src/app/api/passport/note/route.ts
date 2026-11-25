import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, isKind, memberRequest, posInt, text } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 04: the member's private tasting note on a cocktail or bottle (one per item). Empty deletes it. */
export async function PUT(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(b.id);
    if (!isKind(b.kind) || !id) return bad("Something is missing.");
    const body = text(b.body, 2001);
    if (body.length > 2000) return bad("Keep a note under 2000 characters.");
    return passport("PUT", "/personal/note", { auth, body: { kind: b.kind, id, body } });
  });
}

export async function DELETE(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const ref = posInt(b.ref);
    if (!ref) return bad("Something is missing.");
    return passport("DELETE", `/personal/notes/${ref}`, { auth });
  });
}
