import Link from "next/link";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { MenuGroupBlock, PageTitle, Quiet } from "@/components/passport/Library";
import { C } from "@/components/passport/theme";
import { getMarksSafe, getSpirits } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** The spirits list: Toast's spirits list (when an admin ticked it), by category, with the pour prices Toast shows. */
export default async function SpiritsPage() {
  const r = await memberData(async (auth) => {
    const [sp, marks] = await Promise.all([getSpirits(auth), getMarksSafe(auth)]);
    return { ...sp, marks };
  });
  if (!r.data) return <Unavailable />;
  const marks = r.data.marks;
  const s = r.data.menu_info.available ? r.data.spirits : null;
  return (
    <Shell tab="library">
      <Link href="/passport/library" className="font-body text-xs tracking-[0.2em] uppercase" style={{ color: C.muted }}>← Library</Link>
      <div className="mt-5" />
      <PageTitle kicker="On the back bar" title="Spirits" />
      {s
        ? s.groups.map((g) => <MenuGroupBlock key={g.name} g={g} spirits marks={marks} />)
        : <Quiet>The spirits list arrives here soon. Until then, ask your bartender.</Quiet>}
      <p className="font-body text-xs mt-10" style={{ color: C.faint }}>
        Looking for something we used to pour? See the <Link href="/passport/library#archive" className="underline">spirits archive</Link>.
      </p>
    </Shell>
  );
}
