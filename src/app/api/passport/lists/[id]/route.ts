import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt, text } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 04: rename one of the member's lists ({ name }), or reorder it ({ refs }: every item, in the new order). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    if (Array.isArray(b.refs)) {
      const refs = b.refs.slice(0, 600).map(posInt);
      if (!refs.length || refs.some((x) => !x)) return bad("Something is missing.");
      return passport("PUT", `/lists/${id}/items/order`, { auth, body: { refs } });
    }
    const name = text(b.name, 61).trim();
    if (!name) return bad("Give the list a name.");
    return passport("PUT", `/lists/${id}`, { auth, body: { name } });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-personal", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("DELETE", `/lists/${id}`, { auth });
  });
}
