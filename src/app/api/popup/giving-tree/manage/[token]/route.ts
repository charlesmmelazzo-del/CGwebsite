import { NextResponse, type NextRequest } from "next/server";
import { getIp, isRateLimited } from "@/lib/rateLimit";
import { fail, readBody } from "@/lib/givingTree/http";
import { guestAction, TreeError } from "@/lib/givingTree/service";

export const dynamic = "force-dynamic";

/**
 * The self-service link (6): "I can't make it", "Need a few more days",
 * "Still on it". The long random token in the link is the only credential.
 * Always a POST from the page's own button, never a GET, so an email
 * scanner opening the link can't change anything.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    if (isRateLimited("guest-action", getIp(req))) throw new TreeError("Too many tries. Please wait a little.", 429);
    const body = await readBody(req);
    const action = body.action;
    if (action !== "release" && action !== "more" && action !== "still") throw new TreeError("Unknown action.");
    return NextResponse.json(await guestAction(params.token, action));
  } catch (e) {
    return fail(e);
  }
}
