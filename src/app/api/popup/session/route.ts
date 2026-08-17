import { NextRequest, NextResponse } from "next/server";
import { createPopupServerClient, isPopupAuthConfigured } from "@/lib/popup/auth";
import { checkRateLimit, getIp } from "@/lib/popup/access";
import { SITE_URL } from "@/lib/constants";

/** POST — sign a guest in. Supabase sets the session cookies on the response. */
export async function POST(req: NextRequest) {
  if (!isPopupAuthConfigured()) {
    return NextResponse.json({ error: "Guest accounts aren't set up yet." }, { status: 503 });
  }

  const rl = checkRateLimit(`login:${getIp(req)}`, 10, 15 * 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const sb = createPopupServerClient();
  if (!sb) {
    return NextResponse.json({ error: "Guest accounts aren't set up yet." }, { status: 503 });
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}

/** DELETE — sign out. */
export async function DELETE() {
  const sb = createPopupServerClient();
  if (sb) await sb.auth.signOut();
  return NextResponse.json({ success: true });
}

/** PUT — resend the confirmation email. */
export async function PUT(req: NextRequest) {
  const rl = checkRateLimit(`resend:${getIp(req)}`, 3, 15 * 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "Please wait a few minutes before requesting another email." },
      { status: 429 }
    );
  }

  const sb = createPopupServerClient();
  if (!sb) {
    return NextResponse.json({ error: "Guest accounts aren't set up yet." }, { status: 503 });
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    /* fall through to the session's own email */
  }

  if (!email) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    email = user?.email ?? "";
  }
  if (!email) {
    return NextResponse.json({ error: "No email address to send to." }, { status: 400 });
  }

  const { error } = await sb.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || SITE_URL}/api/popup/confirm?next=/popup`,
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
