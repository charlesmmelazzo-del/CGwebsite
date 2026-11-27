import SignIn from "@/components/passport/SignIn";
import { loadConfig } from "@/lib/passport/page";
import { currentAuth } from "@/lib/passport/session";
import { signUpButtonHref } from "@/lib/passport/passcode";

export const dynamic = "force-dynamic";

/**
 * /passport: Home (the CG button) when signed in, drawn by the app frame so it opens instantly; otherwise sign-in.
 * A sign-in that has ended (signed out elsewhere, reset, deactivated) comes back here with ?signed_out=1.
 */
export default async function PassportPage({ searchParams }: { searchParams: { signed_out?: string } }) {
  if (currentAuth()) return null;
  const config = await loadConfig();
  return <SignIn signupOpen={config.signup_mode === "open"} signUpHref={signUpButtonHref(config)} notice={searchParams.signed_out ? "You've been signed out. Please sign in again." : undefined} />;
}
