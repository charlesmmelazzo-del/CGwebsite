"use client";

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

/**
 * Places in the layout that file 06 kept and file 07 fills. Each draws NOTHING until it has something in it: never an
 * empty box or a placeholder line. They take their data as props from the tab's one call.
 */

const kicker = "font-body text-[10px] tracking-[0.25em] uppercase";
const heading = "font-body text-[11px] tracking-[0.3em] uppercase mb-3";

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
      <h2 id="pp-aperitif" className={kicker} style={{ color: C.brass }}>Welcome Aperitif</h2>
      <p className="font-display text-[24px] leading-tight mt-1.5" style={{ color: C.text }}>{aperitif.name}</p>
      {aperitif.description && <p className="font-body text-sm mt-1.5 leading-relaxed whitespace-pre-line" style={{ color: C.muted }}>{aperitif.description}</p>}
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
      <h2 id="pp-from-bar" className={heading} style={{ color: C.brass }}>From the bar</h2>
      <ul className="space-y-3">
        {shown.map((m) => {
          const href = messageHref(m);
          return (
            <li key={m.id} className="flex items-start gap-2 border-l-2 pl-4 py-1" style={{ borderColor: C.brass }}>
              <div className="flex-1 min-w-0">
                <p className="font-display text-[19px] leading-snug" style={{ color: C.text }}>{m.title}</p>
                {m.body && <p className="font-body text-[15px] leading-relaxed whitespace-pre-line mt-0.5" style={{ color: C.muted }}>{m.body}</p>}
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
      <h2 id="pp-whats-new" className={heading} style={{ color: C.brass }}>What&rsquo;s new</h2>
      <ul className="-mx-5 px-5 flex gap-3 overflow-x-auto pb-2 snap-x">
        {shown.map((c) => (
          <li key={c.key} className="snap-start shrink-0 w-[70%] max-w-[260px] relative">
            <Link href={feedHref(c)} scroll={false} className="block h-full rounded-xl border p-4 pr-10 pp-focus pp-row" style={{ borderColor: C.line, background: C.card }}>
              <span className={`block ${kicker}`} style={{ color: C.brass }}>{feedKicker(c.kind)}</span>
              <span className="block font-display text-[21px] leading-tight mt-1.5" style={{ color: C.text }}>{c.title}</span>
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
      <h2 id="pp-sotd" className={heading} style={{ color: C.brass }}>Spirit of the Day</h2>
      <PressLink item={{ kind: "bottle", id: spirit.id, name: spirit.name }} href={`/passport/spirits/${spirit.id}`}
        className="block rounded-xl border p-5 pp-row pp-focus" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
        <span className="block font-display text-[26px] leading-tight" style={{ color: C.text }}>{spirit.name}</span>
        {spirit.category && <span className={`block mt-1 ${kicker}`} style={{ color: C.faint }}>{spirit.category}</span>}
        {off && <span className="block font-body text-[15px] mt-3" style={{ color: C.brass }}>{off}</span>}
      </PressLink>
    </section>
  );
}

/** Home: the newest live house list, as a card. */
export function NewestList({ list }: { list?: HouseList | null }) {
  if (!list) return null;
  return (
    <section aria-labelledby="pp-newest-list" className="mt-10">
      <h2 id="pp-newest-list" className={heading} style={{ color: C.brass }}>From Common Good</h2>
      <ListCard l={list} big />
    </section>
  );
}

function ListCard({ l, big = false }: { l: HouseList; big?: boolean }) {
  const flight = flightLine(l.price);
  return (
    <Link href={houseHref(l.id)} scroll={false} className="block rounded-xl border p-4 pp-focus pp-row" style={{ borderColor: l.staff_pick ? `${C.brass}80` : C.line, background: C.card }}>
      <span className={`block ${kicker}`} style={{ color: l.staff_pick ? C.brass : C.faint }}>{listKicker(l)}</span>
      <span className={`block font-display leading-tight mt-1.5 ${big ? "text-[24px]" : "text-[21px]"}`} style={{ color: C.text }}>{l.title}</span>
      {big && l.intro && <span className="block font-body text-sm mt-1 leading-relaxed line-clamp-2" style={{ color: C.muted }}>{l.intro}</span>}
      <span className="block font-body text-[11px] tracking-[0.12em] uppercase mt-2" style={{ color: C.faint }}>
        {l.count} {l.kind === "cocktail" ? "cocktail" : "bottle"}{l.count === 1 ? "" : "s"}{flight ? ` · ${flight}` : ""}
      </span>
    </Link>
  );
}

/** The Index's "From Common Good" (file 07): live house lists (staff picks marked), the charts, and the way to past lists. */
export function HouseLists({ lists, charts, pastCount = 0, votes, pastVotes = 0 }: { lists?: HouseList[] | null; charts?: Chart[] | null; pastCount?: number; votes?: VoteCard[] | null; pastVotes?: number }) {
  if (!lists?.length && !charts?.length && !pastCount && !votes?.length && !pastVotes) return null;
  return (
    <section id="from-common-good" aria-labelledby="pp-house-lists">
      <div className="flex items-baseline justify-between mt-10 mb-3">
        <h2 id="pp-house-lists" className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>From Common Good</h2>
      </div>
      {!!charts?.length && (
        <ul className="grid grid-cols-2 gap-3 mb-3">
          {charts.map((c) => (
            <li key={c.key}>
              <Link href={chartHref(c.key)} scroll={false} className="block h-full rounded-xl border p-4 pp-focus pp-row" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
                <span className={`block ${kicker}`} style={{ color: C.brass }}>{c.season_name}</span>
                <span className="block font-display text-[21px] leading-tight mt-1.5" style={{ color: C.text }}>{c.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!!lists?.length && <ul className="space-y-3">{lists.map((l) => <li key={l.id}><ListCard l={l} /></li>)}</ul>}
      {pastCount > 0 && (
        <Link href={PAST_HREF} scroll={false} className="mt-2 inline-flex items-center min-h-[44px] font-body text-sm underline underline-offset-4 pp-focus" style={{ color: C.text }}>
          Past lists from Common Good
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
