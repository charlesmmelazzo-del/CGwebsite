"use client";

import { useEffect, useRef } from "react";
import { scrollToId } from "../appEvents";
import { C } from "../theme";
import { Collapsible, ScreenSkeleton } from "../bits";
import { CocktailFeature, MenuGroupBlock, PageTitle, Quiet, SectionTitle, SpiritRow } from "../Library";
import SearchArea from "../Search";
import TabView from "./TabView";
import { markKey, type Cocktail, type Marks, type MenuGroup, type MenuInfo, type ToastMenu } from "@/lib/passport/types";

/** What the Menu view sends (api/passport/view/menu). */
export interface MenuView { exclusives: Cocktail[]; menu_info: MenuInfo; menus: ToastMenu[]; passport_group: MenuGroup | null; spirits: ToastMenu | null; marks: Marks }

const STALE_MS = 2 * 24 * 3600 * 1000;

/**
 * File 06: the Menu tab, what is being served now. The search bar, the Passport exclusives, the Toast menus an admin
 * ticked (as before), then the spirits list by category: each category starts closed with its count.
 */
export default function MenuTab() {
  return (
    <TabView<MenuView> name="menu" skeleton={<ScreenSkeleton cards={1} rows={6} />}>
      {(d) => <Menu d={d} />}
    </TabView>
  );
}

function Menu({ d }: { d: MenuView }) {
  const spiritsRef = useRef<HTMLElement>(null);
  // An old link to the spirits list (/passport/spirits) lands here: go to the spirits.
  useEffect(() => {
    if (window.location.hash === "#spirits") scrollToId("spirits");
  }, []);
  const updated = d.menu_info.updated_at ? new Date(d.menu_info.updated_at) : null;
  // Toast's price for each Passport exclusive, from the group an admin marked as the Passport cocktails.
  const priceFor = new Map((d.passport_group?.items || []).filter((i) => i.cocktail_id).map((i) => [i.cocktail_id as number, i.prices]));
  const shown = d.menu_info.available ? d.menus : [];
  const nothing = !d.exclusives.length && !shown.length && !d.spirits;
  return (
    <>
      <PageTitle kicker="What we're pouring" title="Menu" />
      <SearchArea>
        {d.exclusives.length > 0 && (
          <section>
            <SectionTitle>Passport exclusives · members only</SectionTitle>
            <div className="space-y-4">{d.exclusives.map((c) => <CocktailFeature key={c.id} c={c} prices={priceFor.get(c.id)} mark={d.marks[markKey("cocktail", c.id)]} />)}</div>
          </section>
        )}
        {shown.map((m) => (
          <section key={m.name}>
            <SectionTitle>{m.name}</SectionTitle>
            {m.groups.map((g) => <MenuGroupBlock key={g.name} g={g} marks={d.marks} />)}
          </section>
        ))}
        {d.spirits && d.spirits.groups.length > 0 && (
          <section ref={spiritsRef} id="spirits">
            <SectionTitle aside={<span className="font-body text-xs" style={{ color: C.faint }}>{d.spirits.groups.reduce((n, g) => n + g.items.length, 0)} bottles</span>}>Spirits</SectionTitle>
            <div className="border-t" style={{ borderColor: C.line }}>
              {d.spirits.groups.map((g) => (
                <Collapsible key={g.name} title={g.name} count={g.items.length}>
                  <ul className="pb-3">{g.items.map((it, i) => <SpiritRow key={`${it.bottle_id ?? "x"}-${i}`} it={it} marks={d.marks} lazy />)}</ul>
                </Collapsible>
              ))}
            </div>
          </section>
        )}
        {nothing && <div className="mt-10"><Quiet>Ask your bartender what&rsquo;s pouring tonight, or browse everything we&rsquo;ve served in the Index.</Quiet></div>}
        {updated && Date.now() - updated.getTime() > STALE_MS && (
          <p className="font-body text-[11px] mt-10" style={{ color: C.faint }}>Menu last updated {updated.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
        )}
      </SearchArea>
    </>
  );
}
