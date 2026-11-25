import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { recipeBody } from "@/lib/passport/recipe";

export const dynamic = "force-dynamic";

/** File 04: edit one of the member's own recipes (the Bible refuses one the bar added). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    const r = recipeBody(b);
    if ("error" in r) return r.error;
    return passport("PUT", `/bespoke/${id}`, { auth, body: r.body });
  });
}

/** Remove a recipe from their book (any recipe in it, including one the bar added). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return memberRequest(req, "passport-personal", async (auth) => {
    const id = posInt(params.id);
    if (!id) return bad("Not found", 404);
    return passport("DELETE", `/bespoke/${id}`, { auth });
  });
}
