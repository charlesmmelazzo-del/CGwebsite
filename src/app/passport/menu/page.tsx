import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { CocktailFeature, MenuGroupBlock, PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { C } from "@/components/passport/theme";
import { getMarksSafe, getMenus, getPassportCocktails, markKey } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

const STALE_MS = 2 * 24 * 3600 * 1000;

/**
 * The Menu tab: the members-only Passport cocktails first, then the Toast menus an admin ticked, in their order.
 * Three calls to the Bible per page load; each menu item already carries its cocktail's card when it has one.
 */
export default async function MenuPage() {
  const r = await memberData(async (auth) => {
    const [pc, menus, marks] = await Promise.all([getPassportCocktails(auth), getMenus(auth), getMarksSafe(auth)]);
    return { pc, menus, marks };
  });
  if (!r.data) return <Unavailable />;
  const { pc, menus, marks } = r.data;
  const updated = menus.menu_info.updated_at ? new Date(menus.menu_info.updated_at) : null;
  // Toast's price for each Passport cocktail, from the group an admin marked as the Passport cocktails.
  const priceFor = new Map((menus.passport_group?.items || []).filter((i) => i.cocktail_id).map((i) => [i.cocktail_id as number, i.prices]));
  const shown = menus.menu_info.available ? menus.menus : [];
  return (
    <Shell tab="menu">
      <PageTitle kicker="What we're pouring" title="Menu" />
      <SectionTitle>Passport cocktails · members only</SectionTitle>
      {pc.length
        ? <div className="space-y-4">{pc.map((c) => <CocktailFeature key={c.id} c={c} prices={priceFor.get(c.id)} mark={marks[markKey("cocktail", c.id)]} />)}</div>
        : <Quiet>This month&rsquo;s Passport cocktails will appear here.</Quiet>}
      {shown.length ? shown.map((m) => (
        <section key={m.name}>
          <SectionTitle>{m.name}</SectionTitle>
          {m.groups.map((g) => <MenuGroupBlock key={g.name} g={g} marks={marks} />)}
        </section>
      )) : (
        <>
          <SectionTitle>The menu</SectionTitle>
          <Quiet>The bar&rsquo;s full menu arrives here soon. Until then, ask your bartender, or browse every cocktail we&rsquo;ve poured in the Library.</Quiet>
        </>
      )}
      {updated && Date.now() - updated.getTime() > STALE_MS && (
        <p className="font-body text-[11px] mt-10" style={{ color: C.faint }}>Menu last updated {updated.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
      )}
    </Shell>
  );
}
