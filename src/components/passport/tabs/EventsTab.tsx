"use client";

import Link from "next/link";
import { C } from "../theme";
import { ScreenSkeleton } from "../bits";
import { PageTitle, Quiet, SectionTitle } from "../Library";
import { EventCard } from "../Events";
import TabView from "./TabView";
import { dayLong, partyOf, reservationWord } from "@/lib/passport/shell";
import type { PassportEvent, Reservation } from "@/lib/passport/types";

/** What the Events view sends (api/passport/view/events). book: the public reservation page is open. */
export interface EventsView { events?: PassportEvent[] | null; reservations: Reservation[]; book: boolean }

/**
 * The Events tab (file 06, file 09): upcoming Passport events first (members only; the member's own answer and friends
 * going), then the member's own upcoming reservations (found through the Guest Book by their confirmed email), then
 * "Book a table" (the public reservation page) and "Plan an event" (file 08's inquiry form, in the Inbox).
 */
export default function EventsTab() {
  return (
    <TabView<EventsView> name="events" skeleton={<ScreenSkeleton rows={2} cards={2} />}>
      {(d) => {
        const events = d.events || [];
        return (
          <>
            <PageTitle kicker="Members only" title="Events" />
            {events.length > 0 && (
              <section>
                <SectionTitle section="events">Passport events</SectionTitle>
                <ul className="space-y-3">{events.map((e) => <EventCard key={e.id} e={e} />)}</ul>
              </section>
            )}
            {d.reservations.length > 0 && (
              <section>
                <SectionTitle section="events">Your reservations</SectionTitle>
                <ul className="space-y-3">
                  {d.reservations.map((r, i) => (
                    <li key={`${r.date}-${r.time}-${i}`} className="rounded-xl border p-4" style={{ borderColor: C.line, background: C.card }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-[1.375rem] leading-tight" style={{ color: C.text }}>{dayLong(r.date)}</p>
                          <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{r.time} · {partyOf(r.party_size)}</p>
                        </div>
                        <span className="font-body text-[0.75rem] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border whitespace-nowrap"
                          style={{ color: r.status === "requested" ? C.muted : C.brass, borderColor: r.status === "requested" ? C.line : `${C.brass}80` }}>{reservationWord(r.status)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="font-body text-[0.875rem] mt-3 leading-relaxed" style={{ color: C.faint }}>To change or cancel, use the link in your confirmation email, or call the bar.</p>
              </section>
            )}
            {!events.length && !d.reservations.length && <div className="mt-2"><Quiet>Passport events and your upcoming reservations show here.</Quiet></div>}
            <div className="mt-8 grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
              {d.book && (
                <a href="/reserve" className="flex items-center justify-center gap-2 rounded-full min-h-[50px] px-6 font-body text-[0.875rem] tracking-[0.22em] uppercase pp-focus pp-press"
                  style={{ background: C.brass, color: C.bg }}>
                  Book a table <span aria-hidden>→</span>
                </a>
              )}
              <Link href="/passport/inbox/new?kind=event" scroll={false} className="flex items-center justify-center gap-2 rounded-full min-h-[50px] px-6 font-body text-[0.875rem] tracking-[0.22em] uppercase border pp-focus pp-press"
                style={{ borderColor: C.line, color: C.text }}>
                Plan an event
              </Link>
            </div>
          </>
        );
      }}
    </TabView>
  );
}
