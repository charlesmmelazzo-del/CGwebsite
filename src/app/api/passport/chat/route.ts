import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { groupBody, isReaction, proposalBody } from "@/lib/passport/chat";

export const dynamic = "force-dynamic";

/**
 * File 16: Messages. Everything for the Chats and Channels tabs and the quick switcher: the member's conversations (with
 * the bar, friends and groups), group invitations, channels joined and to browse, and their own channel ideas. Only the
 * signed-in member's own; the Bible decides what each member may see. Asked every 30 seconds while the list is on screen.
 */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-chat-read", (auth) => passport("GET", "/chat", { auth }));
}

/**
 * { action: "create_group", name, friends: [friendship numbers] } · { action: "propose", name, description } ·
 * { action: "react", kind: "chat" | "dm", post_id, emoji } · { action: "report", post_id, reason? } · { action: "delete", post_id }
 */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const action = typeof b.action === "string" ? b.action : "";
    const post = posInt(b.post_id);
    switch (action) {
      case "create_group": {
        const x = groupBody(b);
        if ("error" in x) return bad(x.error);
        return passport("POST", "/chat/groups", { auth, body: x.body });
      }
      case "propose": {
        const x = proposalBody(b);
        if ("error" in x) return bad(x.error);
        return passport("POST", "/chat/channels/propose", { auth, body: x.body });
      }
      case "react":
        if (!post) return bad("Not found", 404);
        if (!isReaction(b.emoji)) return bad("Choose one of the five reactions");
        return passport("POST", "/chat/react", { auth, body: { kind: b.kind === "dm" ? "dm" : "chat", post_id: post, emoji: b.emoji } });
      case "report":
        if (!post) return bad("Not found", 404);
        return passport("POST", `/chat/posts/${post}/report`, { auth, body: { reason: typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "" } });
      case "delete":
        if (!post) return bad("Not found", 404);
        return passport("POST", `/chat/posts/${post}/delete`, { auth });
      default:
        return bad("That can't be done here");
    }
  });
}
