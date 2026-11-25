import Link from "next/link";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { PageTitle } from "@/components/passport/Library";
import { BespokeBook } from "@/components/passport/Personal";
import { C } from "@/components/passport/theme";
import { getRecipes } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 04: the member's private recipe book: drinks made for them at the bar, and their own from home. */
export default async function BespokePage() {
  const r = await memberData((auth) => getRecipes(auth));
  if (!r.data) return <Unavailable />;
  return (
    <Shell tab="lists">
      <Link href="/passport/lists" className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← Your Passport</Link>
      <div className="mt-5" />
      <PageTitle kicker="Your recipe book" title="Bespoke recipes" />
      <BespokeBook initial={r.data.recipes} units={r.data.units} />
    </Shell>
  );
}
