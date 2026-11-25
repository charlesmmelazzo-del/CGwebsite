import Unavailable from "@/components/passport/Unavailable";
import { LetsGoForm } from "@/components/passport/Social";
import { getFriends } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 09: "Let's go": a day, a rough time, a note, and which friends. Not a reservation; it ends the next morning. */
export default async function Page() {
  const r = await memberData((auth) => getFriends(auth));
  if (!r.data) return <Unavailable />;
  return <LetsGoForm friends={r.data.friends} />;
}
