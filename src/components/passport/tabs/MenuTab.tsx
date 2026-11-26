"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import { BackLink, SkelRows } from "../bits";
import { TAB_ROOT_EVENT, setTabAtRoot } from "../appEvents";
import { PageTitle, Quiet } from "../Library";
import SearchArea from "../Search";
import TabView from "./TabView";
import { CompactBottle, CompactMenuItem, CountRow, CoverBanner, SectionHeading, TileGrid, useLevelMotion } from "../Drill";
import { ACCENTS } from "@/lib/passport/accents";
import {
  EXCLUSIVES_TAB, SPIRITS_TAB, chosenTab, menuTabs, parseAt, spiritCategories, spiritLevel, spiritsFromMenu, type MenuTabModel, type Tile,
} from "@/lib/passport/nav";
import { markKey, type Cocktail, type Marks, type MenuGroup, type MenuInfo, type MenuItem, type MenuTabDef, type ToastMenu } from "@/lib/passport/types";

/** What the Menu view sends (api/passport/view/menu). File 14 adds the admin's tabs. */
export interface MenuView { exclusives: Cocktail[]; menu_info: MenuInfo; menus: ToastMenu[]; passport_group: MenuGroup | null; spirits: ToastMenu | null; marks: Marks; tabs?: MenuTabDef[] }

const STALE_MS = 2 * 24 * 3600 * 1000;
// The chosen tab is remembered while the app is open (this tab stays mounted; this survives a refresh of its data).
let remembered: string | null = null;
const MENU_HREF = "/passport/menu";
const spiritsHref = (path: string[]) => `${MENU_HREF}?tab=${SPIRITS_TAB}${path.length ? `&s=${encodeURIComponent(path.map((p) => encodeURIComponent(p)).join("/"))}` : ""}`;

/**
 * File 14: the Menu tab. Sideways tabs at the top (sticky under the search bar), one per section: "Exclusives" when
 * there are any, then the Toast menus an admin ticked (as tabs of their groups, or one tab each, as set in Passport
 * settings → Menus), then Spirits. A tab shows only its own section; swiping moves between tabs. Rows are compact: the
 * full description lives on the item's page. Spirits is never one long list: categories, then (over 40 bottles) the
 * producers, then the bottles, "out right now" last and dimmed.
 */
export default function MenuTab() {
  return (
    <TabView<MenuView> name="menu" skeleton={<MenuSkeleton />}>
      {(d) => <Menu d={d} />}
    </TabView>
  );
}

/** First paint: the title, the search bar's place and the tab strip's shape, at once (the names follow with the data). */
function MenuSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <PageTitle kicker="What we're pouring" title="Menu" />
      <div className="pp-skel rounded-xl h-12" />
      <div className="-mx-5 mt-3 px-5 border-b flex gap-4 py-3" style={{ borderColor: C.line }} aria-hidden>
        {[88, 120, 76, 104].map((w, i) => <span key={i} className="pp-skel rounded h-5 shrink-0" style={{ width: w }} />)}
      </div>
      <SkelRows n={6} tall />
    </div>
  );
}

function Menu({ d }: { d: MenuView }) {
  const params = useSearchParams();
  const router = useRouter();
  const tabs = useMemo(() => menuTabs({
    exclusives: d.exclusives, menus: d.menus, tabs: d.tabs, spirits: d.spirits, available: d.menu_info.available,
  }), [d]);
  // An old link to the spirits list (/passport/spirits → /passport/menu#spirits) opens the Spirits tab.
  const [hash, setHash] = useState("");
  useEffect(() => { setHash(window.location.hash); }, []);
  const asked = params?.get("tab") || (hash === "#spirits" ? SPIRITS_TAB : null);
  const [picked, setPicked] = useState<string | null>(null);
  const current = chosenTab(tabs, picked ?? asked, remembered);
  useEffect(() => { if (current) remembered = current; }, [current]);
  const tab = tabs.find((t) => t.id === current) || null;

  const stripRef = useRef<HTMLDivElement>(null);
  const choose = (id: string) => {
    setPicked(id);
    remembered = id;
    // The address follows (so refresh and Back keep the tab), without a new screen.
    const url = id === tabs[0]?.id ? MENU_HREF : `${MENU_HREF}?tab=${encodeURIComponent(id)}`;
    try { window.history.replaceState(window.history.state, "", url); } catch { /* old browser */ }
    const top = stripRef.current ? stripRef.current.getBoundingClientRect().top + window.scrollY - 56 : 0;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  };
  // A Back to an address with another ?tab= wins over the tab picked by tapping.
  const lastAsked = useRef(asked);
  useEffect(() => { if (asked !== lastAsked.current) { lastAsked.current = asked; setPicked(null); } }, [asked]);

  // Keep the chosen tab in view in the strip.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>("[aria-selected='true']");
    el?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "instant" as ScrollBehavior });
  }, [current]);

  // Swipe left / right on the content moves between tabs.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s || !tab) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    const i = tabs.findIndex((x) => x.id === tab.id);
    const next = tabs[i + (dx < 0 ? 1 : -1)];
    if (next) choose(next.id);
  };

  const sPath = tab?.kind === "spirits" ? parseAt(params?.get("s")) : [];
  // File 15, Part B: the Menu's top level is its first section; tapping the Menu tab again comes back to it.
  const firstId = tabs[0]?.id ?? null;
  useEffect(() => { setTabAtRoot("menu", current === firstId && !sPath.length); }, [current, firstId, sPath.length]);
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<{ tab: string }>).detail?.tab !== "menu" || !firstId) return;
      setPicked(firstId);
      remembered = firstId;
      try { window.history.replaceState(window.history.state, "", MENU_HREF); } catch { /* old browser */ }
    };
    window.addEventListener(TAB_ROOT_EVENT, on);
    return () => window.removeEventListener(TAB_ROOT_EVENT, on);
  }, [firstId]);
  const motion = useLevelMotion(`${current}|${sPath.join("/")}`, tabs.findIndex((t) => t.id === current) * 10 + sPath.length);
  const updated = d.menu_info.updated_at ? new Date(d.menu_info.updated_at) : null;

  return (
    <>
      <PageTitle kicker="What we're pouring" title="Menu" />
      <SearchArea>
        {tabs.length > 0 && (
          <div ref={stripRef} className="sticky z-20 -mx-5 mt-3 border-b" style={{ top: "var(--pp-top)", background: "rgba(19,23,15,0.97)", borderColor: C.line }}>
            <div role="tablist" aria-label="Menu sections" className="pp-tabs flex gap-1 overflow-x-auto px-5">
              {tabs.map((t) => {
                const on = t.id === current;
                const a = ACCENTS[t.section];
                return (
                  <button key={t.id} type="button" role="tab" id={`menu-tab-${t.id}`} aria-selected={on} aria-controls="menu-panel" onClick={() => choose(t.id)}
                    className="shrink-0 px-3.5 min-h-[48px] pp-t-body whitespace-nowrap pp-focus relative"
                    style={{ color: on ? C.text : C.muted, fontWeight: on ? 500 : 400 }}>
                    {t.label}
                    <span aria-hidden className="absolute left-3 right-3 bottom-0 h-[3px] rounded-full" style={{ background: on ? a.edge : "transparent" }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div id="menu-panel" role="tabpanel" aria-labelledby={current ? `menu-tab-${current}` : undefined} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[50vh]">
          <div ref={motion}>
            {tab ? <TabBody key={tab.id} tab={tab} d={d} first={tab.id === tabs[0]?.id} sPath={sPath} go={(p) => router.push(spiritsHref(p), { scroll: false })} /> : (
              <div className="mt-10"><Quiet>Ask your bartender what&rsquo;s pouring tonight, or browse everything we&rsquo;ve served in the Index.</Quiet></div>
            )}
          </div>
        </div>
        {updated && Date.now() - updated.getTime() > STALE_MS && (
          <p className="pp-t-secondary mt-10" style={{ color: C.faint }}>Menu last updated {updated.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
        )}
      </SearchArea>
    </>
  );
}

function TabBody({ tab, d, first, sPath, go }: { tab: MenuTabModel; d: MenuView; first: boolean; sPath: string[]; go: (p: string[]) => void }) {
  if (tab.kind === "spirits") return <SpiritsBody tab={tab} d={d} path={sPath} go={go} />;
  if (tab.kind === EXCLUSIVES_TAB) {
    // Toast's price for each Passport exclusive, from the group an admin marked as the Passport cocktails.
    const priceFor = new Map((d.passport_group?.items || []).filter((i) => i.cocktail_id).map((i) => [i.cocktail_id as number, i.prices]));
    const rows: MenuItem[] = d.exclusives.map((c) => ({ name: c.name, description: "", prices: priceFor.get(c.id) || [], cocktail_id: c.id, bottle_id: null, unavailable: false, card: { tagline: c.tagline, ingredients: "", flavor: c.flavor }, photo: c.photo }));
    return (
      <section aria-labelledby="menu-h-exclusives">
        {first ? <CoverBanner cover={tab.cover} title="Passport exclusives" section="cocktails" /> : null}
        <SectionHeading id="menu-h-exclusives" section="cocktails">Passport exclusives</SectionHeading>
        <p className="pp-t-secondary -mt-1 mb-2" style={{ color: C.muted }}>Members only</p>
        <ul>{rows.map((it) => <CompactMenuItem key={it.cocktail_id} it={it} marks={d.marks} />)}</ul>
      </section>
    );
  }
  return <MenuBody tab={tab} marks={d.marks} first={first} />;
}

function MenuBody({ tab, marks, first }: { tab: MenuTabModel; marks: Marks; first: boolean }) {
  const [chip, setChip] = useState(0);
  const groups = tab.chips ? [tab.groups[Math.min(chip, tab.groups.length - 1)]] : tab.groups;
  const many = tab.groups.length > 1;
  return (
    <section aria-labelledby={`menu-h-${tab.id}`}>
      {first && <CoverBanner cover={tab.cover} title={tab.label} section={tab.section} />}
      <SectionHeading id={`menu-h-${tab.id}`} section={tab.section}>{tab.label}</SectionHeading>
      {tab.chips && (
        <div role="group" aria-label={`${tab.label}: choose a part`} className="pp-tabs -mx-5 px-5 mb-1 flex gap-2 overflow-x-auto pb-1">
          {tab.groups.map((g, i) => {
            const on = i === chip;
            return (
              <button key={g.name} type="button" aria-pressed={on} onClick={() => setChip(i)}
                className="shrink-0 rounded-full border px-4 min-h-[44px] pp-t-secondary whitespace-nowrap pp-focus pp-press"
                style={on ? { borderColor: ACCENTS[tab.section].edge, color: C.text, background: ACCENTS[tab.section].tint } : { borderColor: C.line, color: C.muted }}>
                {g.name}<span className="pp-num ml-1.5" style={{ opacity: 0.7 }}>{g.items.length}</span>
              </button>
            );
          })}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.name}>
          {many && <h3 className="pp-t-eyebrow mt-6 mb-1" style={{ color: ACCENTS[tab.section].ink }}>{g.name}</h3>}
          <ul>{g.items.map((it, i) => <CompactMenuItem key={`${it.name}-${i}`} it={it} marks={marks} />)}</ul>
        </div>
      ))}
    </section>
  );
}

/** Spirits: category tiles → (over 40 bottles) producers → bottles. One level at a time; Back returns. */
function SpiritsBody({ tab, d, path, go }: { tab: MenuTabModel; d: MenuView; path: string[]; go: (p: string[]) => void }) {
  const entries = useMemo(() => spiritsFromMenu(tab.groups), [tab.groups]);
  const [cat, producer] = path;
  const up = producer ? { href: spiritsHref([cat]), label: cat } : { href: spiritsHref([]), label: "Spirits" };
  const crumbs = (
    <>
    <div className="mt-3"><BackLink exact to={up} /></div>
    <nav aria-label="Where you are" className="flex items-center gap-1 flex-wrap">
      <button type="button" onClick={() => go([])} className="pp-t-secondary pp-focus rounded min-h-[44px] px-1 underline underline-offset-4" style={{ color: C.muted }}>‹ All spirits</button>
      {producer && <><span aria-hidden style={{ color: C.faint }}>›</span><button type="button" onClick={() => go([cat])} className="pp-t-secondary pp-focus rounded min-h-[44px] px-1 underline underline-offset-4" style={{ color: C.muted }}>{cat}</button></>}
    </nav>
    </>
  );
  if (!cat) {
    const tiles: Tile[] = spiritCategories(entries).map((t) => ({ id: t.name, label: t.name, count: t.count, covers: t.covers, href: spiritsHref([t.name]), section: "spirits" }));
    return (
      <section aria-labelledby="menu-h-spirits">
        <SectionHeading id="menu-h-spirits" section="spirits" aside={<span className="pp-t-secondary pp-num" style={{ color: C.faint }}>{entries.length} bottles</span>}>Spirits</SectionHeading>
        <TileGrid tiles={tiles} />
      </section>
    );
  }
  const lvl = spiritLevel(entries, cat, producer);
  if (lvl.kind === "missing") return <>{crumbs}<div className="mt-6"><Quiet>That part of the spirits list has changed. Choose a category above.</Quiet></div></>;
  if (lvl.kind === "producers") {
    return (
      <section aria-labelledby="menu-h-cat">
        {crumbs}
        <SectionHeading id="menu-h-cat" section="spirits" className="-mt-6" aside={<span className="pp-t-secondary pp-num" style={{ color: C.faint }}>{lvl.producers.reduce((n, p) => n + p.count, 0)} bottles</span>}>{cat}</SectionHeading>
        <p className="pp-t-secondary -mt-1 mb-1" style={{ color: C.muted }}>By producer</p>
        <ul>{lvl.producers.map((p) => <CountRow key={p.name} href={spiritsHref([cat, p.name])} label={p.name} count={p.count} />)}</ul>
      </section>
    );
  }
  return (
    <section aria-labelledby="menu-h-bottles">
      {crumbs}
      <SectionHeading id="menu-h-bottles" section="spirits" className="-mt-6" aside={<span className="pp-t-secondary pp-num" style={{ color: C.faint }}>{lvl.items.length}</span>}>{producer || cat}</SectionHeading>
      <ul>
        {lvl.items.map((x, i) => {
          const it = (x as typeof entries[number]).item;
          return x.id
            ? <CompactBottle key={`${x.id}-${i}`} b={{ id: x.id, name: x.name, photo: x.photo, available: false, status_label: x.out ? "Out right now" : null }} out={x.out} mark={d.marks[markKey("bottle", x.id)]} prices={it.prices} />
            : <CompactMenuItem key={`n-${i}`} it={it} marks={d.marks} spirit />;
        })}
      </ul>
    </section>
  );
}
