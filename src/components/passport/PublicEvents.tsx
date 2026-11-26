"use client";
/* eslint-disable @next/next/no-img-element -- the public site's own event pictures (public addresses anyone sees on /events). */

import Link from "next/link";
import { C } from "./theme";
import { BackLink } from "./bits";
import { ShareButton } from "./Social";
import { dayLong } from "@/lib/passport/shell";
import { publicBookHref, publicEventHref, type PublicEvent } from "@/lib/passport/publicEvents";
import { ACCENTS } from "@/lib/passport/accents";

/**
 * File 15, Part G: an event from the public website inside Passport. The card leads with its date, then the title, the
 * time when it has one, one line and its picture; the page shows the public description and picture and the same action
 * the public site offers (book a table for that night, or its own link), opening outside the app. No RSVP, waitlist,
 * guests or comments: those stay Passport-event features. "Invite friends" shares it.
 */
export function PublicEventCard({ e }: { e: PublicEvent }) {
  return (
    <li>
      <Link href={publicEventHref(e.id)} scroll={false} className="flex items-stretch gap-3 rounded-xl border pl-4 overflow-hidden pp-focus pp-row" style={{ borderColor: C.line, background: C.card }}>
        <span className="flex-1 min-w-0 py-4">
          <span className="block font-body text-[0.75rem] tracking-[0.25em] uppercase" style={{ color: ACCENTS.events.ink }}>{dayLong(e.date)}</span>
          <span className="block font-display text-[1.4375rem] leading-tight mt-1.5" style={{ color: C.text }}>{e.title}</span>
          {e.time && <span className="block font-body text-sm mt-1" style={{ color: C.muted }}>{e.time}</span>}
          {e.line && <span className="block font-body text-sm mt-1 line-clamp-1" style={{ color: C.muted }}>{e.line}</span>}
        </span>
        {e.image && (
          <span className="block w-[96px] shrink-0" style={{ background: ACCENTS.events.tint }}>
            <img src={e.image} alt={e.title} loading="lazy" decoding="async" width={96} height={120} className="w-full h-full object-cover" />
          </span>
        )}
      </Link>
    </li>
  );
}

export function PublicEventPage({ e }: { e: PublicEvent }) {
  const book = publicBookHref(e);
  const btn = "inline-flex items-center gap-2 rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] tracking-[0.12em] uppercase pp-focus pp-press";
  return (
    <div className="pb-16">
      <BackLink fallback="/passport/events" label="Events" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-2" style={{ color: ACCENTS.events.ink }}>At Common Good · open to everyone</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>{e.title}</h1>
      <p className="font-body text-[1rem] mt-3" style={{ color: C.text }}>{dayLong(e.date)}{e.end_date && e.end_date !== e.date ? ` to ${dayLong(e.end_date)}` : ""}{e.time ? ` · ${e.time}` : ""}</p>
      {e.location && <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{e.location}</p>}
      {e.image && (
        <figure className="mt-5 -mx-5 sm:mx-0 aspect-[4/3] overflow-hidden sm:rounded-lg" style={{ background: ACCENTS.events.tint }}>
          <img src={e.image} alt={e.title} loading="eager" decoding="async" className="w-full h-full object-cover" />
        </figure>
      )}
      {e.description && <p className="font-body text-[1rem] mt-5 whitespace-pre-wrap leading-relaxed" style={{ color: C.text }}>{e.description}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        {book && <a href={book} target="_blank" rel="noopener noreferrer" className={btn} style={{ borderColor: C.brass, color: C.brass }}>Book a table for this night <span aria-hidden>↗</span></a>}
        {!book && e.link_url && <a href={e.link_url} target="_blank" rel="noopener noreferrer" className={btn} style={{ borderColor: C.brass, color: C.brass }}>{e.link_label || "More info"} <span aria-hidden>↗</span></a>}
      </div>
      <div className="mt-6"><ShareButton kind="event" id={0} publicId={e.id} name={e.title} /></div>
      <p className="font-body text-[0.875rem] mt-8 leading-relaxed" style={{ color: C.faint }}>This is one of the bar&rsquo;s public events. Booking and tickets open on our website.</p>
    </div>
  );
}
