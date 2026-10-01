import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getEventBySlug } from "@/lib/compete/data";
import { getHostData } from "@/lib/compete/host";
import { isHost } from "@/lib/compete/session";
import HostApp from "@/components/compete/HostApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host Controls" };

/** The host link: /compete/<slug>/host?key=<host token>. Admins get in without the key. */
export default async function HostPage({ params, searchParams }: { params: { slug: string }; searchParams: { key?: string } }) {
  noStore();
  const ev = await getEventBySlug(params.slug);
  if (!ev) notFound();
  const key = searchParams.key ?? "";
  if (!(await isHost(ev, key))) {
    return (
      <div className="cmp flex items-center justify-center p-8 text-center">
        <p className="cmp-muted">This host link isn’t valid. Ask the event admin for the current link.</p>
      </div>
    );
  }
  return <HostApp slug={ev.slug} hostKey={key} initial={await getHostData(ev)} />;
}
