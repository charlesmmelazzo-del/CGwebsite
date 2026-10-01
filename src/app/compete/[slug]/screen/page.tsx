import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getEventBySlug, getPublicEvent } from "@/lib/compete/data";
import { isAdminRequest } from "@/lib/compete/session";
import { publicLiveState } from "@/lib/compete/types";
import { qrSvg, siteOrigin } from "@/lib/compete/urls";
import ScreenApp from "@/components/compete/ScreenApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Big Screen" };

/** The optional TV / projector view. Off unless the admin turns it on. */
export default async function ScreenPage({ params }: { params: { slug: string } }) {
  noStore();
  const ev = await getEventBySlug(params.slug);
  if (!ev) notFound();
  if ((!ev.bigScreen || ev.status === "draft") && !(await isAdminRequest())) notFound();
  const pub = await getPublicEvent(ev);
  const joinUrl = `${siteOrigin()}/compete/${ev.slug}`;
  return (
    <ScreenApp
      ev={pub}
      initialLive={{ version: ev.liveVersion, state: publicLiveState(ev.liveState), status: ev.status }}
      joinUrl={joinUrl}
      qrSvg={await qrSvg(joinUrl)}
    />
  );
}
