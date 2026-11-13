"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import type { GuestReservation, OpenReservation, ReserveFaq, SpaceSummary } from "@/lib/reserve/types";
import { dateLong, dateShort, lengthLabel, serviceName, telHref, time12, timeRange } from "@/lib/reserve/format";
import SlotPicker, { type Selection } from "@/components/reserve/SlotPicker";
import { api, ApiError, Choice, ErrorNote, FaqModal, GENERIC_ERROR, Modal, RvRoot, ServiceInfoButton, Stepper, type RvTheme } from "@/components/reserve/ui";

const POLL_MS = 20_000;
const LATE_OPTIONS = [5, 10, 15, 20, 30];

/** Today's date at the bar (Central time) as YYYY-MM-DD. */
function barToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Is it the day of this reservation (including a late night that runs past midnight)? */
function isDayOf(r: OpenReservation): boolean {
  if (r.date === barToday()) return true;
  return r.end_min > 1440 && r.date === barToday(-1);
}

export default function GuestPageClient({
  token,
  initial,
  problem,
  faq,
  phone,
  partyMax,
  theme,
}: {
  token: string;
  initial: GuestReservation | null;
  problem: string;
  faq: ReserveFaq[];
  phone: string;
  partyMax: number;
  theme: RvTheme;
}) {
  const [view, setView] = useState<GuestReservation | null>(initial);

  return (
    <RvRoot theme={theme} className="min-h-screen py-12 md:py-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {!view ? (
          <div className="text-center py-16" role="status">
            <p className="text-lg leading-relaxed">{problem || "We couldn't find that reservation. Check the link in your email, or call us."}</p>
            <p className="mt-4 text-sm">
              <a className="rv-link" href={telHref(phone)}>
                {phone}
              </a>
            </p>
          </div>
        ) : view.closed ? (
          <Closed firstName={view.first_name} status={view.status} />
        ) : (
          <OpenView token={token} view={view} setView={setView} faq={faq} phone={phone} partyMax={partyMax} />
        )}
      </div>
    </RvRoot>
  );
}

function Closed({ firstName, status }: { firstName: string; status: string }) {
  const line =
    status === "cancelled"
      ? "This reservation was cancelled."
      : status === "denied"
        ? "We weren't able to confirm this request."
        : "This reservation has passed.";
  return (
    <div className="text-center py-16 rv-step">
      <h1 className="rv-h2 text-3xl mb-4">Thanks{firstName ? `, ${firstName}` : ""}.</h1>
      <p className="opacity-90 mb-8">{line}</p>
      <Link href="/reserve" className="rv-btn">
        Make a new reservation
      </Link>
    </div>
  );
}

function OpenView({
  token,
  view,
  setView,
  faq,
  phone,
  partyMax,
}: {
  token: string;
  view: OpenReservation;
  setView: (v: GuestReservation) => void;
  faq: ReserveFaq[];
  phone: string;
  partyMax: number;
}) {
  const base = `/api/reserve/r/${token}`;
  const [faqOpen, setFaqOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  // ── Polling: every 20s while visible, and on focus ──
  const refresh = useCallback(async () => {
    try {
      setView(await api<GuestReservation>(base));
    } catch {
      /* keep showing what we have */
    }
  }, [base, setView]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else stop();
    };
    const onFocus = () => refresh();
    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  /** POST an action; the server answers with the fresh reservation view. */
  async function act(action: string, body?: Record<string, unknown>): Promise<boolean> {
    setBusy(action);
    setActionError("");
    try {
      setView(await api<GuestReservation>(`${base}/${action}`, { method: "POST", body: body ?? {} }));
      return true;
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : GENERIC_ERROR);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const dayOf = isDayOf(view);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="rv-step">
      <StatusBanner status={view.status} />
      {notice && (
        <p className="mt-3 p-3 text-sm" role="status" style={{ border: "1px solid var(--rv-ok)", background: "var(--rv-soft)" }}>
          {notice}.
        </p>
      )}

      {/* ── Details ── */}
      <section className="mt-6 mb-8" aria-label="Reservation details">
        <h1 className="rv-h2 text-[1.9rem] mb-4">
          {view.first_name ? `${view.first_name}'s reservation` : "Your reservation"}
        </h1>
        <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-[15px]">
          <dt className="rv-label self-center">Date</dt>
          <dd>{dateLong(view.date)}</dd>
          <dt className="rv-label self-center">Time</dt>
          <dd>{timeRange(view.start_min, view.end_min)}</dd>
          {view.service?.label?.trim() && (
            <>
              <dt className="rv-label self-center">Service</dt>
              <dd className="flex flex-wrap items-baseline gap-x-3">
                <span>{view.service.label}</span>
                <ServiceInfoButton heading={serviceName(view.service.label)} description={view.service.description} />
              </dd>
            </>
          )}
          <dt className="rv-label self-center">Length</dt>
          <dd>{lengthLabel(view.minutes)}</dd>
          <dt className="rv-label self-center">Party</dt>
          <dd>{view.party_size}</dd>
          <dt className="rv-label self-center">Where</dt>
          <dd>{view.space.name}</dd>
          {view.event && (
            <>
              <dt className="rv-label self-center">Event</dt>
              <dd>{view.event.title}</dd>
            </>
          )}
          {view.occasion_note && (
            <>
              <dt className="rv-label">Occasion</dt>
              <dd className="whitespace-pre-line">{view.occasion_note}</dd>
            </>
          )}
        </dl>
      </section>

      {/* ── Change request banner ── */}
      {view.change_request && (
        <div className="mb-6 p-4 text-sm leading-relaxed" style={{ border: "1px solid var(--rv-warn)", background: "var(--rv-soft)" }} role="status">
          <p>
            You asked to move to {dateShort(view.change_request.date)},{" "}
            {timeRange(view.change_request.start_min, view.change_request.start_min + view.change_request.minutes)}. Your current
            time is held until we reply.
          </p>
          <button type="button" className="rv-link mt-2" disabled={busy === "withdraw-change"} onClick={() => act("withdraw-change")}>
            {busy === "withdraw-change" ? "Withdrawing…" : "Withdraw request"}
          </button>
        </div>
      )}

      {/* ── Buttons ── */}
      <section className="space-y-6 mb-10" aria-label="Manage your reservation">
        <ConfirmButton view={view} busy={busy === "confirm"} onConfirm={() => act("confirm")} />

        <div className="flex flex-wrap gap-2">
          {dayOf && <LateButton onSend={(m) => act("late", { minutes: m })} busy={busy === "late"} />}
          <PartyButton view={view} base={base} partyMax={partyMax} setView={setView} />
          {!view.change_request && (
            <ChangeTimeButton view={view} base={base} phone={phone} setView={setView} onChanged={() => setNotice("Your time has been changed")} />
          )}
          <CancelButton onCancel={(reason) => act("cancel", { reason })} busy={busy === "cancel"} />
        </div>
        <ErrorNote>{actionError}</ErrorNote>
      </section>

      {/* ── Messages ── */}
      <Messages view={view} onSend={(body) => act("message", { body })} busy={busy === "message"} />

      {/* ── Notes ── */}
      <Notes initial={view.guest_notes} onSave={(notes) => act("notes", { notes })} busy={busy === "notes"} />

      {/* ── FAQ + footer ── */}
      {faq.length > 0 && (
        <div className="mt-10">
          <button type="button" className="rv-btn rv-btn-ghost" onClick={() => setFaqOpen(true)}>
            Frequently asked questions
          </button>
        </div>
      )}
      <p className="mt-10 text-sm opacity-80">
        Questions? Call us at{" "}
        <a className="rv-link" href={telHref(phone)}>
          {phone}
        </a>
        .
      </p>
      <FaqModal open={faqOpen} onClose={() => setFaqOpen(false)} faq={faq} />
    </div>
  );
}

function StatusBanner({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <div className="p-4" style={{ border: "2px solid var(--rv-ok)" }} role="status">
        <p className="font-medium tracking-wide flex items-center gap-2">
          <Check size={16} aria-hidden="true" /> Approved
        </p>
        <p className="text-sm mt-1 opacity-90">Please confirm on the day of your reservation.</p>
      </div>
    );
  }
  if (status === "guest_confirmed") {
    return (
      <div className="p-4 text-white" style={{ background: "#3F7F4E" }} role="status">
        <p className="font-medium tracking-wide flex items-center gap-2">
          <Check size={16} aria-hidden="true" /> Confirmed — see you soon
        </p>
      </div>
    );
  }
  return (
    <div className="p-4" style={{ background: "color-mix(in srgb, var(--rv-warn) 22%, transparent)", border: "1px solid var(--rv-warn)" }} role="status">
      <p className="font-medium tracking-wide flex items-center gap-2">
        <Clock size={16} aria-hidden="true" /> Request received — waiting for our staff to confirm
      </p>
    </div>
  );
}

function ConfirmButton({ view, busy, onConfirm }: { view: OpenReservation; busy: boolean; onConfirm: () => void }) {
  if (view.status === "guest_confirmed") {
    return (
      <button type="button" className="rv-btn w-full sm:w-auto" disabled style={{ background: "#3F7F4E", opacity: 1 }}>
        <Check size={16} aria-hidden="true" /> Confirmed
      </button>
    );
  }
  const live = view.can_confirm;
  return (
    <div>
      <button
        type="button"
        className="rv-btn w-full sm:w-auto min-w-[200px]"
        disabled={!live || busy}
        onClick={onConfirm}
        style={live ? { background: "#3F7F4E" } : { background: "color-mix(in srgb, var(--rv-text) 22%, transparent)", color: "var(--rv-text)", opacity: 0.7 }}
        aria-describedby={live ? undefined : "rv-confirm-note"}
      >
        {busy ? "Confirming…" : "Confirm"}
      </button>
      {!live && (
        <p id="rv-confirm-note" className="text-sm mt-2 opacity-75">
          Come back to confirm on the day of your reservation
        </p>
      )}
    </div>
  );
}

function LateButton({ onSend, busy }: { onSend: (m: number) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <>
      <button type="button" className="rv-btn rv-btn-ghost" onClick={() => { setSent(false); setOpen(true); }}>
        Running late
      </button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title="How late will you be?">
        {sent ? (
          <p role="status">We&apos;ve let the bar know.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {LATE_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                className="rv-choice"
                disabled={busy}
                onClick={async () => {
                  if (await onSend(m)) setSent(true);
                  else setOpen(false);
                }}
              >
                {m} min
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

function PartyButton({
  view,
  base,
  partyMax,
  setView,
}: {
  view: OpenReservation;
  base: string;
  partyMax: number;
  setView: (v: GuestReservation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(view.party_size);
  const [options, setOptions] = useState<SpaceSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Let guests try a bit past the biggest space so the Bible can say what fits.
  const max = Math.min(99, Math.max(partyMax, view.party_range.max) + 5);

  function show() {
    setSize(view.party_size);
    setOptions(null);
    setError("");
    setOpen(true);
  }

  async function save(moveTo?: SpaceSummary) {
    setBusy(true);
    setError("");
    try {
      const v = await api<GuestReservation>(`${base}/party`, {
        method: "POST",
        body: { party_size: size, ...(moveTo ? { move_to: { room_id: moveTo.room_id, table_id: moveTo.table_id } } : {}) },
      });
      setView(v);
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && Array.isArray(e.body.options)) {
        setOptions(e.body.options as SpaceSummary[]);
      } else {
        setError(e instanceof ApiError ? e.message : GENERIC_ERROR);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="rv-btn rv-btn-ghost" onClick={show}>
        Change party size
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} size="sm" title="Change party size">
        <div className="flex flex-col items-start gap-3">
          <Stepper
            value={size}
            min={1}
            max={max}
            onChange={(n) => {
              setSize(n);
              setOptions(null);
            }}
            label="Party size"
          />
          <p className="text-sm opacity-75">
            {view.space.name} fits {view.party_range.min}–{view.party_range.max}.
          </p>
        </div>

        {options && options.length > 0 && (
          <div className="mt-5 rv-step">
            <p className="mb-3 text-[15px]">
              A party of {size} doesn&apos;t fit the {view.space.name}. This is available at the same time:
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <Choice key={`${o.room_id}:${o.table_id ?? ""}`} pressed={false} disabled={busy} onClick={() => save(o)}>
                  {o.name} · {o.min_guests}–{o.max_guests}
                </Choice>
              ))}
            </div>
          </div>
        )}
        {options && options.length === 0 && (
          <p className="mt-5 text-[15px] rv-step">
            We don&apos;t have a space for that many at this time. Send us a message below and we&apos;ll see what we can do.
          </p>
        )}
        <ErrorNote>{error}</ErrorNote>
        {!options && (
          <button type="button" className="rv-btn w-full mt-6" disabled={busy || size === view.party_size} onClick={() => save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </Modal>
    </>
  );
}

function ChangeTimeButton({
  view,
  base,
  phone,
  setView,
  onChanged,
}: {
  view: OpenReservation;
  base: string;
  phone: string;
  setView: (v: GuestReservation) => void;
  /** Event bookings change at once (no staff step). */
  onChanged?: () => void;
}) {
  // Event reservations stay on the event's date and apply immediately.
  const isEvent = !!view.event_id;
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const onPick = useCallback((s: Selection | null) => setSel(s), []);

  const same =
    sel && sel.date === view.date && sel.start.start_min === view.start_min && sel.minutes === view.minutes;

  async function send() {
    if (!sel || same) return;
    setBusy(true);
    setError("");
    try {
      setView(
        await api<GuestReservation>(`${base}/change`, {
          method: "POST",
          body: { date: sel.date, start_time: sel.start.start_time, start_min: sel.start.start_min, minutes: sel.minutes },
        }),
      );
      setOpen(false);
      if (isEvent) onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : GENERIC_ERROR);
      if (e instanceof ApiError && e.status === 409) setRefresh((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rv-btn rv-btn-ghost"
        onClick={() => {
          setSel(null);
          setError("");
          setOpen(true);
        }}
      >
        {isEvent ? "Change time" : "Request a time change"}
      </button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        size="lg"
        title={isEvent ? "Change time" : "Request a time change"}
        footer={
          <div>
            {sel && (
              <p className="text-sm mb-3 opacity-90">
                {same
                  ? "That's your current time."
                  : `${dateShort(sel.date)}, ${timeRange(sel.start.start_min, sel.start.start_min + sel.minutes)}`}
              </p>
            )}
            <ErrorNote>{error}</ErrorNote>
            <button type="button" className="rv-btn w-full mt-2" disabled={!sel || !!same || busy} onClick={send}>
              {busy ? (isEvent ? "Saving…" : "Sending…") : isEvent ? "Change time" : "Send request"}
            </button>
          </div>
        }
      >
        <p className="text-sm opacity-80 mb-5">
          Currently {dateShort(view.date)}, {time12(view.start_min)} for {lengthLabel(view.minutes)}.
          {isEvent ? "" : " Your current time stays held until we reply."}
        </p>
        <SlotPicker
          party={view.party_size}
          mode="change"
          calendarUrl={isEvent ? undefined : `/api/reserve/calendar?party=${view.party_size}`}
          fixedDate={isEvent ? view.date : undefined}
          slotsUrl={(d) => `${base}/slots?date=${d}`}
          onChange={onPick}
          refreshKey={refresh}
          phone={phone}
          stepNumbers={isEvent ? [1, 1] : [1, 2]}
          spaceLabel={isEvent ? (sp) => `${sp.name} · seats ${sp.min_guests}–${sp.max_guests}` : undefined}
        />
      </Modal>
    </>
  );
}

function CancelButton({ onCancel, busy }: { onCancel: (reason: string) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <button type="button" className="rv-btn rv-btn-ghost" onClick={() => setOpen(true)}>
        Cancel reservation
      </button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        size="sm"
        title="Cancel this reservation?"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" className="rv-btn rv-btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              Keep it
            </button>
            <button
              type="button"
              className="rv-btn"
              style={{ background: "#B4533F" }}
              disabled={busy}
              onClick={async () => {
                if (await onCancel(reason.trim())) setOpen(false);
              }}
            >
              {busy ? "Cancelling…" : "Cancel reservation"}
            </button>
          </div>
        }
      >
        <label htmlFor="rv-cancel-reason" className="block text-sm mb-1.5">
          Reason <span className="opacity-60">(optional)</span>
        </label>
        <textarea
          id="rv-cancel-reason"
          className="rv-input min-h-[88px]"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Modal>
    </>
  );
}

function Messages({ view, onSend, busy }: { view: OpenReservation; onSend: (body: string) => Promise<boolean>; busy: boolean }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const count = view.messages.length;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (await onSend(body)) setText("");
  }

  return (
    <section className="mb-10" aria-labelledby="rv-msg-h">
      <h2 id="rv-msg-h" className="rv-label mb-3">
        Messages
      </h2>
      <div
        ref={listRef}
        className="max-h-[420px] overflow-y-auto p-3 space-y-2"
        style={{ border: "1px solid var(--rv-line)", background: "color-mix(in srgb, var(--rv-bg) 75%, #000 25%)" }}
        aria-live="polite"
      >
        {count === 0 ? (
          <p className="text-sm opacity-60 text-center py-6">No messages yet. Ask us anything below.</p>
        ) : (
          view.messages.map((m) => {
            const when = formatWhen(m.created_at);
            if (m.kind === "late") {
              return (
                <p key={m.id} className="text-center text-xs opacity-75 py-1">
                  {m.body} <span className="opacity-70">· {when}</span>
                </p>
              );
            }
            const mine = m.from === "guest";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  {!mine && <p className="text-[10px] tracking-[0.15em] uppercase opacity-70 mb-0.5 ml-1">Common Good</p>}
                  <div
                    className="px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words"
                    style={
                      mine
                        ? { background: "var(--rv-accent)", color: "#fff", borderRadius: "16px 16px 4px 16px" }
                        : { background: "var(--rv-soft)", border: "1px solid var(--rv-line)", borderRadius: "16px 16px 16px 4px" }
                    }
                  >
                    {m.body}
                  </div>
                  <p className={`text-[10px] opacity-60 mt-0.5 ${mine ? "text-right mr-1" : "ml-1"}`}>{when}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 mt-2">
        <label htmlFor="rv-msg" className="sr-only">
          Message
        </label>
        <textarea
          id="rv-msg"
          className="rv-input flex-1 min-h-[44px] max-h-40 resize-y"
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="rv-btn shrink-0" disabled={busy || !text.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}

function Notes({ initial, onSave, busy }: { initial: string; onSave: (n: string) => Promise<boolean>; busy: boolean }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(false);
  const dirty = notes !== initial;
  // Pick up a newer saved value when nothing is being edited.
  const lastInitial = useRef(initial);
  useEffect(() => {
    if (initial !== lastInitial.current) {
      setNotes((cur) => (cur === lastInitial.current ? initial : cur));
      lastInitial.current = initial;
    }
  }, [initial]);

  return (
    <section aria-labelledby="rv-notes-h">
      <h2 id="rv-notes-h" className="rv-label mb-3">
        Your notes
      </h2>
      <label htmlFor="rv-notes" className="block text-sm mb-1.5">
        Anything we should know?
      </label>
      <textarea
        id="rv-notes"
        className="rv-input min-h-[110px] resize-y"
        maxLength={2000}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          className="rv-btn"
          disabled={busy || !dirty}
          onClick={async () => {
            if (await onSave(notes.trim())) setSaved(true);
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && !dirty && (
          <span className="text-sm opacity-80" role="status">
            Saved
          </span>
        )}
      </div>
    </section>
  );
}

/** Bible timestamps are UTC "YYYY-MM-DD HH:MM:SS". Show them in bar time. */
function formatWhen(ts: string): string {
  const iso = /Z|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
