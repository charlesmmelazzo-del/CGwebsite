import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest, posInt } from "@/lib/passport/route";
import { chatPostBody, isRoom, isSeat } from "@/lib/passport/chat";

export const dynamic = "force-dynamic";

/**
 * File 16: one group or channel the member is in (anyone else's is "Not found"). ?before= loads older messages;
 * ?thread= opens a channel thread; ?mention= asks who in this room the "@" box may offer. Asked every 5 seconds while open.
 */
export async function GET(req: NextRequest, { params }: { params: { room: string; id: string } }) {
  return memberRequest(req, "passport-chat-read", async (auth) => {
    const id = posInt(params.id);
    if (!isRoom(params.room) || !id) return bad("Not found", 404);
    const q = req.nextUrl.searchParams;
    if (q.has("mention")) return passport("GET", `/chat/${params.room}/${id}/mention?q=${encodeURIComponent((q.get("mention") || "").slice(0, 30))}`, { auth });
    const thread = posInt(q.get("thread"));
    if (thread) return params.room === "channel" ? passport("GET", `/chat/channel/${id}/threads/${thread}`, { auth }) : bad("Not found", 404);
    const before = posInt(q.get("before"));
    return passport("GET", `/chat/${params.room}/${id}${before ? `?before=${before}` : ""}`, { auth });
  });
}

/**
 * { action: "send", body, reply_to?, parent_id?, mentions?, share? } · groups: { action: "accept" | "decline" | "leave" },
 * { action: "rename", name }, { action: "remove", seat }, { action: "add", friends } · channels: { action: "join" | "leave" },
 * { action: "notify", notify?, muted? }.
 */
export async function POST(req: NextRequest, { params }: { params: { room: string; id: string } }) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    const id = posInt(params.id);
    if (!isRoom(params.room) || !id) return bad("Not found", 404);
    const room = params.room;
    const action = typeof b.action === "string" ? b.action : "";
    if (action === "send") {
      const x = chatPostBody(b);
      if ("error" in x) return bad(x.error);
      return passport("POST", `/chat/${room}/${id}/posts`, { auth, body: x.body });
    }
    if (room === "group") {
      if (["accept", "decline", "leave"].includes(action)) return passport("POST", `/chat/group/${id}/${action}`, { auth });
      if (action === "rename") return typeof b.name === "string" && b.name.trim() ? passport("POST", `/chat/group/${id}/rename`, { auth, body: { name: b.name.trim().slice(0, 40) } }) : bad("Give the group a name");
      if (action === "remove") return isSeat(b.seat) ? passport("POST", `/chat/group/${id}/remove`, { auth, body: { seat: b.seat } }) : bad("Not found", 404);
      if (action === "add") return passport("POST", `/chat/group/${id}/add`, { auth, body: { friends: (Array.isArray(b.friends) ? b.friends : []).map(posInt).filter(Boolean).slice(0, 20) } });
    } else {
      if (action === "join" || action === "leave") return passport("POST", `/chat/channel/${id}/${action}`, { auth });
      if (action === "notify") {
        const body: Record<string, unknown> = {};
        if (typeof b.notify === "string" && ["all", "mentions", "nothing"].includes(b.notify)) body.notify = b.notify;
        if (typeof b.muted === "boolean") body.muted = b.muted;
        return passport("PUT", `/chat/channel/${id}/notify`, { auth, body });
      }
    }
    return bad("That can't be done here");
  });
}
