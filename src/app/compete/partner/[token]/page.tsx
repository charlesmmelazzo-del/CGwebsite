import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getCommonGoodLogo, getEventById, getSponsorByToken, submissionLocked } from "@/lib/compete/data";
import { formatDeadline, formatEventDate } from "@/lib/compete/defaults";
import PartnerWizard from "@/components/compete/PartnerWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand Partner" };

/** A brand partner's private link — their brand profile and products. */
export default async function PartnerPage({ params }: { params: { token: string } }) {
  noStore();
  const s = await getSponsorByToken(params.token);
  const ev = s && (await getEventById(s.eventId));
  if (!s || !ev) notFound();

  return (
    <PartnerWizard
      token={s.token}
      partnerName={s.profile.brandName || s.label}
      event={{
        name: ev.name,
        dateText: formatEventDate(ev.eventDate),
        location: ev.location,
        spirit: ev.featuredSpirit || "your spirit",
        deadlineText: formatDeadline(ev.partnerDeadline),
        contactEmail: ev.contactEmail,
        cgLogo: await getCommonGoodLogo(),
        accent: ev.accentColor,
        slug: ev.slug,
        published: ev.status !== "draft",
      }}
      submission={{ status: s.status, adminNote: s.adminNote, contact: s.contact, profile: s.profile }}
      locked={submissionLocked(s, ev.partnerDeadline)}
    />
  );
}
