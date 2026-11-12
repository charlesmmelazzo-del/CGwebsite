"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { CalendarDay, SlotStart, SpaceSlots } from "@/lib/reserve/types";
import { dayOfMonth, lengthLabel, monthShort, telHref, time12, weekdayIndex, dateLong } from "@/lib/reserve/format";
import { api, ApiError, Choice, ErrorNote, Loading, Modal, SkeletonRow } from "./ui";

export interface Selection {
  date: string;
  space: SpaceSlots;
  start: SlotStart;
  minutes: number;
}

const spaceKey = (s: { room_id: number; table_id: number | null }) => `${s.room_id}:${s.table_id ?? ""}`;
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const PRIVATE_EVENT_HREF = "/events?tab=host#inquiry";

/**
 * Date → where → start time → length, driven entirely by what the Bible returns.
 * Used by the Reserve page (new bookings) and the guest page (time changes).
 */
export default function SlotPicker({
  party,
  mode,
  calendarUrl,
  slotsUrl,
  onChange,
  refreshKey = 0,
  phone,
  belowCalendar,
  stepNumbers = [2, 3],
}: {
  party: number;
  mode: "new" | "change";
  calendarUrl: string;
  slotsUrl: (date: string) => string;
  onChange: (s: Selection | null) => void;
  /** Bump to re-fetch the open day's slots (e.g. after a slot was taken). */
  refreshKey?: number;
  phone: string;
  belowCalendar?: ReactNode;
  stepNumbers?: [number, number];
}) {
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [calError, setCalError] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SpaceSlots[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [space, setSpace] = useState<string | null>(null);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [popup, setPopup] = useState<CalendarDay | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // ── Calendar (re-fetched when the party size changes) ──
  useEffect(() => {
    const ctrl = new AbortController();
    setCalError("");
    setDays(null);
    api<CalendarDay[]>(calendarUrl, { signal: ctrl.signal })
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setDays(list);
        // Drop the chosen date if it is no longer bookable for this party.
        setDate((cur) => {
          if (!cur) return cur;
          const hit = list.find((x) => x.date === cur);
          if (!hit) return null;
          if (mode === "new" && hit.status !== "open") return null;
          return cur;
        });
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setCalError(e instanceof ApiError ? e.message : "We couldn't load the calendar.");
        setDays([]);
      });
    return () => ctrl.abort();
  }, [calendarUrl, mode]);

  // ── Slots for the chosen date ──
  const slotsFor = date ? slotsUrl(date) : null;
  useEffect(() => {
    if (!slotsFor) {
      setSlots(null);
      return;
    }
    const ctrl = new AbortController();
    setSlotsLoading(true);
    setSlotsError("");
    api<SpaceSlots[]>(slotsFor, { signal: ctrl.signal })
      .then((d) => {
        const list = (Array.isArray(d) ? d : []).filter((s) => s.starts?.length);
        setSlots(list);
        // Keep earlier picks only while they are still offered.
        setSpace((cur) => {
          if (list.length === 1) return spaceKey(list[0]);
          return cur && list.some((s) => spaceKey(s) === cur) ? cur : null;
        });
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setSlots([]);
        setSlotsError(e instanceof ApiError ? e.message : "We couldn't load times for that day.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSlotsLoading(false);
      });
    return () => ctrl.abort();
  }, [slotsFor, refreshKey]);

  const chosenSpace = useMemo(() => slots?.find((s) => spaceKey(s) === space) ?? null, [slots, space]);
  const chosenStart = useMemo(() => chosenSpace?.starts.find((s) => s.start_min === startMin) ?? null, [chosenSpace, startMin]);

  // Clear dependent picks that no longer exist.
  useEffect(() => {
    if (startMin !== null && !chosenStart && !slotsLoading) setStartMin(null);
  }, [chosenStart, startMin, slotsLoading]);
  useEffect(() => {
    if (minutes !== null && chosenStart && !chosenStart.lengths.includes(minutes)) setMinutes(null);
    if (minutes !== null && !chosenStart && !slotsLoading) setMinutes(null);
  }, [chosenStart, minutes, slotsLoading]);

  // Report the full selection (or null) upward.
  useEffect(() => {
    if (date && chosenSpace && chosenStart && minutes !== null && chosenStart.lengths.includes(minutes)) {
      onChangeRef.current({ date, space: chosenSpace, start: chosenStart, minutes });
    } else {
      onChangeRef.current(null);
    }
  }, [date, chosenSpace, chosenStart, minutes]);

  function pickDay(d: CalendarDay) {
    if (mode === "new" && d.status !== "open") {
      setPopup(d);
      return;
    }
    if (d.date !== date) {
      setDate(d.date);
      setStartMin(null);
      setMinutes(null);
    }
  }

  // Lay the window out as week rows, padded to start on Sunday.
  const cells = useMemo(() => {
    if (!days?.length) return [] as (CalendarDay | null)[];
    const lead = weekdayIndex(days[0].date);
    const out: (CalendarDay | null)[] = [...Array(lead).fill(null), ...days];
    while (out.length % 7) out.push(null);
    return out;
  }, [days]);

  const [n1, n2] = stepNumbers;

  return (
    <>
      {/* ── Date ── */}
      <section className="rv-step" aria-labelledby="rv-date-h">
        <h2 id="rv-date-h" className="rv-label mb-3">
          {n1}. Date
        </h2>
        {days === null ? (
          <>
            <Loading label="Loading dates" />
            <div className="grid grid-cols-7 gap-1.5 max-w-md">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="rv-skel aspect-square" />
              ))}
            </div>
          </>
        ) : calError ? (
          <ErrorNote>{calError}</ErrorNote>
        ) : days.length === 0 ? (
          <p className="text-sm opacity-80">No dates are open for online booking right now.</p>
        ) : (
          <div className="max-w-md">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5" aria-hidden="true">
              {WEEK.map((w) => (
                <div key={w} className="text-center text-[10px] tracking-[0.15em] uppercase" style={{ color: "var(--rv-muted)" }}>
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Choose a date">
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} aria-hidden="true" />;
                const first = i === 0 || cells.findIndex((c) => c) === i || dayOfMonth(d.date) === 1;
                const selected = d.date === date;
                const statusText =
                  d.status === "open" ? "" : d.status === "event" ? `, ${d.event?.title ?? "event"}` : ", not available";
                return (
                  <button
                    key={d.date}
                    type="button"
                    className="rv-day"
                    data-status={mode === "change" ? "open" : d.status}
                    aria-pressed={selected}
                    aria-label={`${dateLong(d.date)}${mode === "new" ? statusText : ""}`}
                    onClick={() => pickDay(d)}
                  >
                    {first && <span className="text-[9px] tracking-[0.12em] uppercase opacity-80">{monthShort(d.date)}</span>}
                    <span className="rv-day-num tabular-nums">{dayOfMonth(d.date)}</span>
                    {mode === "new" && d.status === "event" && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--rv-accent)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {belowCalendar}
      </section>

      {/* ── Time and length ── */}
      {date && (
        <section className="rv-step mt-10" aria-labelledby="rv-time-h">
          <h2 id="rv-time-h" className="rv-label mb-1">
            {n2}. Time
          </h2>
          <p className="text-sm opacity-80 mb-4">{dateLong(date)}</p>

          {slotsLoading && !slots ? (
            <>
              <Loading label="Loading times" />
              <SkeletonRow count={6} />
            </>
          ) : slotsError ? (
            <ErrorNote>{slotsError}</ErrorNote>
          ) : !slots || slots.length === 0 ? (
            <p className="text-sm">
              Nothing is open for a party of {party} that day. Try another date, or{" "}
              <a className="rv-link" href={telHref(phone)}>
                call us
              </a>
              .
            </p>
          ) : (
            <div className={slotsLoading ? "opacity-60 transition-opacity" : ""}>
              {/* Where */}
              <div className="mb-6">
                <h3 className="text-sm mb-2">Where</h3>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const k = spaceKey(s);
                    return (
                      <Choice
                        key={k}
                        pressed={space === k}
                        lockedLabel={slots.length === 1 ? "The only space open for your party" : undefined}
                        onClick={() => {
                          if (space !== k) {
                            setSpace(k);
                            setStartMin(null);
                            setMinutes(null);
                          }
                        }}
                      >
                        {s.name} · {s.min_guests}–{s.max_guests}
                      </Choice>
                    );
                  })}
                </div>
              </div>

              {/* Start */}
              {chosenSpace && (
                <div className="mb-6 rv-step">
                  <h3 className="text-sm mb-2">Start time</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {chosenSpace.starts.map((st) => (
                      <Choice
                        key={st.start_min}
                        pressed={startMin === st.start_min}
                        onClick={() => {
                          setStartMin(st.start_min);
                          if (minutes !== null && !st.lengths.includes(minutes)) setMinutes(null);
                        }}
                      >
                        {time12(st.start_min)}
                      </Choice>
                    ))}
                  </div>
                </div>
              )}

              {/* Length */}
              {chosenStart && (
                <div className="rv-step">
                  <h3 className="text-sm mb-2">How long would you like to stay?</h3>
                  <div className="flex flex-wrap gap-2">
                    {chosenStart.lengths.map((len) => (
                      <Choice key={len} pressed={minutes === len} onClick={() => setMinutes(len)}>
                        {lengthLabel(len)}
                      </Choice>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Day pop-ups ── */}
      <Modal
        open={!!popup && popup.status === "unavailable"}
        onClose={() => setPopup(null)}
        size="sm"
        title="Reservations aren't available on this day."
      >
        <p className="mb-6 opacity-90">The space is still available to rent for a private event.</p>
        <Link href={PRIVATE_EVENT_HREF} className="rv-btn w-full">
          Ask about a private event
        </Link>
      </Modal>
      <Modal
        open={!!popup && popup.status === "event"}
        onClose={() => setPopup(null)}
        size="sm"
        title={<>We&apos;re hosting {popup?.event?.title ?? "an event"} this day.</>}
      >
        <Link
          href={popup?.event?.website_event_id ? `/events?event=${encodeURIComponent(popup.event.website_event_id)}` : "/events"}
          className="rv-btn w-full mt-2"
        >
          Reserve for this event
        </Link>
      </Modal>
    </>
  );
}
