import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/lib/popup/access";
import { failure } from "@/lib/holidays/http";
import { actPublic, joinPublic, pollPublic } from "@/lib/holidays/public/store";

export const dynamic = "force-dynamic";

const token = (req: NextRequest) => req.headers.get("x-player-token");

/** GET — every phone in the bar-wide game polls this about once a second. */
export async function GET(req: NextRequest, { params }: { params: { game: string } }) {
  try {
    const v = req.nextUrl.searchParams.get("v");
    return NextResponse.json(await pollPublic(params.game, token(req), v === null ? null : Number(v)));
  } catch (e) {
    return failure(e);
  }
}

/** POST — `{ op: "join", name }`, `{ op: "act", action }` or `{ op: "leave" }`. */
export async function POST(req: NextRequest, { params }: { params: { game: string } }) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    if (body.op === "join") {
      const limit = checkRateLimit(`holiday-public-join:${getIp(req)}`, 30, 10 * 60 * 1000);
      if (limit.blocked) return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
      return NextResponse.json(await joinPublic(params.game, token(req), String(body.name ?? "")));
    }
    const t = token(req);
    if (!t) return NextResponse.json({ error: "Join the game first." }, { status: 401 });
    if (body.op !== "act" && body.op !== "leave") return NextResponse.json({ error: "Unknown move." }, { status: 400 });
    return NextResponse.json(await actPublic(params.game, t, body.op, body.action));
  } catch (e) {
    return failure(e);
  }
}
