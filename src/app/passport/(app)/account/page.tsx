import { redirect } from "next/navigation";
import Account from "@/components/passport/Account";
import Unavailable from "@/components/passport/Unavailable";
import { loadMe } from "@/lib/passport/page";
import { getNotifyPrefs } from "@/lib/passport/bible";
import { currentAuth } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const s = await loadMe();
  if (s.unavailable) return <Unavailable />;
  if (!s.me) redirect("/passport");
  // File 08: Account → Notifications (left out quietly if it can't load; the rest of the account still shows).
  const auth = currentAuth();
  const prefs = auth ? await getNotifyPrefs(auth).catch(() => null) : null;
  return <Account me={s.me} prefs={prefs} />;
}
