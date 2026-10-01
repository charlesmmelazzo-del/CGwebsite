import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getEventBySlug, getPublicEvent } from "@/lib/compete/data";
import { getViewer, isAdminRequest } from "@/lib/compete/session";
import { publicLiveState } from "@/lib/compete/types";
import GuestApp from "@/components/compete/GuestApp";
import JoinScreen from "@/components/compete/JoinScreen";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  return { title: ev ? ev.name : "Cocktail Competition" };
}

/**
 * The guest app. Ticket-holders sign in with their code; once the event is
 * finished it becomes a public recap (winners, brand, recipes) that stays up
 * under Past Competitions.
 */
export default async function CompetitionPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { code?: string };
}) {
  noStore();
  const ev = await getEventBySlug(params.slug);
  if (!ev) notFound();
  // Drafts are only visible to a signed-in admin, for previewing.
  if (ev.status === "draft" && !(await isAdminRequest())) notFound();

  const pub = await getPublicEvent(ev);
  const initialLive = { version: ev.liveVersion, state: publicLiveState(ev.liveState), status: ev.status };

  if (ev.status === "finished") return <GuestApp ev={pub} initialLive={initialLive} viewer={null} />;

  const viewer = await getViewer(ev);
  if (!viewer) return <JoinScreen ev={pub} initialCode={searchParams.code} />;
  return <GuestApp ev={pub} initialLive={initialLive} viewer={viewer} />;
}
