import Home from "@/components/passport/Home";
import Shell from "@/components/passport/Shell";
import SignIn from "@/components/passport/SignIn";
import Unavailable from "@/components/passport/Unavailable";
import { loadConfig, loadMe } from "@/lib/passport/page";

export const dynamic = "force-dynamic";

/** /passport: the welcome screen when signed in, otherwise the sign-in screen. */
export default async function PassportPage() {
  const s = await loadMe();
  if (s.me) return <Shell tab="home"><Home me={s.me} /></Shell>;
  if (s.unavailable) return <Unavailable />;
  const config = await loadConfig();
  return <SignIn signupOpen={config.signup_mode === "open"} notice={s.ended ? "You've been signed out. Please sign in again." : undefined} />;
}
