import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";

export const dynamic = "force-dynamic";

/** File 08: Account → Notifications, the signed-in member's own switches. */
export async function GET(req: NextRequest) {
  return memberRequest(req, "passport-member", (auth) => passport("GET", "/notifications", { auth }));
}

const SWITCHES = ["messages", "requests", "bottles", "friends", "news", "digest"] as const;
export async function PUT(req: NextRequest) {
  return memberRequest(req, "passport-personal", async (auth, b) => {
    const body: Record<string, boolean | number> = {};
    for (const k of SWITCHES) if (typeof b[k] === "boolean") body[k] = b[k] as boolean;
    if (b.digest_hour !== undefined) {
      const h = Number(b.digest_hour);
      if (!Number.isInteger(h) || h < 6 || h > 22) return bad("Choose an hour from 6 AM to 10 PM");
      body.digest_hour = h;
    }
    if (!Object.keys(body).length) return bad("Nothing to change");
    return passport("PUT", "/notifications", { auth, body });
  });
}
