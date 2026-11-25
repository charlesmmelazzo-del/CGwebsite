import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 04: add a cocktail or bottle (the list's kind) the member can open. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(params.id);
    const item = posInt(b.id);
    if (!id || !item) return bad("Something is missing.");
    return passport("POST", `/lists/${id}/items`, { auth, body: { id: item } });
  });
}

/** Remove one entry ({ ref }) from the list, even one that no longer opens. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(params.id);
    const ref = posInt(b.ref);
    if (!id || !ref) return bad("Something is missing.");
    return passport("DELETE", `/lists/${id}/items/${ref}`, { auth });
  });
}
