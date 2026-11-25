import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { CocktailFeature, MenuGroupBlock, PageTitle, Quiet, SectionTitle } from "@/components/passport/Library";
import { C } from "@/components/passport/theme";
import { getCocktail, getMarksSafe, getMenus, getPassportCocktails, markKey, type Cocktail, type MemberAuth } from "@/lib/passport/bible";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

const STALE_MS = 2 * 24 * 3600 * 1000;

/**
 * The library cocktails the ticked menus link to, for their tagline, ingredients and flavor line (the same
 * approved cocktail fields as the cocktail page). Passport cocktails already arrived in full; the rest are read a
 * few at a time. One that cannot be read just shows its Toast description instead.
 */
async function linkedCocktails(auth: MemberAuth, ids: number[], have: Cocktail[]): Promise<Map<number, Cocktail>> {
  const out = new Map<number, Cocktail>(have.map((c) => [c.id, c]));
  const todo = Array.from(new Set(ids)).filter((id) => !out.has(id));
  for (let i = 0; i < todo.length; i += 6) {
    const got = await Promise.all(todo.slice(i, i + 6).map((id) => getCocktail(auth, id).catch(() => null)));
    for (const c of got) if (c) out.set(c.id, c);
  }
  return out;
}

/** The Menu tab: the members-only Passport cocktails first, then the Toast menus an admin ticked, in their order. */
export default async function MenuPage() {
  const r = await memberData(async (auth) => {
    const [pc, menus, marks] = await Promise.all([getPassportCocktails(auth), getMenus(auth), getMarksSafe(auth)]);
    const ids = menus.menu_info.available ? menus.menus.flatMap((m) => m.groups.flatMap((g) => g.items.map((i) => i.cocktail_id))).filter((id): id is number => !!id) : [];
    const cocktails = await linkedCocktails(auth, ids, pc);
    return { pc, menus, marks, cocktails };
  });
  if (!r.data) return <Unavailable />;
  const { pc, menus, marks, cocktails } = r.data;
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
          {m.groups.map((g) => <MenuGroupBlock key={g.name} g={g} marks={marks} cocktails={cocktails} />)}
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
