import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import Comments from "@/components/passport/Comments";
import { FlightVotePage } from "@/components/passport/Votes";
import { getFlightVote } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 10: "Choose your perfect flight". A draft, a scheduled or a test-only vote (for a real member) is simply not found. */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getFlightVote(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return (
    <>
      <FlightVotePage key={r.data.id} initial={r.data} />
      <Comments type="flight" id={r.data.id} />
    </>
  );
}
