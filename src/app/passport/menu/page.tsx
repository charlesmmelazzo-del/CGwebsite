import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { CocktailFeature, PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { getMenus, getPassportCocktails } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

const STALE_MS = 2 * 24 * 3600 * 1000;

/** The Menu tab: the members-only Passport cocktails first, then the bar's Toast menus (once they're turned on). */
export default async function MenuPage() {
  const r = await memberData(async (auth) => {
    const [pc, menus] = await Promise.all([getPassportCocktails(auth), getMenus(auth)]);
    return { pc, menus };
  });
  if (!r.data) return <Unavailable />;
  const { pc, menus } = r.data;
  const updated = menus.menu_info.updated_at ? new Date(menus.menu_info.updated_at) : null;
  return (
    <Shell tab="menu">
      <PageTitle kicker="What we're pouring" title="Menu" />
      <SectionTitle>Passport cocktails · members only</SectionTitle>
      {pc.length
        ? <div className="space-y-4">{pc.map((c) => <CocktailFeature key={c.id} c={c} />)}</div>
        : <Quiet>This month&rsquo;s Passport cocktails will appear here.</Quiet>}
      <SectionTitle>The menu</SectionTitle>
      {menus.menu_info.available && menus.menus.length
        ? null
        : <Quiet>The bar&rsquo;s full menu arrives here soon. Until then, ask your bartender, or browse every cocktail we&rsquo;ve poured in the Library.</Quiet>}
      {updated && Date.now() - updated.getTime() > STALE_MS && (
        <p className="font-body text-[11px] mt-10" style={{ color: "#6B7860" }}>Menu last updated {updated.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
      )}
    </Shell>
  );
}
