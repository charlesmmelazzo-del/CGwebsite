import AppShell from "@/components/passport/AppShell";
import { currentAuth } from "@/lib/passport/session";

export const dynamic = "force-dynamic";

/**
 * File 06: one app frame for every signed-in Passport screen. It stays put while the member moves around, so the tabs
 * never reload. Signed out (no Passport cookie), the screens draw on their own (sign-in). The frame starts afresh for
 * each member who signs in on this device (key), so nothing of one member's carries over to the next.
 */
export default function PassportAppLayout({ children }: { children: React.ReactNode }) {
  const auth = currentAuth();
  return <AppShell key={auth ? `m${auth.memberId}` : "out"} signedIn={!!auth}>{children}</AppShell>;
}
