import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, isKind, memberRequest, posInt } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 12: "Not for me" on one suggestion, for the signed-in member only (it stays away for 90 days). */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const id = posInt(b.id);
    if (!isKind(b.kind) || !id) return bad("Something is missing.");
    return passport("POST", "/recommendations/dismiss", { auth, body: { kind: b.kind, id } });
  });
}
