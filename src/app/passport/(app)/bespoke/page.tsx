import { BackLink } from "@/components/passport/bits";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle } from "@/components/passport/Library";
import { BespokeBook } from "@/components/passport/Personal";
import { getRecipes } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/**
 * File 04: the member's private recipe book, shown to members as "My Cocktails" (file 06): drinks made for them at the
 * bar (marked with the staff member's first name) and their own from home. ?new=1 (from the Index) opens "Add a cocktail".
 */
export default async function BespokePage({ searchParams }: { searchParams: { new?: string } }) {
  const r = await memberData((auth) => getRecipes(auth));
  if (!r.data) return <Unavailable />;
  return (
    <>
      <BackLink fallback="/passport/library?at=journal" label="Journal" />
      <div className="mt-3" />
      <PageTitle kicker="Your recipe book" title="My Cocktails" />
      <BespokeBook initial={r.data.recipes} units={r.data.units} startNew={searchParams.new === "1"} />
    </>
  );
}
