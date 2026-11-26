"use client";

import { Band } from "./Library";
import Link from "next/link";
import { useEffect, useState } from "react";
import { C, Notice, postJson } from "./ui";
import { BackLink } from "./bits";
import { notifyChanged } from "./appEvents";
import { useShell } from "./shellContext";
import { ShareButton } from "./Social";
import { dayLong } from "@/lib/passport/shell";
import { friendsGoingLine, ticketHref } from "@/lib/passport/social";
import type { PassportEvent } from "@/lib/passport/types";

/**
 * File 09: Passport events, members only. On the Events tab, upcoming events come first (then the member's own
 * reservations, "Book a table" and "Plan an event"); each opens a page where the member answers Going (with guests up
 * to the event's limit) or Can't make it. When it is full they join the waitlist, and are told their place is not
 * guaranteed; a place that opens is offered to the first in line and held for 24 hours. Nothing is paid in the app.
 */

const smallBtn = "rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] tracking-[0.12em] uppercase transition-colors disabled:opacity-50 pp-focus pp-press";
const time = (e: PassportEvent) => `${e.start}${e.end ? ` to ${e.end}` : ""}`;

function StatusTag({ e }: { e: PassportEvent }) {
  const r = e.my_rsvp;
  const words = e.status === "cancelled" ? "Cancelled" : r?.status === "going" ? "You're going" : r?.status === "offered" ? "A place is held for you" : r?.status === "waitlist" ? "On the waitlist" : e.status === "full" ? "Full" : null;
  if (!words) return null;
  const brass = r?.status === "going" || r?.status === "offered";
  return (
    <span className="font-body text-[0.75rem] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border whitespace-nowrap"
      style={{ color: e.status === "cancelled" ? C.accent : brass ? C.brass : C.muted, borderColor: e.status === "cancelled" ? `${C.accent}80` : brass ? `${C.brass}80` : C.line }}>{words}</span>
  );
}

/** An event in the Events tab. */
export function EventCard({ e, membersOnly = false }: { e: PassportEvent; membersOnly?: boolean }) {
  const friends = friendsGoingLine(e.friends_going);
  return (
    <li>
      <Link href={`/passport/events/${e.id}`} scroll={false} className="block rounded-xl border p-4 pp-focus pp-row" style={{ borderColor: e.status === "cancelled" ? C.line : `${C.brass}66`, background: e.status === "cancelled" ? C.card : "#1a1f14" }}>
        {/* File 12: the day leads (every card here is a members-only Passport event, so it no longer says so on each). */}
        <span className="flex items-start justify-between gap-3">
          <span className="font-body text-[0.75rem] tracking-[0.25em] uppercase" style={{ color: C.brass }}>{dayLong(e.date)}</span>
          <span className="flex items-center gap-1.5">
            {/* File 15, Part G: in "All events", a Passport event says it is members only. */}
            {membersOnly && <span className="font-body text-[0.75rem] tracking-[0.14em] uppercase rounded-full px-2 py-0.5 border whitespace-nowrap" style={{ color: C.brass, borderColor: `${C.brass}80` }}>Members only</span>}
            <StatusTag e={e} />
          </span>
        </span>
        <span className="block font-display text-[1.4375rem] leading-tight mt-1.5" style={{ color: C.text }}>{e.title}</span>
        <span className="block font-body text-sm mt-1" style={{ color: C.muted }}>{time(e)}{e.price_text ? ` · ${e.price_text}` : ""}</span>
        {friends && <span className="block font-body text-[0.875rem] mt-1.5" style={{ color: C.text }}>{friends}</span>}
      </Link>
    </li>
  );
}

/** One event: what it is, the member's answer, friends going, outside tickets, invite friends. */
export function EventPage({ initial }: { initial: PassportEvent }) {
  const shell = useShell();
  const [e, setE] = useState(initial);
  const [guests, setGuests] = useState(initial.my_rsvp?.status === "going" || initial.my_rsvp?.status === "offered" || initial.my_rsvp?.status === "waitlist" ? initial.my_rsvp.guests : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [said, setSaid] = useState("");
  useEffect(() => { notifyChanged("inbox"); }, []);
  const answer = async (a: "going" | "cant") => {
    setBusy(true); setError(""); setSaid("");
    const r = await postJson<{ event: PassportEvent }>(`/api/passport/events/${e.id}`, { answer: a, guests: a === "going" ? guests : 0 });
    setBusy(false);
    if (!r.ok) { setError(r.data.error || "Couldn't save that. Please try again."); return; }
    setE(r.data.event);
    const x = r.data.event.answered;
    const msg = x === "going" ? "You're going. See you there." : x === "waitlist" ? "" : "Thanks for letting us know.";
    setSaid(msg);
    shell?.toast(x === "going" ? "You're going." : x === "waitlist" ? "You're on the waitlist." : "Saved.");
    notifyChanged("inbox");
  };
  const r = e.my_rsvp;
  const open = e.status !== "cancelled" && e.status !== "past";
  const tickets = ticketHref(e.ticket_url);
  const friends = friendsGoingLine(e.friends_going);
  return (
    <div className="pb-16">
      <BackLink fallback="/passport/events" label="Events" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Passport event · members only</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>{e.title}</h1>
      <div className="mt-3"><StatusTag e={e} /></div>
      <dl className="mt-5 rounded-xl border divide-y" style={{ borderColor: C.line, background: C.card }}>
        {([["When", `${dayLong(e.date)} · ${time(e)}`], ["Price", e.price_text || null], ["Guests", e.rsvp ? (e.guest_limit ? `Bring up to ${e.guest_limit}` : "Members only") : null]] as [string, string | null][])
          .filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5" style={{ borderColor: C.line }}>
              <dt className="font-body text-[0.75rem] tracking-[0.18em] uppercase shrink-0" style={{ color: C.faint }}>{k}</dt>
              <dd className="font-body text-[1rem] text-right" style={{ color: C.text }}>{v}</dd>
            </div>
          ))}
      </dl>
      {e.description && <p className="font-body text-[1rem] mt-5 whitespace-pre-wrap leading-relaxed" style={{ color: C.text }}>{e.description}</p>}
      {e.status === "cancelled" && (
        <div className="mt-5 border-l-2 pl-3" style={{ borderColor: C.accent }}>
          <p className="font-body text-[1rem]" style={{ color: C.text }}>This event is cancelled.</p>
          {e.cancel_note && <p className="font-body text-sm mt-1" style={{ color: C.muted }}>{e.cancel_note}<span className="block text-[0.75rem] mt-1" style={{ color: C.faint }}>From the bar</span></p>}
        </div>
      )}
      {friends && open && <p className="font-body text-[1rem] mt-5" style={{ color: C.text }}>{friends}</p>}
      {tickets && open && (
        <a href={tickets} target="_blank" rel="noopener noreferrer" className={`${smallBtn} mt-6 inline-flex items-center gap-2`} style={{ borderColor: C.brass, color: C.brass }}>
          Get tickets <span aria-hidden>↗</span>
        </a>
      )}
      {e.rsvp && open && (
        <section aria-labelledby="pp-rsvp" className="mt-8 rounded-xl border p-5" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
          <Band section="events" id="pp-rsvp" className="mb-3">Your answer</Band>
          {r?.status === "offered" && r.offer_expires_at && <p className="font-body text-[1rem] mt-2" style={{ color: C.text }}>A place opened up, and we&rsquo;re holding it for you until {new Date(r.offer_expires_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}. Tap Going to take it.</p>}
          {r?.status === "waitlist" && <p className="font-body text-sm mt-2" style={{ color: C.muted }}>You&rsquo;re on the waitlist. Your place isn&rsquo;t guaranteed; if one opens, we&rsquo;ll hold it for you for 24 hours and email you.</p>}
          {r?.status === "missed" && <p className="font-body text-sm mt-2" style={{ color: C.muted }}>The place we held for you has passed to the next person. You can join the waitlist again.</p>}
          {e.guest_limit > 0 && (
            <label className="flex items-center justify-between gap-3 mt-4 font-body text-[1rem]" style={{ color: C.text }}>
              Guests coming with you
              <select value={guests} onChange={(x) => setGuests(Number(x.target.value))} className="rounded-lg px-3 py-2 bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] text-[1rem]">
                {Array.from({ length: e.guest_limit + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? "Just me" : `${i} guest${i === 1 ? "" : "s"}`}</option>)}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <button type="button" disabled={busy || (r?.status === "waitlist" && guests === r.guests)} onClick={() => answer("going")} className={smallBtn} aria-pressed={r?.status === "going" || r?.status === "waitlist"}
              style={{ borderColor: C.brass, background: r?.status === "going" ? C.brass : "transparent", color: r?.status === "going" ? C.bg : C.brass }}>
              {r?.status === "going" || r?.status === "waitlist"
                ? (guests !== r.guests ? "Update guests" : r.status === "going" ? "Going" : "On the waitlist")
                : e.status === "full" && r?.status !== "offered" ? "Join the waitlist" : "Going"}
            </button>
            <button type="button" disabled={busy} onClick={() => answer("cant")} className={smallBtn} aria-pressed={r?.status === "cant"}
              style={{ borderColor: C.line, background: r?.status === "cant" ? C.line : "transparent", color: C.text }}>Can&rsquo;t make it</button>
          </div>
          {said && r?.status !== "waitlist" && <div className="mt-3"><Notice kind="ok">{said}</Notice></div>}
          {error && <div className="mt-3"><Notice>{error}</Notice></div>}
        </section>
      )}
      {open && <div className="mt-6"><ShareButton kind="event" id={e.id} name={e.title} /></div>}
      <p className="font-body text-[0.875rem] mt-8 leading-relaxed" style={{ color: C.faint }}>Nothing is paid or held in the app. Questions? <Link href="/passport/inbox/new?kind=message" scroll={false} className="underline" style={{ color: C.text }}>Message the bar</Link></p>
    </div>
  );
}
