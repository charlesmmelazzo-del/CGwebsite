import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createPopupServerClient } from "@/lib/popup/auth";

/**
 * Landing point for the link in a confirmation email.
 *
 * Supabase can send either shape depending on the project's email template:
 *   ?code=…                    (PKCE — the default for @supabase/ssr)
 *   ?token_hash=…&type=signup  (the newer server-side template)
 * Both are handled so the flow works whichever template the project is on.
 *
 * On success the guest lands signed in and confirmed; on failure they get a
 * plain message rather than a silent redirect that looks like it worked.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // Only ever redirect to a path on this site — never to an attacker-supplied
  // absolute URL smuggled in through `next`.
  const rawNext = url.searchParams.get("next") ?? "/popup/account";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/popup/account";

  const sb = createPopupServerClient();
  if (!sb) {
    return NextResponse.redirect(new URL("/popup/login?error=unavailable", url.origin));
  }

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(`${next}?confirmed=1`, url.origin));
    }
  } else if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(`${next}?confirmed=1`, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/popup/login?error=confirm_failed", url.origin));
}
