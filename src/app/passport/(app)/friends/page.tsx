import Unavailable from "@/components/passport/Unavailable";
import { FriendsPage } from "@/components/passport/Social";
import { getFriends } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";
import { cleanCode } from "@/lib/passport/social";

export const dynamic = "force-dynamic";

/**
 * File 09: Friends. Requests waiting, add a friend (exact email, phone or friend code; never a name), people in the
 * household, friends, requests sent and blocked. A friend's "add me" link (?code=…) fills in their code.
 */
export default async function Page({ searchParams }: { searchParams: { code?: string } }) {
  const r = await memberData((auth) => getFriends(auth));
  if (!r.data) return <Unavailable />;
  const code = cleanCode(searchParams.code);
  return <FriendsPage initial={r.data} code={code ? `${code.slice(0, 4)}-${code.slice(4)}` : ""} />;
}
