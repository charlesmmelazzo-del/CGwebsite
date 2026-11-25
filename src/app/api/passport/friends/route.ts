import type { NextRequest } from "next/server";
import { getFriends, passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { NAME_MAX, isTarget, lookupBody } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/**
 * File 09: the signed-in member's friends (Account and the Friends page). Only display names of other members ever come
 * back; there is no member directory and no name search. A lookup always answers the same "Request sent" words, found
 * or not (the Bible also answers after the same minimum time, and caps lookups at ten an hour).
 */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-member", (auth) => getFriends(auth));
}

/**
 * { action: "find", email | phone | code } · { action: "suggested", id } · { action: "accept" | "decline", id } ·
 * { action: "withdraw", id } · { action: "remove" | "block", target } · { action: "unblock", id } ·
 * { action: "settings", display_name?, share_presence? } · { action: "code_reset" } · { action: "notice_read", id } ·
 * { action: "report", target, reason? } (a person: a friend or someone who sent a request).
 */
export async function POST(req: NextRequest) {
  const peek = await req.clone().json().catch(() => ({}));
  const bucket = peek && (peek.action === "find" || peek.action === "suggested") ? "passport-friends" : "passport-social";
  return memberRequest(req, bucket, async (auth, b) => {
    const action = typeof b.action === "string" ? b.action : "";
    const id = posInt(b.id);
    switch (action) {
      case "find": {
        const x = lookupBody(b);
        if ("error" in x) return bad(x.error);
        return passport("POST", "/friends/find", { auth, body: x.body });
      }
      case "suggested":
        if (typeof b.id !== "string" || !/^[a-f0-9]{8,40}$/.test(b.id)) return bad("Not found", 404);
        return passport("POST", "/friends/suggested", { auth, body: { id: b.id } });
      case "accept": case "decline":
        if (!id) return bad("Not found", 404);
        return passport("POST", `/friends/requests/${id}/${action}`, { auth });
      case "withdraw":
        if (!id) return bad("Not found", 404);
        return passport("POST", `/friends/sent/${id}/withdraw`, { auth });
      case "remove": case "block":
        if (!isTarget(b.target)) return bad("Not found", 404);
        return passport("POST", `/friends/${action}`, { auth, body: { target: b.target } });
      case "unblock":
        if (!id) return bad("Not found", 404);
        return passport("POST", `/friends/blocked/${id}/unblock`, { auth });
      case "settings": {
        const body: Record<string, unknown> = {};
        if (typeof b.display_name === "string") {
          if (b.display_name.trim().length > NAME_MAX) return bad(`Keep your display name to ${NAME_MAX} characters`);
          body.display_name = b.display_name.trim();
        }
        if (typeof b.share_presence === "boolean") body.share_presence = b.share_presence;
        if (!Object.keys(body).length) return bad("Nothing to change");
        return passport("PUT", "/friends/settings", { auth, body });
      }
      case "code_reset":
        return passport("POST", "/friends/code/reset", { auth });
      case "report": {
        if (!isTarget(b.target)) return bad("Not found", 404);
        const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
        return passport("POST", "/report", { auth, body: { target: b.target, reason } });
      }
      case "notice_read":
        if (!id) return bad("Not found", 404);
        return passport("POST", `/notices/${id}/read`, { auth });
      default:
        return bad("That can't be done here");
    }
  });
}
