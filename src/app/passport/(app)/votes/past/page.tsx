import Unavailable from "@/components/passport/Unavailable";
import { PastVotes } from "@/components/passport/Votes";
import { getPastVotes } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 10: "Past votes", from the Index: finished flights and brackets with their results. */
export default async function PastVotesRoute() {
  const r = await memberData((auth) => getPastVotes(auth));
  if (!r.data) return <Unavailable />;
  return <PastVotes votes={r.data} />;
}
