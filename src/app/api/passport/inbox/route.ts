import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";
import { eventBody, requestBody, threadBody } from "@/lib/passport/inbox";

export const dynamic = "force-dynamic";

/**
 * File 08: start something new from the Inbox, for the signed-in member only:
 *   { what: "message", subject?, body, ref_kind?, ref_id? }   Message the bar (from "Ask about this", with the item)
 *   { what: "request", kind, date?, details }                Make a request
 *   { what: "event", kind, preferred_date, backup_date?, time_of_day, guests, budget?, details? }   Plan an event
 * Only those fields reach the Bible; it checks every one again (and the caps, the language check and the item).
 */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-inbox", async (auth, b) => {
    if (b.what === "message") {
      const x = threadBody(b);
      if ("error" in x) return bad(x.error, x.error === "Not found" ? 404 : 400);
      return passport("POST", "/inbox/threads", { auth, body: x.body });
    }
    if (b.what === "request") {
      const x = requestBody(b);
      if ("error" in x) return bad(x.error);
      return passport("POST", "/inbox/requests", { auth, body: x.body });
    }
    if (b.what === "event") {
      const x = eventBody(b);
      if ("error" in x) return bad(x.error);
      return passport("POST", "/inbox/events", { auth, body: x.body });
    }
    return bad("Choose a message, a request or an event");
  });
}
