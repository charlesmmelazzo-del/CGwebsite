"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { C } from "../theme";
import { Collapsible, GREEN, ScreenSkeleton } from "../bits";
import { BottleRow, CocktailRow, PageTitle, Quiet, SectionTitle } from "../Library";
import { ListsManager } from "../Personal";
import SearchArea from "../Search";
import TabView from "./TabView";
import { HouseLists } from "./Slots";
import { byCategory, withSpirit } from "@/lib/passport/shell";
import { markKey, type Chart, type HouseList, type IndexData, type IndexDrink, type Marks, type PassportList, type VoteCard } from "@/lib/passport/types";
import { scrollToId } from "../appEvents";

/** What the Index view sends (api/passport/view/index). */
export interface IndexView extends IndexData { lists: PassportList[]; marks: Marks; house_lists?: HouseList[]; charts?: Chart[]; past_count?: number; votes?: VoteCard[]; past_votes_count?: number }

const YOURS = [
  { href: "/passport/favorites", title: "Favorites", line: "Cocktails and bottles you love, and your ratings" },
  { href: "/passport/notes", title: "Notes", line: "Your tasting notes" },
  { href: "/passport/history", title: "History", line: "What you've ordered, and how often" },
  // File 11: the member's own photos of our cocktails and bottles.
  { href: "/passport/photos", title: "My photos", line: "Your own photos, only for you and our team" },
];

/**
 * File 06: the Index tab, everything the bar has ever served plus the member's own lists. The search bar; Lists (theirs,
 * then the house lists from file 07); Yours (favorites, notes, recipes, history); every cocktail shown in Passport with
 * the base-spirit filter; every bottle a member may open, by category; and beer and wine. What is being served right now
 * carries a small green dot.
 */
export default function IndexTab() {
  return (
    <TabView<IndexView> name="index" skeleton={<ScreenSkeleton rows={8} />}>
      {(d, version) => <Index d={d} version={version} />}
    </TabView>
  );
}

function Index({ d, version }: { d: IndexView; version: number }) {
  const params = useSearchParams();
  // An old Library link (?q= / ?spirit=) still works: it fills the search box or the filter.
  const [spirit, setSpirit] = useState(() => {
    const s = params?.get("spirit") || "";
    return d.base_spirits.some((b) => b.key === s) ? s : "";
  });
  const initialQ = (params?.get("q") || "").slice(0, 100);
  const cocktails = useMemo(() => withSpirit(d.cocktails, spirit), [d.cocktails, spirit]);
  const spirits = useMemo(() => byCategory(d.bottles), [d.bottles]);
  const drinks = useMemo(() => {
    const out: { name: string; items: IndexDrink[] }[] = [];
    for (const kind of ["Beer", "Wine", "Other"] as const) {
      const items = d.drinks.filter((x) => x.kind === kind);
      if (items.length) out.push({ name: kind === "Other" ? "Cider and more" : kind, items });
    }
    return out;
  }, [d.drinks]);
  const anyAvailable = d.cocktails.some((c) => c.available) || d.bottles.some((b) => b.available) || d.drinks.some((x) => x.available);
  useEffect(() => {
    if (window.location.hash === "#lists") scrollToId("lists");
  }, []);
  const jump = (id: string) => scrollToId(id, true);
  const sections = [
    { id: "lists", label: "Lists" },
    ...(d.house_lists?.length || d.charts?.length || d.past_count || d.votes?.length || d.past_votes_count ? [{ id: "from-common-good", label: "From Common Good" }] : []),
    { id: "yours", label: "Yours" }, { id: "cocktails", label: "Cocktails" },
    ...(spirits.length ? [{ id: "spirits", label: "Spirits" }] : []), ...(drinks.length ? [{ id: "beer-wine", label: "Beer & wine" }] : []),
  ];
  return (
    <>
      <PageTitle kicker="Everything we've served" title="Index" />
      <SearchArea initial={initialQ}>
        <nav aria-label="Jump to" className="-mx-5 px-5 mt-4 flex gap-2 overflow-x-auto pb-1">
          {sections.map((s) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)} className="shrink-0 rounded-full border px-3.5 min-h-[36px] font-body text-xs whitespace-nowrap pp-focus pp-press"
              style={{ borderColor: C.line, color: C.muted }}>{s.label}</button>
          ))}
        </nav>

        <section id="lists">
          <SectionTitle>Your lists</SectionTitle>
          <ListsManager key={`lists-${version}`} initial={d.lists} />
        </section>
        <HouseLists lists={d.house_lists} charts={d.charts} pastCount={d.past_count} votes={d.votes} pastVotes={d.past_votes_count} />

        <section id="yours">
          <SectionTitle>Yours</SectionTitle>
          {/* "My Cocktails" (the member's recipe book, Index only): its own clearly visible entry, with "Add a cocktail". */}
          <div className="mb-3 rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: `${C.brass}66`, background: C.card }}>
            <Link href="/passport/bespoke" scroll={false} className="flex-1 min-w-0 pp-focus rounded-sm">
              <span className="font-display text-[23px] leading-tight block" style={{ color: C.text }}>My Cocktails</span>
              <span className="font-body text-xs mt-1 block leading-snug" style={{ color: C.muted }}>Drinks made for you at the bar, and your own</span>
            </Link>
            <Link href="/passport/bespoke?new=1" scroll={false} className="shrink-0 rounded-full border px-4 min-h-[44px] flex items-center font-body text-[12px] tracking-[0.08em] pp-focus pp-press"
              style={{ borderColor: C.brass, color: C.brass }}>+ Add a cocktail</Link>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {YOURS.map((p) => (
              <li key={p.href}>
                <Link href={p.href} scroll={false} className="block h-full rounded-xl border p-4 pp-focus pp-row" style={{ borderColor: C.line, background: C.card }}>
                  <span className="font-display text-[21px] leading-tight block" style={{ color: C.text }}>{p.title}</span>
                  <span className="font-body text-xs mt-1 block leading-snug" style={{ color: C.muted }}>{p.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {anyAvailable && (
          <p className="mt-10 -mb-6 flex items-center gap-2 font-body text-xs" style={{ color: C.muted }}>
            <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: GREEN }} /> Being served right now
          </p>
        )}

        <section id="cocktails">
          <SectionTitle aside={<span className="font-body text-xs" style={{ color: C.faint }}>{cocktails.length}</span>}>Cocktails</SectionTitle>
          {d.base_spirits.length > 0 && (
            <div role="group" aria-label="Filter cocktails by base spirit" className="-mx-5 px-5 mb-2 flex gap-2 overflow-x-auto pb-1">
              {[{ key: "", label: "All", count: d.cocktails.length }, ...d.base_spirits].map((s) => {
                const on = s.key === spirit;
                return (
                  <button key={s.key || "all"} type="button" aria-pressed={on} onClick={() => setSpirit(s.key)}
                    className="shrink-0 rounded-full border px-3.5 min-h-[36px] font-body text-xs whitespace-nowrap pp-focus pp-press"
                    style={on ? { borderColor: C.brass, color: C.brass, background: "#1a1f14" } : { borderColor: C.line, color: C.muted }}>
                    {s.label}{s.key ? <span style={{ opacity: 0.6 }}> {s.count}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
          {cocktails.length
            ? <ul>{cocktails.map((c) => <CocktailRow key={c.id} c={c} mark={d.marks[markKey("cocktail", c.id)]} lazy />)}</ul>
            : <Quiet>{spirit ? "No cocktails under that spirit." : "The Index is being filled in."}</Quiet>}
        </section>

        {spirits.length > 0 && (
          <section id="spirits">
            <SectionTitle aside={<span className="font-body text-xs" style={{ color: C.faint }}>{d.bottles.length}</span>}>Spirits</SectionTitle>
            <div className="border-t" style={{ borderColor: C.line }}>
              {spirits.map((g) => (
                <Collapsible key={g.name} title={g.name} count={g.items.length}>
                  <ul className="pb-3">{g.items.map((b) => <BottleRow key={b.id} b={b} mark={d.marks[markKey("bottle", b.id)]} lazy />)}</ul>
                </Collapsible>
              ))}
            </div>
          </section>
        )}

        {drinks.length > 0 && (
          <section id="beer-wine">
            <SectionTitle aside={<span className="font-body text-xs" style={{ color: C.faint }}>{d.drinks.length}</span>}>Beer and wine</SectionTitle>
            <div className="border-t" style={{ borderColor: C.line }}>
              {drinks.map((g) => (
                <Collapsible key={g.name} title={g.name} count={g.items.length}>
                  <ul className="pb-3">
                    {g.items.map((x, i) => (
                      <li key={`${x.name}-${i}`} className="py-3 border-b" style={{ borderColor: C.line, contentVisibility: "auto", containIntrinsicSize: "auto 64px" }}>
                        <span className="flex items-center gap-2">
                          <span className="font-body text-[15px]" style={{ color: x.status_label ? C.muted : C.text }}>{x.name}</span>
                          {x.available && <span title="Available now" className="inline-flex"><span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: GREEN }} /><span className="sr-only">Available now</span></span>}
                          {x.status_label && <span className="font-body text-[10px] tracking-[0.15em] uppercase" style={{ color: C.faint }}>{x.status_label}</span>}
                        </span>
                        {x.description && <span className="block font-body text-sm mt-1 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{x.description}</span>}
                      </li>
                    ))}
                  </ul>
                </Collapsible>
              ))}
            </div>
          </section>
        )}
      </SearchArea>
    </>
  );
}
