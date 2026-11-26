"use client";

import Link from "next/link";
import { C } from "../theme";
import { ScreenSkeleton } from "../bits";
import { PageTitle, Quiet, SectionTitle } from "../Library";
import { EventCard } from "../Events";
import { PublicEventCard } from "../PublicEvents";
import TabView from "./TabView";
import { useState } from "react";
import { ACCENTS } from "@/lib/passport/accents";
import { EVENTS_TABS, eventRows, type EventsTabId, type PublicEvent } from "@/lib/passport/publicEvents";
import { dayLong, partyOf, reservationWord } from "@/lib/passport/shell";
import type { PassportEvent, Reservation } from "@/lib/passport/types";

/** What the Events view sends (api/passport/view/events). book: the public reservation page is open. */
export interface EventsView { events?: PassportEvent[] | null; reservations: Reservation[]; book: boolean; public_events?: PublicEvent[] }
// The chosen tab is remembered while the app is open.
let rememberedTab: EventsTabId = "all";

/**
 * The Events tab (file 06, file 09): upcoming Passport events first (members only; the member's own answer and friends
 * going), then the member's own upcoming reservations (found through the Guest Book by their confirmed email), then
 * "Book a table" (the public reservation page) and "Plan an event" (file 08's inquiry form, in the Inbox).
 */
export default function EventsTab() {
  return (
    <TabView<EventsView> name="events" skeleton={<ScreenSkeleton rows={2} cards={2} />}>
      {(d) => <EventsBody d={d} />}
    </TabView>
  );
}

/**
 * File 15, Part G: two tabs at the top in file 14's tab style: "All events" (the default: the public website's events
 * and the Passport events in one list by date, soonest first, Passport ones with a small "Members only" chip) and
 * "Passport exclusives" (Passport events only). The member's own reservations, "Book a table" and "Plan an event" stay below.
 */
function EventsBody({ d }: { d: EventsView }) {
  const [tab, setTab] = useState<EventsTabId>(rememberedTab);
  const events = d.events || [];
  const rows = eventRows(events, d.public_events, tab);
  const choose = (t: EventsTabId) => { rememberedTab = t; setTab(t); };
  return (
          <>
            <PageTitle kicker="What's on" title="Events" />
            <div className="sticky z-20 -mx-5 border-b" style={{ top: "var(--pp-top)", background: "rgba(19,23,15,0.97)", borderColor: C.line }}>
              <div role="tablist" aria-label="Which events" className="pp-tabs flex gap-1 overflow-x-auto px-5">
                {EVENTS_TABS.map((t) => {
                  const on = t.id === tab;
                  return (
                    <button key={t.id} type="button" role="tab" id={`events-tab-${t.id}`} aria-selected={on} aria-controls="events-panel" onClick={() => choose(t.id)}
                      className="shrink-0 px-3.5 min-h-[48px] pp-t-body whitespace-nowrap pp-focus relative" style={{ color: on ? C.text : C.muted, fontWeight: on ? 500 : 400 }}>
                      {t.label}
                      <span aria-hidden className="absolute left-3 right-3 bottom-0 h-[3px] rounded-full" style={{ background: on ? ACCENTS.events.edge : "transparent" }} />
                    </button>
                  );
                })}
              </div>
            </div>
            <section id="events-panel" role="tabpanel" aria-labelledby={`events-tab-${tab}`} className="mt-5">
              {rows.length > 0
                ? <ul className="space-y-3">{rows.map((r) => (r.passport ? <EventCard key={r.key} e={r.passport} membersOnly={tab === "all"} /> : r.pub ? <PublicEventCard key={r.key} e={r.pub} /> : null))}</ul>
                : <Quiet>{tab === "all" ? "Nothing on the calendar right now." : "No Passport events right now. Members-only nights show here when they are announced."}</Quiet>}
            </section>
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
}
