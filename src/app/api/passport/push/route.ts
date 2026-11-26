import type { NextRequest } from "next/server";
import { passport, type PushStatus } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/**
 * File 13: "Notify me on this device". The signed-in member's own devices only: the Bible takes the member from the
 * sign-in, never from what the browser sends. The answer carries the Bible's PUBLIC push key (not a secret).
 */
const LABELS = ["iPhone", "iPad", "Android", "Mac", "Windows", "This browser"];
const endpointOf = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s"'<>]{8,990}$/.test(v) ? v : "");

export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-member", (auth) => {
    const ep = endpointOf(req.nextUrl.searchParams.get("endpoint"));
    return passport<{ push: PushStatus }>("GET", `/push${ep ? `?endpoint=${encodeURIComponent(ep)}` : ""}`, { auth });
  });
}

export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const s = (b.subscription && typeof b.subscription === "object" ? b.subscription : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    const endpoint = endpointOf(s.endpoint);
    const p256dh = typeof s.keys?.p256dh === "string" ? s.keys.p256dh.slice(0, 200) : "";
    const key = typeof s.keys?.auth === "string" ? s.keys.auth.slice(0, 100) : "";
    if (!endpoint || !p256dh || !key) return bad("This browser didn't give us a way to send notifications.");
    const label = typeof b.label === "string" && LABELS.includes(b.label) ? b.label : "This browser";
    return passport<{ push: PushStatus }>("POST", "/push/devices", { auth, body: { subscription: { endpoint, keys: { p256dh, auth: key } }, label } });
  });
}

export async function DELETE(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const endpoint = endpointOf(b.endpoint);
    if (!endpoint) return bad("Which device?");
    return passport<{ push: PushStatus }>("POST", "/push/devices/remove", { auth, body: { endpoint } });
  });
}
