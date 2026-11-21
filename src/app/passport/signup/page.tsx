import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ByInvitation from "@/components/passport/ByInvitation";
import SignUp from "@/components/passport/SignUp";
import Unavailable from "@/components/passport/Unavailable";
import { isRateLimited } from "@/lib/rateLimit";
import { BAD_CODE, checkCode, cleanCode } from "@/lib/passport/invitation";
import { loadConfig } from "@/lib/passport/page";

export const dynamic = "force-dynamic";

/**
 * Sign-up. Linked from the sign-in screen only when sign-up is Open.
 *   Off:          not found, whatever the link says.
 *   Invite only:  opens only with a valid invitation (?code= from a link or QR,
 *                 or typed in); otherwise the "by invitation" screen.
 *   Open:         the form, with or without a code.
 * The Bible checks again, and uses the invitation up, when the member finishes.
 */
export default async function SignUpPage({ searchParams }: { searchParams: { code?: string } }) {
  const config = await loadConfig();
  if (config.unavailable) return <Unavailable />;
  if (config.signup_mode === "off") notFound();

  const raw = typeof searchParams.code === "string" ? searchParams.code : "";
  if (!raw) {
    if (config.signup_mode === "open") return <SignUp termsText={config.terms_text} termsVersion={config.terms_version} />;
    return <ByInvitation />;
  }

  // A code from a link: the same per-person limit as typing one in.
  const h = headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  if (isRateLimited("passport-code", ip)) return <ByInvitation error="Too many tries in a short time. Please wait a little and try again." />;
  const code = cleanCode(raw);
  const r = await checkCode(code);
  if (r === "unavailable") return <Unavailable />;
  if (r === "paused") return <ByInvitation error="Too many tries right now. Please try again in a little while." />;
  if (r === "bad") return <ByInvitation error={BAD_CODE} />;
  return <SignUp termsText={config.terms_text} termsVersion={config.terms_version} invitationCode={code} />;
}
