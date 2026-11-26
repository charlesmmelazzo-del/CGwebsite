import { notFound, redirect } from "next/navigation";
import { PublicEventPage } from "@/components/passport/PublicEvents";
import { currentAuth } from "@/lib/passport/session";
import { isPublicEventId } from "@/lib/passport/publicEvents";
import { findPublicEvent } from "@/lib/passport/publicEventsServer";

export const dynamic = "force-dynamic";

/** File 15, Part G: one event from the public website, inside Passport (only while the public page shows it). */
export default async function Page({ params }: { params: { id: string } }) {
  if (!currentAuth()) redirect("/passport");
  let id = "";
  try { id = decodeURIComponent(params.id); } catch { notFound(); }
  if (!isPublicEventId(id)) notFound();
  const e = await findPublicEvent(id);
  if (!e) notFound();
  return <PublicEventPage e={e} />;
}
