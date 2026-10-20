import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getEventBySlug, getPreviewEvent, getSponsorByToken, judgeNames } from "@/lib/compete/data";
import { isAdminRequest } from "@/lib/compete/session";
import EventPreview from "@/components/compete/EventPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * /compete/<slug>/preview — the guest experience in a phone, before publishing.
 *
 * Open to a signed-in admin (everything, approved or not), or to a brand
 * partner holding their private link token (?partner=…), who sees their own
 * profile however far along it is.
 */
export default async function PreviewPage({ params, searchParams }: { params: { slug: string }; searchParams: { partner?: string } }) {
  noStore();
  const ev = await getEventBySlug(params.slug);
  if (!ev) notFound();

  if (searchParams.partner) {
    const sponsor = await getSponsorByToken(searchParams.partner);
    if (!sponsor || sponsor.eventId !== ev.id) notFound();
    return (
      <EventPreview
        ev={await getPreviewEvent(ev, { kind: "partner", sponsorId: sponsor.id })}
        judges={await judgeNames(ev)}
        audience="partner"
        backHref={`/compete/partner/${sponsor.token}`}
        backLabel="Back to your submission"
      />
    );
  }

  if (!(await isAdminRequest())) notFound();
  return (
    <EventPreview
      ev={await getPreviewEvent(ev, { kind: "admin" })}
      judges={await judgeNames(ev)}
      audience="admin"
      backHref={`/admin/competitions/${ev.id}`}
      backLabel="Back to admin"
    />
  );
}
