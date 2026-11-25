import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import { EventPage } from "@/components/passport/Events";
import Comments from "@/components/passport/Comments";
import { getPassportEvent } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 09: one Passport event (a draft, or a test-only event for a real member, is simply not found). */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getPassportEvent(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  return (
    <>
      <EventPage key={r.data.id} initial={r.data} />
      {/* File 10: comments, only when the bar switched them on for this event. */}
      <Comments type="event" id={r.data.id} />
    </>
  );
}
