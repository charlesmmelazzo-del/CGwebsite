import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, isKind, memberRequest, posInt } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 04: favorite or unfavorite a cocktail or bottle (one tap). Only the signed-in member's own. */
export async function PUT(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(b.id);
    if (!isKind(b.kind) || !id) return bad("Something is missing.");
    return passport("PUT", "/personal/favorite", { auth, body: { kind: b.kind, id, on: b.on === true } });
  });
}

/** Remove one of their favorites by its record number (works even when the item no longer opens). */
export async function DELETE(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const ref = posInt(b.ref);
    if (!ref) return bad("Something is missing.");
    return passport("DELETE", `/personal/favorites/${ref}`, { auth });
  });
}
