import Home from "@/components/passport/Home";
import Shell from "@/components/passport/Shell";
import SignIn from "@/components/passport/SignIn";
import Unavailable from "@/components/passport/Unavailable";
import { loadConfig, loadMe } from "@/lib/passport/page";
import { getPassportCocktails, type Cocktail } from "@/lib/passport/bible";
import { currentAuth } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

/** /passport: the welcome screen when signed in, otherwise the sign-in screen. */
export default async function PassportPage() {
  const s = await loadMe();
  if (s.me) {
    // The members-only Passport cocktails as a feature card (none is fine: the card just doesn't show).
    const auth = currentAuth();
    const featured: Cocktail[] = auth ? await getPassportCocktails(auth).catch(() => []) : [];
    return <Shell tab="home"><Home me={s.me} featured={featured} /></Shell>;
  }
  if (s.unavailable) return <Unavailable />;
  const config = await loadConfig();
  return <SignIn signupOpen={config.signup_mode === "open"} notice={s.ended ? "You've been signed out. Please sign in again." : undefined} />;
}
