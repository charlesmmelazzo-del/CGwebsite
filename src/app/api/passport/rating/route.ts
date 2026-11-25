import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 04: the member's own 1 to 5 stars for a cocktail; null clears it. */
export async function PUT(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(b.id);
    const stars = b.stars === null ? null : posInt(b.stars);
    if (!id || (stars !== null && stars > 5)) return bad("Choose 1 to 5 stars.");
    return passport("PUT", "/personal/rating", { auth, body: { id, stars } });
  });
}

export async function DELETE(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const ref = posInt(b.ref);
    if (!ref) return bad("Something is missing.");
    return passport("DELETE", `/personal/ratings/${ref}`, { auth });
  });
}
