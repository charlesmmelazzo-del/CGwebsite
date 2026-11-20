import type { Metadata } from "next";
import ManagePanel from "@/components/popup/givingTree/ManagePanel";
import { GivingTreeStyles } from "@/components/popup/givingTree/theme";
import { COPY } from "@/lib/givingTree/copy";
import { findByToken, sweepQuietly } from "@/lib/givingTree/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: COPY.manageTitle, robots: { index: false, follow: false } };

/**
 * A guest's private page for one pledge (6), reached from the link in every
 * email. The long random token is the only key; no account or login.
 * `?do=still|more|release` (the reminder's buttons) opens with that choice
 * ready to confirm — never applied on page load, so a mail scanner opening
 * the link changes nothing.
 */
export default async function ManagePage({ params, searchParams }: { params: { token: string }; searchParams: { do?: string } }) {
  await sweepQuietly();
  let found: Awaited<ReturnType<typeof findByToken>> = null;
  try {
    found = await findByToken(params.token);
  } catch {
    found = null;
  }
  const initial = searchParams.do === "still" || searchParams.do === "more" || searchParams.do === "release" ? searchParams.do : null;

  return (
    <div className="gt-root min-h-[calc(100dvh-49px)] px-3 py-6">
      <GivingTreeStyles />
      {!found ? (
        <p className="max-w-md mx-auto text-center">{COPY.manageNotFound}</p>
      ) : (
        <ManagePanel
          token={params.token}
          initial={initial}
          pledge={{
            code: found.pledge.code,
            name: found.pledge.name,
            status: found.pledge.status,
            dueDate: found.pledge.dueDate,
            extendedOnce: found.pledge.extendedOnce,
            guestResponse: found.pledge.guestResponse,
            amount: found.pledge.amount,
            hours: found.pledge.hours ?? found.opp.hoursFixed,
          }}
          opp={{ type: found.opp.type, title: found.opp.title, giveUrl: found.opp.giveUrl, dropoff: found.opp.dropoffInstructions || found.data.settings.defaultDropoff }}
          orgName={found.org.name}
          contactEmail={found.data.settings.contactEmail}
        />
      )}
    </div>
  );
}
