import { NextRequest, NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/compete/data";
import { getHostData } from "@/lib/compete/host";
import { applyHostAction, HostError, type HostAction } from "@/lib/compete/live";
import { isHost } from "@/lib/compete/session";

export const dynamic = "force-dynamic";

/** GET ?key= — everything the host's control screen needs (see getHostData). */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isHost(ev, req.nextUrl.searchParams.get("key")))) {
    return NextResponse.json({ error: "This host link isn’t valid." }, { status: 403 });
  }
  return NextResponse.json(await getHostData(ev), { headers: { "Cache-Control": "no-store" } });
}

/** POST { key, action } — drive the night. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { key?: string; action?: HostAction };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!(await isHost(ev, body.key))) {
    return NextResponse.json({ error: "This host link isn’t valid." }, { status: 403 });
  }
  if (!body.action?.type) return NextResponse.json({ error: "No action." }, { status: 400 });

  try {
    const saved = await applyHostAction(ev, body.action);
    return NextResponse.json({ ok: true, version: saved.liveVersion, state: saved.liveState });
  } catch (e) {
    if (e instanceof HostError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[compete/host]", e);
    return NextResponse.json({ error: "That didn’t work. Please try again." }, { status: 500 });
  }
}
