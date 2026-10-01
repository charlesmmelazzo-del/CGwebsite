import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  getCommonGoodLogo,
  getContestantByToken,
  getEventById,
  getSponsors,
  submissionLocked,
} from "@/lib/compete/data";
import { fillTemplate, formatDeadline, formatEventDate } from "@/lib/compete/defaults";
import ContestantWizard from "@/components/compete/ContestantWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contestant Submission" };

/** A contestant's private link — rules, then their profile and cocktail. */
export default async function ContestantPage({ params }: { params: { token: string } }) {
  noStore();
  const c = await getContestantByToken(params.token);
  const ev = c && (await getEventById(c.eventId));
  if (!c || !ev) notFound();
  const [sponsors, cgLogo] = await Promise.all([getSponsors(ev.id), getCommonGoodLogo()]);
  const brand = sponsors.find((s) => s.isPrimary && s.profile.logoUrl) ?? sponsors.find((s) => s.profile.logoUrl);

  return (
    <ContestantWizard
      token={c.token}
      event={{
        name: ev.name,
        dateText: formatEventDate(ev.eventDate),
        location: ev.location,
        spirit: ev.featuredSpirit || "the featured spirit",
        deadlineText: formatDeadline(ev.contestantDeadline),
        contactEmail: ev.contactEmail,
        rulesText: fillTemplate(ev.rulesText, ev),
        bartenderFields: ev.bartenderFields,
        cocktailFields: ev.cocktailFields,
        cgLogo,
        brandLogo: brand?.profile.logoUrl,
        accent: ev.accentColor,
      }}
      submission={{
        status: c.status,
        adminNote: c.adminNote,
        contact: c.contact,
        bartender: c.bartender,
        cocktail: c.cocktail,
        agreed: Boolean(c.agreedAt),
      }}
      locked={submissionLocked(c, ev.contestantDeadline)}
    />
  );
}
