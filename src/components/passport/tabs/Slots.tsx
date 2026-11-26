"use client";

import { Band } from "../Library";
import Link from "next/link";
import { useState } from "react";
import { C } from "../theme";
import { postJson } from "../ui";
import { PressLink } from "../bits";
import { useShell } from "../shellContext";
import { PAST_HREF, chartHref, discountLine, feedHref, feedKicker, flightLine, houseHref, listKicker, messageHref } from "@/lib/passport/bar";
import type { BarMessage, Chart, FeedCard, HouseList, SpiritOfTheDay as Spirit, VoteCard, WelcomeAperitif as Aperitif } from "@/lib/passport/types";
import { PAST_VOTES_HREF } from "@/lib/passport/votes";
import { VoteCardLink } from "../Votes";
import { Collage, KindLabel, accentCardStyle } from "../Drill";
import { houseListCovers } from "@/lib/passport/nav";
import { ACCENTS, type SectionId } from "@/lib/passport/accents";

/** File 14, Part 7: a What's new card's section (a new list, chart or vote: from the bar; a new menu: cocktails). */
const feedSection = (c: FeedCard): SectionId => (c.link_kind === "menu" ? "cocktails" : "bar");

/**
 * Places in the layout that file 06 kept and file 07 fills. Each draws NOTHING until it has something in it: never an
 * empty box or a placeholder line. They take their data as props from the tab's one call.
 */

const kicker = "pp-t-eyebrow";

/** Hide a message or a What's new card for this member: gone at once; if the bar can't be reached, it comes back. */
function useDismiss(what: "message" | "feed") {
  const shell = useShell();
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const dismiss = async (key: string | number) => {
    const k = String(key);
    setGone((g) => new Set(g).add(k));
    const r = await postJson("/api/passport/dismiss", { what, key });
    if (!r.ok) {
      setGone((g) => { const n = new Set(g); n.delete(k); return n; });
      shell?.toast(r.data.error || "Couldn't do that. Please try again.");
    }
  };
  return { gone, dismiss };
}
function DismissButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Dismiss ${label}`} title="Dismiss"
      className="w-11 h-11 -mr-2 -mt-1 shrink-0 rounded-full flex items-center justify-center pp-focus pp-press" style={{ color: C.faint }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

/** The Welcome Aperitif (file 07): what it is, as the bar wrote it. */
export function WelcomeAperitif({ aperitif }: { aperitif?: Aperitif | null }) {
  if (!aperitif?.name) return null;
  return (
    <section aria-labelledby="pp-aperitif" className="mt-6 rounded-xl border p-5" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
      <Band section="bar" id="pp-aperitif" className="mb-3">Welcome Aperitif</Band>
      <p className="font-display text-[1.5rem] leading-tight mt-1.5" style={{ color: C.text }}>{aperitif.name}</p>
      {aperitif.description && <p className="font-body text-sm mt-1.5 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{aperitif.description}</p>}
    </section>
  );
}

/**
 * File 12: "Tonight", the Welcome Aperitif and the Spirit of the Day as one compact pair (side by side, one line each),
 * so the top of Home stays short. Either one alone takes the whole width; neither: nothing.
 */
export function Tonight({ aperitif, spirit }: { aperitif?: Aperitif | null; spirit?: Spirit | null }) {
  const ap = aperitif?.name ? aperitif : null;
  if (!ap && !spirit) return null;
  const off = spirit ? discountLine(spirit.discount_pct) : null;
  const box = "rounded-xl border p-4 h-full pp-card pp-accent-card";
  return (
    <section aria-labelledby="pp-tonight" className="mt-8">
      <Band section="bar" id="pp-tonight" className="mb-3">Tonight</Band>
      <div className={`grid gap-3 ${ap && spirit ? "grid-cols-2" : "grid-cols-1"}`}>
        {ap && (
          <div className={box} style={accentCardStyle("bar")}>
            <h3><KindLabel section="bar">Welcome Aperitif</KindLabel></h3>
            <p className="font-display text-[1.1875rem] leading-tight mt-1.5" style={{ color: C.text }}>{ap.name}</p>
            {ap.description && <p className="font-body text-[0.875rem] mt-1 leading-snug line-clamp-3" style={{ color: C.muted }}>{ap.description}</p>}
          </div>
        )}
        {spirit && (
          <PressLink item={{ kind: "bottle", id: spirit.id, name: spirit.name }} href={`/passport/spirits/${spirit.id}`} className={`block ${box} pp-row pp-focus`} style={accentCardStyle("spirits")}>
            <KindLabel section="spirits">Spirit of the Day</KindLabel>
            <span className="block font-display text-[1.1875rem] leading-tight mt-1.5" style={{ color: C.text }}>{spirit.name}</span>
            {off && <span className="block font-body text-[0.875rem] mt-1 leading-snug" style={{ color: ACCENTS.spirits.ink }}>{off}</span>}
          </PressLink>
        )}
      </div>
    </section>
  );
}

/** "From the bar" (file 07): short messages, newest first (three at most), each dismissible. Links stay inside Passport. */
export function FromTheBar({ messages }: { messages?: BarMessage[] | null }) {
  const { gone, dismiss } = useDismiss("message");
  const shown = (messages || []).filter((m) => !gone.has(String(m.id)));
  if (!messages?.length) return null;
  if (!shown.length) return null;
  return (
    <section aria-labelledby="pp-from-bar" className="mt-8">
      <Band section="bar" id="pp-from-bar" className="mb-3">From the bar</Band>
      <ul className="space-y-3">
        {shown.map((m) => {
          const href = messageHref(m);
          return (
            <li key={m.id} className="flex items-start gap-2 rounded-xl border pl-4 pr-2 py-3 pp-card pp-accent-card" style={accentCardStyle("bar")}>
              <div className="flex-1 min-w-0">
                <KindLabel section="bar">From the bar</KindLabel>
                <p className="pp-t-card mt-1" style={{ color: C.text }}>{m.title}</p>
                {m.body && <p className="font-body text-[1rem] leading-relaxed whitespace-pre-line mt-0.5" style={{ color: C.muted }}>{m.body}</p>}
                {href && m.link_label && <Link href={href} scroll={false} className="inline-block mt-1 min-h-[44px] py-2.5 font-body text-sm underline underline-offset-4 pp-focus" style={{ color: C.brass }}>{m.link_label}</Link>}
                {/* File 10: when the bar switched comments on for this message, its own page holds them. */}
                {m.comments && <Link href={`/passport/from-the-bar/${m.id}`} scroll={false} className={`inline-block mt-1 ${href && m.link_label ? "ml-4" : ""} min-h-[44px] py-2.5 font-body text-sm underline underline-offset-4 pp-focus`} style={{ color: C.muted }}>Comments</Link>}
              </div>
              <DismissButton label={m.title} onClick={() => dismiss(m.id)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "What's new" (file 07): short tappable cards, newest first (five at most), each dismissible, gone after 14 days. */
export function WhatsNew({ cards }: { cards?: FeedCard[] | null }) {
  const { gone, dismiss } = useDismiss("feed");
  const shown = (cards || []).filter((c) => !gone.has(c.key));
  if (!cards?.length) return null;
  if (!shown.length) return null;
  return (
    <section aria-labelledby="pp-whats-new" className="mt-10">
      <Band section="bar" id="pp-whats-new" className="mb-3">What&rsquo;s new</Band>
      <ul className="-mx-5 px-5 flex gap-3 overflow-x-auto pb-2 snap-x">
        {shown.map((c) => (
          <li key={c.key} className="snap-start shrink-0 w-[70%] max-w-[260px] relative">
            <Link href={feedHref(c)} scroll={false} className="block h-full rounded-xl border p-4 pr-10 pp-focus pp-row pp-card pp-accent-card" style={accentCardStyle(feedSection(c))}>
              <KindLabel section={feedSection(c)}>{feedKicker(c.kind)}</KindLabel>
              <span className="block font-display text-[1.3125rem] leading-tight mt-1.5" style={{ color: C.text }}>{c.title}</span>
            </Link>
            <span className="absolute top-1 right-2"><DismissButton label={c.title} onClick={() => dismiss(c.key)} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Spirit of the Day" (file 07): the bottle (opening its page) and the members' discount, applied at the bar. */
export function SpiritOfTheDay({ spirit }: { spirit?: Spirit | null }) {
  if (!spirit) return null;
  const off = discountLine(spirit.discount_pct);
  return (
    <section aria-labelledby="pp-sotd" className="mt-10">
      <Band section="spirits" id="pp-sotd" className="mb-3">Spirit of the Day</Band>
      <PressLink item={{ kind: "bottle", id: spirit.id, name: spirit.name }} href={`/passport/spirits/${spirit.id}`}
        className="block rounded-xl border p-5 pp-row pp-focus pp-card pp-accent-card" style={accentCardStyle("spirits")}>
        <span className="block font-display text-[1.625rem] leading-tight" style={{ color: C.text }}>{spirit.name}</span>
        {spirit.category && <span className={`block mt-1 ${kicker}`} style={{ color: C.faint }}>{spirit.category}</span>}
        {off && <span className="block font-body text-[1rem] mt-3" style={{ color: C.brass }}>{off}</span>}
      </PressLink>
    </section>
  );
}

/** Home: the newest live house list, as a card. */
export function NewestList({ list }: { list?: HouseList | null }) {
  if (!list) return null;
  return (
    <section aria-labelledby="pp-newest-list" className="mt-10">
      <Band section="bar" id="pp-newest-list" className="mb-3">CG Picks</Band>
      <ListCard l={list} big />
    </section>
  );
}

function ListCard({ l, big = false }: { l: HouseList; big?: boolean }) {
  const flight = flightLine(l.price);
  return (
    <Link href={houseHref(l.id)} scroll={false} className="flex items-stretch gap-3 rounded-xl border pl-4 overflow-hidden pp-focus pp-row pp-card pp-accent-card" style={accentCardStyle("bar")}>
      <span className="flex-1 min-w-0 py-4">
      <KindLabel section="bar">{listKicker(l)}</KindLabel>
      <span className={`block font-display leading-tight mt-1.5 ${big ? "text-[1.5rem]" : "text-[1.3125rem]"}`} style={{ color: C.text }}>{l.title}</span>
      {big && l.intro && <span className="block font-body text-sm mt-1 leading-relaxed line-clamp-2" style={{ color: C.muted }}>{l.intro}</span>}
      <span className="block font-body text-[0.75rem] tracking-[0.12em] uppercase mt-2" style={{ color: C.faint }}>
        {l.count} {l.kind === "cocktail" ? "cocktail" : "bottle"}{l.count === 1 ? "" : "s"}{flight ? ` · ${flight}` : ""}
      </span>
      </span>
      {/* File 15, Part C: the list's own items as a collage. */}
      <span className="block w-[96px] shrink-0"><Collage covers={houseListCovers(l)} section="bar" label={l.title} /></span>
    </Link>
  );
}

/** The Index's "CG Picks" (file 07; file 15 renamed "From Common Good"): live house lists (staff picks marked), the charts, and the way to past lists. */
export function HouseLists({ lists, charts, pastCount = 0, votes, pastVotes = 0 }: { lists?: HouseList[] | null; charts?: Chart[] | null; pastCount?: number; votes?: VoteCard[] | null; pastVotes?: number }) {
  if (!lists?.length && !charts?.length && !pastCount && !votes?.length && !pastVotes) return null;
  return (
    <section id="from-common-good" aria-labelledby="pp-house-lists">
      <div className="flex items-baseline justify-between mt-10 mb-3">
        <Band section="bar" id="pp-house-lists" className="mb-3">CG Picks</Band>
      </div>
      {!!charts?.length && (
        <ul className="grid grid-cols-2 gap-3 mb-3">
          {charts.map((c) => (
            <li key={c.key}>
              <Link href={chartHref(c.key)} scroll={false} className="block h-full rounded-xl border p-4 pp-focus pp-row pp-card pp-accent-card" style={accentCardStyle("bar")}>
                <KindLabel section="bar">{c.season_name}</KindLabel>
                <span className="block font-display text-[1.3125rem] leading-tight mt-1.5" style={{ color: C.text }}>{c.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!!lists?.length && <ul className="space-y-3">{lists.map((l) => <li key={l.id}><ListCard l={l} /></li>)}</ul>}
      {pastCount > 0 && (
        <Link href={PAST_HREF} scroll={false} className="mt-2 inline-flex items-center min-h-[44px] font-body text-sm underline underline-offset-4 pp-focus" style={{ color: C.text }}>
          Past lists
        </Link>
      )}
      {/* File 10: open votes and brackets, then "Past votes". */}
      {!!votes?.length && <ul className="space-y-3 mt-3">{votes.map((c) => <li key={`${c.kind}${c.id}`}><VoteCardLink c={c} /></li>)}</ul>}
      {pastVotes > 0 && (
        <Link href={PAST_VOTES_HREF} scroll={false} className="mt-2 flex items-center min-h-[44px] font-body text-sm underline underline-offset-4 pp-focus" style={{ color: C.text }}>
          Past votes
        </Link>
      )}
    </section>
  );
}

/**
 * File 09 fills the two places file 06 kept on Home: "Shared with you" and the two round buttons ("I'm at Common Good"
 * and "Let's go"). They live with the rest of friends and sharing (../Social.tsx); each still draws nothing until it has
 * something to show.
 */
export { HereButtons, SharedWithYou } from "../Social";
