import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventBySlug, normalizeCode } from "@/lib/compete/data";
import { guestCookieName, newDeviceSecret, recordMiss, tooManyMisses } from "@/lib/compete/session";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function ipOf(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/**
 * POST { code } — sign in with a ticket code.
 *
 * One code per person: the first device claims it. The same device can sign
 * back in any time (its cookie holds the claim); any other device is refused
 * until the admin resets the code.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  if (!ev || ev.status === "finished") {
    return NextResponse.json({ error: "This event isn’t open for sign-in." }, { status: 404 });
  }
  const ip = ipOf(req);
  if (tooManyMisses(ip)) {
    return NextResponse.json({ error: "Too many tries. Please ask a staff member for help." }, { status: 429 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const code = normalizeCode(String(body.code ?? ""));
  if (code.length < 4) return NextResponse.json({ error: "Enter the code printed on your ticket." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from("comp_codes")
    .select("id, device_secret")
    .eq("event_id", ev.id)
    .eq("code", code)
    .maybeSingle();
  if (!row) {
    recordMiss(ip);
    return NextResponse.json({ error: "We couldn’t find that code. Check your ticket and try again." }, { status: 404 });
  }

  const cookieName = guestCookieName(ev.id);
  const existing = req.cookies.get(cookieName)?.value;
  let secret: string | null = null;

  if (row.device_secret) {
    // Already claimed — only the same phone gets back in.
    if (existing === `${row.id}.${row.device_secret}`) secret = row.device_secret;
    else
      return NextResponse.json(
        { error: "That code is already in use on another phone. Please ask a staff member for help." },
        { status: 409 }
      );
  } else {
    secret = newDeviceSecret();
    // Claim only if still unclaimed — two phones racing for one code can't both win.
    const { data: claimed } = await sb
      .from("comp_codes")
      .update({ device_secret: secret, claimed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("device_secret", null)
      .select("id")
      .maybeSingle();
    if (!claimed) {
      return NextResponse.json(
        { error: "That code is already in use on another phone. Please ask a staff member for help." },
        { status: 409 }
      );
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, `${row.id}.${secret}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
