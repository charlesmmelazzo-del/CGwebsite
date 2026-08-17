import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  calculateAge,
  createPopupServerClient,
  isPopupAuthConfigured,
  MINIMUM_AGE,
} from "@/lib/popup/auth";
import { checkRateLimit, getIp } from "@/lib/popup/access";
import { SITE_URL } from "@/lib/constants";

/**
 * Create a Pop Up Zone guest account.
 *
 * The 21+ check happens HERE, on the server, from the submitted date of birth.
 * An under-age submission is rejected before any account exists — we don't
 * create-then-flag. The client never gets to assert "I'm old enough".
 */
export async function POST(req: NextRequest) {
  if (!isPopupAuthConfigured()) {
    return NextResponse.json(
      { error: "Guest accounts aren't set up yet. Please check back soon." },
      { status: 503 }
    );
  }

  // 5 signups per IP per hour — enough for a couple at the same table,
  // not enough to farm ballot-stuffing accounts.
  const rl = checkRateLimit(`signup:${getIp(req)}`, 5, 60 * 60 * 1000);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please try again later." },
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
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const dateOfBirth = String(body.dateOfBirth ?? "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Enter your first and last name." }, { status: 400 });
  }

  // ── 21+ gate ──────────────────────────────────────────────────────────────
  const age = calculateAge(dateOfBirth);
  if (age === null) {
    return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
  }
  if (age < MINIMUM_AGE) {
    return NextResponse.json(
      { error: `You must be ${MINIMUM_AGE} or older to join the Pop Up Zone.` },
      { status: 403 }
    );
  }

  const sb = createPopupServerClient();
  if (!sb) {
    return NextResponse.json({ error: "Guest accounts aren't set up yet." }, { status: 503 });
  }

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || SITE_URL}/api/popup/confirm?next=/popup`,
    },
  });

  if (error) {
    // Supabase already distinguishes "already registered" etc. Surface its
    // message rather than a generic one — the existing forms in this project
    // deliberately show honest errors.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }

  // Store the profile with the service-role client. age_verified is set from
  // the age WE computed above, never from anything the client sent.
  try {
    const admin = getSupabaseAdmin();
    await admin.from("popup_profiles").upsert(
      {
        id: data.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        age_verified: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch (e) {
    console.error("[popup] profile insert failed", e);
    return NextResponse.json(
      { error: "Account created, but we couldn't save your profile. Please contact us." },
      { status: 500 }
    );
  }

  // When email confirmation is on, signUp returns no session — the guest is
  // signed in only after clicking the link. Tell the client which case it is.
  const needsConfirmation = !data.session;
  return NextResponse.json({ success: true, needsConfirmation, email });
}
