import type { NextRequest } from "next/server";
import { passport } from "@/lib/passport/bible";
import { bad, memberRequest } from "@/lib/passport/route";
import { publicShareBody, shareBody } from "@/lib/passport/social";
import { findPublicEvent } from "@/lib/passport/publicEventsServer";

export const dynamic = "force-dynamic";

/**
 * File 09: "Share with a friend": { kind, id, to: [friendship numbers], note? }. The Bible checks the member may share
 * it (and owns it, for a list or recipe), that each one is a friend, and that it opens for them only if they may open it.
 */
export async function POST(req: NextRequest) {
  return memberRequest(req, "passport-social", async (auth, b) => {
    // File 15, Part G: an event from the public website: only one the public page shows now; the Bible gets its id,
    // title and date (what anyone sees on /events), never anything else.
    if (b.kind === "public_event") {
      const p = publicShareBody(b);
      if ("error" in p) return bad(p.error, p.error === "Not found" ? 404 : 400);
      const e = await findPublicEvent(p.body.public_id);
      if (!e) return bad("Not found", 404);
      return passport("POST", "/share", { auth, body: { kind: "public_event", public: { id: e.id, title: e.title, date: e.date }, to: p.body.to, note: p.body.note } });
    }
    const x = shareBody(b);
    if ("error" in x) return bad(x.error, x.error === "Not found" ? 404 : 400);
    return passport("POST", "/share", { auth, body: x.body });
  });
}
