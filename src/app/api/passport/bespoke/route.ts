import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { memberRequest } from "@/lib/passport/route";
import { recipeBody } from "@/lib/passport/recipe";

export const dynamic = "force-dynamic";

/** File 04: add a recipe to the member's own bespoke recipe book. */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const r = recipeBody(b);
    if ("error" in r) return r.error;
    return passport("POST", "/bespoke", { auth, body: r.body });
  });
}
