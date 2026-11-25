import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { ANSWERS, letsgoBody } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/**
 * File 09: Let's go and I'm here, for the signed-in member:
 *   { what: "letsgo", day, time, note?, to: [friendship numbers] | "all" }   plan a visit with friends
 *   { what: "answer", id, answer: "in" | "maybe" | "cant" }                   answer a friend's plan
 *   { what: "cancel", id }                                                     cancel one's own plan
 *   { what: "here" } / { what: "left" }                                       I'm at Common Good / I've left
 */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const id = posInt(b.id);
    switch (b.what) {
      case "letsgo": {
        const x = letsgoBody(b);
        if ("error" in x) return bad(x.error);
        return passport("POST", "/letsgo", { auth, body: x.body });
      }
      case "answer":
        if (!id) return bad("Not found", 404);
        if (!ANSWERS.some((a) => a.id === b.answer)) return bad("Answer In, Maybe or Can't");
        return passport("POST", `/letsgo/${id}/answer`, { auth, body: { answer: b.answer } });
      case "cancel":
        if (!id) return bad("Not found", 404);
        return passport("POST", `/letsgo/${id}/cancel`, { auth });
      case "here":
        return passport("POST", "/here", { auth });
      case "left":
        return passport("DELETE", "/here", { auth });
      default:
        return bad("That can't be done here");
    }
  });
}
