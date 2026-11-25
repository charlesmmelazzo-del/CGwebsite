"use client";

import Link from "next/link";
import { C } from "../theme";

/**
 * File 06: places in the layout that later files fill. Each draws NOTHING until it has something in it: never an empty
 * box or a placeholder line. They take their data as props, so a later file only has to pass it in.
 */

/** "From the bar" (file 07): a short message the bar posts to members, with an optional link. */
export interface BarMessage { id: string | number; text: string; link?: { href: string; label: string } | null }
export function FromTheBar({ messages }: { messages?: BarMessage[] | null }) {
  if (!messages?.length) return null;
  return (
    <section aria-labelledby="pp-from-bar" className="mt-8">
      <h2 id="pp-from-bar" className="font-body text-[11px] tracking-[0.3em] uppercase mb-3" style={{ color: C.brass }}>From the bar</h2>
      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className="rounded-xl border-l-2 pl-4 py-1" style={{ borderColor: C.brass }}>
            <p className="font-body text-[15px] leading-relaxed whitespace-pre-line" style={{ color: C.text }}>{m.text}</p>
            {m.link && <Link href={m.link.href} scroll={false} className="inline-block mt-1.5 min-h-[44px] py-2.5 font-body text-sm underline underline-offset-4 pp-focus" style={{ color: C.brass }}>{m.link.label}</Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "What's new" (file 07): short tappable cards ("A new list", "Voting is open", "A winner was picked"). */
export interface NewsCard { id: string | number; kicker: string; title: string; href: string }
export function WhatsNew({ cards }: { cards?: NewsCard[] | null }) {
  if (!cards?.length) return null;
  return (
    <section aria-labelledby="pp-whats-new" className="mt-10">
      <h2 id="pp-whats-new" className="font-body text-[11px] tracking-[0.3em] uppercase mb-3" style={{ color: C.brass }}>What&rsquo;s new</h2>
      <ul className="-mx-5 px-5 flex gap-3 overflow-x-auto pb-2 snap-x">
        {cards.map((c) => (
          <li key={c.id} className="snap-start shrink-0 w-[70%] max-w-[260px]">
            <Link href={c.href} scroll={false} className="block h-full rounded-xl border p-4 pp-focus pp-row" style={{ borderColor: C.line, background: C.card }}>
              <span className="block font-body text-[10px] tracking-[0.25em] uppercase" style={{ color: C.brass }}>{c.kicker}</span>
              <span className="block font-display text-[21px] leading-tight mt-1.5" style={{ color: C.text }}>{c.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Spirit of the Day" (file 07). Its place in Home's order is kept; it draws nothing yet. */
export function SpiritOfTheDay() { return null; }
/** "Shared with you" (friends and sharing). Its place in Home's order is kept; it draws nothing yet. */
export function SharedWithYou() { return null; }
/** The two round buttons "I'm at Common Good" and "Let's go" (the meetups file). No dead buttons now. */
export function HereButtons() { return null; }
/** The Index's "From Common Good" house lists (file 07). */
export function HouseLists() { return null; }
