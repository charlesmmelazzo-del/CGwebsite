"use client";

import { C } from "../theme";
import { ScreenSkeleton } from "../bits";
import { PageTitle, Quiet, SectionTitle } from "../Library";
import TabView from "./TabView";
import { dayLong, partyOf, reservationWord } from "@/lib/passport/shell";
import type { Reservation } from "@/lib/passport/types";

/** What the Events view sends (api/passport/view/events). book: the public reservation page is open. */
export interface EventsView { reservations: Reservation[]; book: boolean }

/**
 * File 06: the Events tab. The member's own upcoming reservations (found through the Guest Book by their confirmed
 * email) and "Book a table", which opens the bar's public reservation page. Passport events come in a later file.
 */
export default function EventsTab() {
  return (
    <TabView<EventsView> name="events" skeleton={<ScreenSkeleton rows={2} />}>
      {(d) => (
        <>
          <PageTitle kicker="Your table" title="Events" />
          {d.book && (
            <a href="/reserve" className="flex items-center justify-center gap-2 rounded-full min-h-[50px] px-6 font-body text-[13px] tracking-[0.22em] uppercase pp-focus pp-press"
              style={{ background: C.brass, color: C.bg }}>
              Book a table <span aria-hidden>→</span>
            </a>
          )}
          {d.reservations.length > 0 && (
            <section>
              <SectionTitle>Upcoming reservations</SectionTitle>
              <ul className="space-y-3">
                {d.reservations.map((r, i) => (
                  <li key={`${r.date}-${r.time}-${i}`} className="rounded-xl border p-4" style={{ borderColor: C.line, background: C.card }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-[22px] leading-tight" style={{ color: C.text }}>{dayLong(r.date)}</p>
                        <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{r.time} · {partyOf(r.party_size)}</p>
                      </div>
                      <span className="font-body text-[10px] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border whitespace-nowrap"
                        style={{ color: r.status === "requested" ? C.muted : C.brass, borderColor: r.status === "requested" ? C.line : `${C.brass}80` }}>{reservationWord(r.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="font-body text-xs mt-3 leading-relaxed" style={{ color: C.faint }}>To change or cancel, use the link in your confirmation email, or call the bar.</p>
            </section>
          )}
          {!d.reservations.length && !d.book && <div className="mt-2"><Quiet>Your upcoming reservations show here.</Quiet></div>}
        </>
      )}
    </TabView>
  );
}
