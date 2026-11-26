"use client";
/* eslint-disable @next/next/no-img-element -- Passport photos come through the member's own signed-in route. */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import { Avail } from "../bits";
import { PageTitle, Quiet } from "../Library";
import { ListsManager } from "../Personal";
import SearchArea from "../Search";
import TabView from "./TabView";
import { ForYouIndex } from "../ForYou";
import { VoteCardLink } from "../Votes";
import { Collage, CompactBottle, CompactCocktail, CountRow, KindLabel, PartyBanner, SectionHeading, TileGrid, Trail, accentCardStyle, useLevelMotion } from "../Drill";
import { BackLink } from "../bits";
import { setTabAtRoot } from "../appEvents";
import { readRecent } from "../recent";
import { chartHref, houseHref, listKicker } from "@/lib/passport/bar";
import { INDEX_HREF, PAST_VOTES_HREF, chartCoversOf, houseListCovers, indexLevel, indexPathOf, jumpBackIn, type IndexLevel, type Recent } from "@/lib/passport/nav";
import { barPhotoSrc, markKey, type Chart, type HouseList, type IndexData, type Marks, type PassportList, type VoteCard } from "@/lib/passport/types";

/** What the Index view sends (api/passport/view/index). */
export interface IndexView extends IndexData { lists: PassportList[]; marks: Marks; house_lists?: HouseList[]; charts?: Chart[]; past_count?: number; votes?: VoteCard[]; vote_results?: VoteCard[]; past_votes_count?: number }

// Remembered while the app is open: the "Pouring now / Everything" choice and each level's scroll position.
let everythingChoice = false;
const scrollAt = new Map<string, number>();

/**
 * File 14: the Index as a drill-down, like an iPod's menus. The top is the Party Picks banner (file 15) and six large
 * tiles (Cocktails, Spirits, Beer & wine, Lists, CG Picks, Journal) under "Jump back in"; each level is a short set of choices that slides over
 * the last, until a final list the member chose (one album, one spirit, one letter, one category or producer), in
 * compact rows. The search bar stays at the top of every level, and "Index › Cocktails › By spirit" shows where you
 * are. Every level has its own address (/passport/library?at=…), so Back, refresh and sharing work; old addresses
 * (?spirit=, #lists, …) open the right level. Every level is built from the one Index answer already loaded.
 */
export default function IndexTab() {
  return (
    <TabView<IndexView> name="index" skeleton={<IndexSkeleton />}>
      {(d, version) => <Index d={d} version={version} />}
    </TabView>
  );
}

/** First paint: the title, the search bar's place and six tile shapes, at once. */
function IndexSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <PageTitle kicker="Everything we've served" title="Index" />
      <div className="pp-skel rounded-xl h-12" />
      <ul className="grid grid-cols-2 gap-3 mt-6" aria-hidden>
        {["Cocktails", "Spirits", "Beer & wine", "Lists", "CG Picks", "Journal"].map((t) => (
          <li key={t} className="rounded-xl overflow-hidden border" style={{ borderColor: C.line }}>
            <span className="block aspect-[4/3] pp-skel" />
            <span className="block px-3 py-3 pp-t-card" style={{ color: C.faint }}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Index({ d, version }: { d: IndexView; version: number }) {
  const params = useSearchParams();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const path = useMemo(() => indexPathOf(params, hash), [params, hash]);
  const [everything, setEverything] = useState(everythingChoice);
  const level = useMemo(() => indexLevel(d, path, { everything }), [d, path, everything]);
  const key = path.join("/");
  const initialQ = (params?.get("q") || "").slice(0, 100);

  // Each level keeps its own scroll position: Back returns to the same place.
  const rootRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(key);
  keyRef.current = key;
  useEffect(() => {
    const on = () => { if (rootRef.current?.offsetParent) scrollAt.set(keyRef.current, window.scrollY); };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const shownKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (shownKey.current === null) { shownKey.current = key; return; }
    if (shownKey.current === key) return;
    shownKey.current = key;
    if (rootRef.current?.offsetParent) window.scrollTo({ top: scrollAt.get(key) || 0, behavior: "instant" as ScrollBehavior });
  }, [key]);
  const motion = useLevelMotion(key, path.length);
  // File 15, Part B: the Index's top level, for tapping the Index tab again.
  useEffect(() => { setTabAtRoot("index", !level.path.length); }, [level.path.length]);

  const parent = level.trail.length > 1 ? level.trail[level.trail.length - 2]?.label : null;
  return (
    <div ref={rootRef}>
      {/* File 15, Part B: every level below the top has Back at the top left: one level up, the trail's previous step. */}
      {level.trail.length > 1 && <div className="-mt-3 mb-1"><BackLink exact to={level.trail[level.trail.length - 2]} /></div>}
      <PageTitle kicker={parent && level.path.length > 1 ? parent : "Everything we've served"} title={level.title} />
      <SearchArea initial={initialQ}>
        <Trail trail={level.trail} title={level.title} />
        <div ref={motion} className="mt-4">
          <LevelBody level={level} d={d} version={version} everything={everything} setEverything={(v) => { everythingChoice = v; setEverything(v); }} />
        </div>
      </SearchArea>
    </div>
  );
}

function LevelBody({ level, d, version, everything, setEverything }: { level: IndexLevel; d: IndexView; version: number; everything: boolean; setEverything: (v: boolean) => void }) {
  const spiritsSwitch = level.path[0] === "spirits" ? <PouringSwitch everything={everything} onChange={setEverything} /> : null;
  switch (level.kind) {
    case "tiles":
      return (
        <>
          {level.path.length === 0 && <JumpBackIn d={d} />}
          {level.path.length === 0 && <PartyBanner b={level.banner} />}
          {spiritsSwitch}
          {level.tiles.length ? <TileGrid tiles={level.tiles} big={level.path.length === 0} /> : <Quiet>Nothing here yet.</Quiet>}
          {/* "My Cocktails" (the member's recipe book, Index only) keeps its "Add a cocktail" under Journal. */}
          {level.path.length === 1 && level.path[0] === "journal" && (
            <Link href="/passport/bespoke?new=1" scroll={false} className="mt-4 inline-flex items-center rounded-full border px-4 min-h-[44px] pp-t-secondary pp-focus pp-press"
              style={{ borderColor: C.brass, color: C.brass }}>+ Add a cocktail to My Cocktails</Link>
          )}
          {level.path.length === 0 && d.cocktails.some((c) => c.available) && (
            <p className="pp-t-secondary mt-6 flex items-center gap-2" style={{ color: C.muted }}><Avail on /> <span aria-hidden>Green dot: being served right now</span></p>
          )}
        </>
      );
    case "letters":
      return (
        <ul className="grid grid-cols-6 sm:grid-cols-9 gap-2" aria-label="Cocktails by first letter">
          {level.letters.map((l) => (
            <li key={l.letter}>
              <Link href={l.href} scroll={false} aria-label={`${l.letter}, ${l.count} cocktail${l.count === 1 ? "" : "s"}`}
                className="flex flex-col items-center justify-center min-h-[56px] rounded-lg border pp-focus pp-press" style={accentCardStyle("cocktails")}>
                <span className="pp-t-card" style={{ color: C.text }}>{l.letter}</span>
                <span className="pp-t-secondary pp-num" style={{ color: C.muted, fontSize: "0.75rem" }}>{l.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
    case "cocktails":
      return (
        <>
          <Count n={level.items.length} what="cocktail" />
          <ul>{level.items.map((c) => <CompactCocktail key={c.id} c={c} mark={d.marks[markKey("cocktail", c.id)]} />)}</ul>
        </>
      );
    case "bottles":
      return (
        <>
          {spiritsSwitch}
          <Count n={level.items.length} what="bottle" />
          <ul>{level.items.map((x) => <CompactBottle key={x.bottle.id} b={x.bottle} out={x.out} mark={d.marks[markKey("bottle", x.bottle.id)]} />)}</ul>
        </>
      );
    case "producers":
      return (
        <>
          {spiritsSwitch}
          <p className="pp-t-secondary mb-1" style={{ color: C.muted }}>By producer · {level.producers.reduce((n, p) => n + p.count, 0)} bottles</p>
          <ul>{level.producers.map((p) => <CountRow key={p.name} href={p.href} label={p.name} count={p.count} />)}</ul>
        </>
      );
    case "drinks":
      // File 15, Part F: a beer, wine or cider opens its own page (like a spirit), with "+", heart, notes and photos.
      return (
        <ul>
          {level.items.map((x, i) => x.id
            ? <CompactBottle key={`d${x.id}`} b={{ id: x.id, name: x.name, photo: x.photo, photo_clear: x.photo_clear, available: x.available, status_label: x.status_label }} out={!!x.status_label} mark={d.marks[markKey("bottle", x.id)]} />
            : (
            <li key={`${x.name}-${i}`} className="py-3 border-b" style={{ borderColor: C.line, contentVisibility: "auto", containIntrinsicSize: "auto 64px", opacity: x.status_label ? 0.7 : 1 }}>
              <span className="flex items-center gap-2">
                <span className="pp-t-body" style={{ color: C.text }}>{x.name}</span>
                <Avail on={x.available} />
                {x.status_label && <span className="pp-t-eyebrow" style={{ color: C.faint }}>{x.status_label}</span>}
              </span>
              {x.description && <span className="pp-t-secondary block mt-0.5 line-clamp-2" style={{ color: C.muted }}>{x.description}</span>}
            </li>
          ))}
        </ul>
      );
    case "lists":
      return <ListsManager key={`lists-${version}`} initial={d.lists} />;
    case "house":
      return (
        <ul className="space-y-3">
          {level.lists.map((l) => (
            <li key={l.id}>
              <Link href={houseHref(l.id)} scroll={false} className="flex items-stretch gap-3 rounded-xl border pl-4 pp-focus pp-row pp-card pp-accent-card overflow-hidden" style={accentCardStyle("bar")}>
                <span className="flex-1 min-w-0 py-4">
                  <KindLabel section="bar">{listKicker(l)}</KindLabel>
                  <span className="pp-t-card block mt-1" style={{ color: C.text }}>{l.title}</span>
                  <span className="pp-t-secondary block mt-1" style={{ color: C.muted }}>{l.count} {l.kind === "cocktail" ? "cocktail" : "bottle"}{l.count === 1 ? "" : "s"}</span>
                </span>
                <span className="block w-[88px] shrink-0"><Collage covers={houseListCovers(l)} section="bar" label={l.title} /></span>
              </Link>
            </li>
          ))}
        </ul>
      );
    case "charts":
      return (
        <ul className="space-y-3">
          {level.charts.map((c) => (
            <li key={c.key}>
              <Link href={chartHref(c.key)} scroll={false} className="flex items-stretch gap-3 rounded-xl border pl-4 pp-focus pp-row pp-card pp-accent-card overflow-hidden" style={accentCardStyle("bar")}>
                <span className="flex-1 min-w-0 py-4">
                  <KindLabel section="bar">{c.season_name}</KindLabel>
                  <span className="pp-t-card block mt-1" style={{ color: C.text }}>{c.title}</span>
                </span>
                <span className="block w-[88px] shrink-0"><Collage covers={chartCoversOf(c)} section="bar" label={c.title} /></span>
              </Link>
            </li>
          ))}
        </ul>
      );
    case "party":
      // File 15, Part A: everything a member votes on or takes part in: open flights and brackets, results, past votes.
      return (
        <>
          <p className="pp-t-secondary -mt-2 mb-4" style={{ color: C.muted }}>Vote on flights and brackets. Your picks are yours alone.</p>
          {level.open.length > 0 && <ul className="space-y-3">{level.open.map((v) => <li key={`${v.kind}${v.id}`}><VoteCardLink c={v} big /></li>)}</ul>}
          {level.results.length > 0 && (
            <>
              <SectionHeading section="party">The results are in</SectionHeading>
              <ul className="space-y-3">{level.results.map((v) => <li key={`r${v.kind}${v.id}`}><VoteCardLink c={v} /></li>)}</ul>
            </>
          )}
          {level.past > 0 && <ul className="mt-3"><CountRow href={PAST_VOTES_HREF} label="Past votes" count={level.past} /></ul>}
        </>
      );
    case "for-you":
      return <ForYouIndex items={d.recommendations} enough={d.enough} suggest={d.suggest} />;
    default:
      return (
        <div className="mt-2">
          <Quiet>This part of the Index has changed since that link was made.</Quiet>
          <Link href={INDEX_HREF} scroll={false} className="inline-flex items-center min-h-[44px] mt-2 pp-t-body underline underline-offset-4 pp-focus" style={{ color: C.brass }}>Back to the Index</Link>
        </div>
      );
  }
}

function Count({ n, what }: { n: number; what: string }) {
  return <p className="pp-t-secondary pp-num mb-1" style={{ color: C.faint }}>{n} {what}{n === 1 ? "" : "s"}</p>;
}

/** The Index's spirits: what is on the spirits list now, or everything (the archive too). */
function PouringSwitch({ everything, onChange }: { everything: boolean; onChange: (v: boolean) => void }) {
  return (
    <div role="group" aria-label="Which spirits" className="inline-flex rounded-full border p-1 mb-4" style={{ borderColor: C.line }}>
      {[{ v: false, label: "Pouring now" }, { v: true, label: "Everything" }].map((o) => (
        <button key={o.label} type="button" aria-pressed={everything === o.v} onClick={() => onChange(o.v)}
          className="rounded-full px-4 min-h-[44px] pp-t-secondary pp-focus" style={everything === o.v ? { background: C.brass, color: C.bg, fontWeight: 500 } : { color: C.muted }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "Jump back in": the last three things the member opened that the Index still holds. */
function JumpBackIn({ d }: { d: IndexView }) {
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => {
    const read = () => setRecent(readRecent());
    read();
    window.addEventListener("pp-recent", read);
    return () => window.removeEventListener("pp-recent", read);
  }, []);
  const items = useMemo(() => jumpBackIn(recent, d), [recent, d]);
  if (!items.length) return null;
  return (
    <section aria-labelledby="pp-jump-back" className="mb-6 -mt-6">
      <SectionHeading id="pp-jump-back" section="yours">Jump back in</SectionHeading>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((x) => (
          <li key={`${x.kind}${x.id}`}>
            <Link href={x.kind === "cocktail" ? `/passport/library/${x.id}` : `/passport/spirits/${x.id}`} scroll={false}
              className="flex flex-col h-full rounded-lg border overflow-hidden pp-focus pp-row" style={{ borderColor: C.line, background: C.card }}>
              <span className="block aspect-square overflow-hidden" style={{ background: C.card }}>
                {x.photo
                  ? <img src={barPhotoSrc(x.kind, x.id, x.photo, "thumb")} alt={x.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  : <span aria-hidden className="w-full h-full flex items-center justify-center font-display" style={{ color: C.brass, fontSize: "1.6rem", background: "#1a2015" }}>{x.name.slice(0, 1)}</span>}
              </span>
              <span className="pp-t-secondary px-2 py-1.5 line-clamp-2" style={{ color: C.text }}>{x.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
