"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BibleConfig, MaskedGuest } from "@/lib/reserve/types";
import { dateLong, daysPhrase, isEmail, isUsPhone, telHref, timeRange } from "@/lib/reserve/format";
import SlotPicker, { PRIVATE_EVENT_HREF, type Selection } from "./SlotPicker";
import { api, ApiError, ErrorNote, GENERIC_ERROR, Honeypot, Modal, Stepper } from "./ui";

type Identity =
  | { kind: "ask" }
  | { kind: "match"; masked: MaskedGuest; lookupToken: string; value: string }
  | { kind: "new" };

interface GuestForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: GuestForm = { first_name: "", last_name: "", email: "", phone: "" };

/** "Same day, or more than two weeks out?" — built from the Bible's rules so it stays true. */
function callSentence(rules: BibleConfig["rules"]): string {
  const h = rules.window_close_hours;
  const far = `more than ${daysPhrase(rules.window_open_days)} out`;
  let near = "";
  if (h >= 48) near = `Less than ${Math.floor(h / 24)} days away`;
  else if (h >= 12) near = "Same day";
  else if (h > 0) near = `Less than ${h} hour${h === 1 ? "" : "s"} away`;
  return near ? `${near}, or ${far}?` : `${far.charAt(0).toUpperCase()}${far.slice(1)}?`;
}

// ── The booking flow ──────────────────────────────────────────────────────────

/** An event the booking is limited to (Events page). */
export interface BookingEvent {
  websiteId: string;
  /** The Bible's event id, sent with slots and the request. */
  eventId: number;
  title: string;
  date: string;
}

/**
 * The booking steps shared by the Reserve page (no event) and the Events page
 * (limited to one event: no date step, the event's tables and policies, and the
 * reservation is confirmed at once).
 */
export default function BookingFlow({
  party: range,
  policies,
  rules,
  phone,
  event,
  defaultParty = 6,
}: {
  party: { min: number; max: number };
  policies: string[];
  /** Regular booking rules; drives the "call us" sentence on the Reserve page. */
  rules?: BibleConfig["rules"];
  phone: string;
  event?: BookingEvent;
  defaultParty?: number;
}) {
  const min = range.min;
  const max = range.max;
  const [party, setParty] = useState(() => Math.min(max, Math.max(min, defaultParty)));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [slotRefresh, setSlotRefresh] = useState(0);

  // Step 4
  const [identity, setIdentity] = useState<Identity>({ kind: "ask" });
  const [lookupValue, setLookupValue] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [form, setForm] = useState<GuestForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof GuestForm, string>>>({});
  const [occasion, setOccasion] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const renderedAt = useRef<number>(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  // Step 5
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState<null | "requested" | "approved">(null);

  const detailsRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const handleSelection = useCallback((s: Selection | null) => setSelection(s), []);

  // Bring the details step into view the first time it appears.
  const shownDetails = useRef(false);
  useEffect(() => {
    if (selection && !shownDetails.current) {
      shownDetails.current = true;
      requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [selection]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    const v = lookupValue.trim();
    setLookupError("");
    if (!v) return setLookupError("Enter your email or phone number.");
    if (v.includes("@") ? !isEmail(v) : !isUsPhone(v)) {
      return setLookupError(v.includes("@") ? "That email address doesn't look right." : "Enter a 10-digit phone number, or your email.");
    }
    setLookupBusy(true);
    try {
      const out = await api<{ ok?: true; match?: boolean; masked?: MaskedGuest; lookup_token?: string }>("/api/reserve/lookup", {
        body: { value: v, company, rendered_at: renderedAt.current },
      });
      if (out.match && out.masked && out.lookup_token) {
        setIdentity({ kind: "match", masked: out.masked, lookupToken: out.lookup_token, value: v });
      } else {
        // No match: full form, with what they typed already in place.
        setForm({ ...EMPTY_FORM, ...(v.includes("@") ? { email: v } : { phone: v }) });
        setIdentity({ kind: "new" });
      }
    } catch (err) {
      setLookupError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    } finally {
      setLookupBusy(false);
    }
  }

  async function notMe() {
    if (identity.kind !== "match") return;
    const { lookupToken, value } = identity;
    setIdentity({ kind: "new" });
    setForm(EMPTY_FORM);
    // Best effort: staff see the report; the guest carries on either way.
    api("/api/reserve/not-me", { body: { lookup_token: lookupToken, value } }).catch(() => {});
  }

  function validateForm(): boolean {
    if (identity.kind !== "new") return identity.kind === "match";
    const errs: Partial<Record<keyof GuestForm, string>> = {};
    if (!form.first_name.trim()) errs.first_name = "Enter your first name.";
    if (!form.last_name.trim()) errs.last_name = "Enter your last name.";
    if (!isEmail(form.email)) errs.email = "Enter a valid email address.";
    if (!isUsPhone(form.phone)) errs.phone = "Enter a 10-digit phone number.";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    setSubmitError("");
    if (!selection) return;
    if (!validateForm()) return;
    setAgreed(false);
    setPoliciesOpen(true);
  }

  async function send() {
    if (!selection || !agreed) return;
    setSending(true);
    setSubmitError("");
    try {
      const out = await api<{ ok: true; status?: string }>("/api/reserve/request", {
        body: {
          date: selection.date,
          start_time: selection.start.start_time,
          start_min: selection.start.start_min,
          minutes: selection.minutes,
          party_size: party,
          room_id: selection.space.room_id,
          table_id: selection.space.table_id,
          occasion_note: occasion.trim(),
          ...(event ? { event_id: event.eventId } : {}),
          policy_ack: true,
          ...(identity.kind === "match"
            ? { lookup_token: identity.lookupToken }
            : { guest: { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim() } }),
          company,
          rendered_at: renderedAt.current,
        },
      });
      setPoliciesOpen(false);
      // Event bookings come back approved (no staff step); regular ones are requests.
      setDone(out.status === "approved" ? "approved" : out.status ? "requested" : event ? "approved" : "requested");
      requestAnimationFrame(() => doneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (err) {
      setPoliciesOpen(false);
      if (err instanceof ApiError && (err.status === 409 || err.status === 429 || err.status === 400)) {
        setSubmitError(err.message);
        if (err.status === 409 && /no longer available|not available/i.test(err.message)) setSlotRefresh((n) => n + 1);
        if (/lookup expired/i.test(err.message)) setIdentity({ kind: "ask" });
      } else {
        setSubmitError("Something went wrong sending your request. Please try again, or call us.");
      }
    } finally {
      setSending(false);
    }
  }

  if (done === "approved") {
    return (
      <div ref={doneRef} className="max-w-xl mx-auto text-center rv-step py-6" role="status">
        <h2 className="rv-h2 text-3xl mb-5">Your table is reserved.</h2>
        <div className="space-y-3 leading-relaxed opacity-90">
          <p>We&apos;ve emailed you the details and a link to view or change your reservation.</p>
          <p>We&apos;ll email you the morning of the event to ask you to confirm you&apos;re still coming.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div ref={doneRef} className="max-w-xl mx-auto text-center rv-step py-6" role="status">
        <h2 className="rv-h2 text-3xl mb-5">Request received.</h2>
        <div className="space-y-3 leading-relaxed opacity-90">
          <p>
            This is a request, not yet a confirmed reservation. We&apos;ll email you once our staff have confirmed it. We do our
            best to respond within 24 hours.
          </p>
          <p>Keep an eye out for an email from us with a link to view and manage your reservation.</p>
          <p>
            If you don&apos;t hear back and you&apos;re concerned, call us at{" "}
            <a className="rv-link" href={telHref(phone)}>
              {phone}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const summary = selection
    ? `${event ? `${event.title} · ` : ""}${dateLong(selection.date)} · ${timeRange(selection.start.start_min, selection.start.start_min + selection.minutes)} · party of ${party} · ${selection.space.name}`
    : "";

  return (
    <div className="max-w-2xl mx-auto">
      <Honeypot value={company} onChange={setCompany} />

      {/* ── 1. Party size ── */}
      <section aria-labelledby="rv-party-h" className="mb-10">
        <h2 id="rv-party-h" className="rv-label mb-3">
          1. Party size
        </h2>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Stepper value={party} min={min} max={max} onChange={setParty} label="Party size" />
          <p className="text-sm opacity-90">
            {event ? `Tables for parties of ${min} to ${max}.` : `We take reservations for parties of ${min} to ${max}.`}
          </p>
        </div>
        {!event && (
        <p className="text-sm mt-3 opacity-75 leading-relaxed">
          Smaller group? You&apos;re welcome to walk in. Larger group? Call us at{" "}
          <a className="rv-link" href={telHref(phone)}>
            {phone}
          </a>{" "}
          or{" "}
          <Link className="rv-link" href={PRIVATE_EVENT_HREF}>
            ask about a private event
          </Link>
          .
        </p>
        )}
      </section>

      {/* ── 2–3. Date, time, length ── */}
      {event ? (
        <SlotPicker
          party={party}
          mode="new"
          fixedDate={event.date}
          slotsUrl={(d) => `/api/reserve/slots?date=${d}&party=${party}&event=${event.eventId}`}
          onChange={handleSelection}
          refreshKey={slotRefresh}
          phone={phone}
          stepNumbers={[2, 2]}
          spaceLabel={(s) => `${s.name} · seats ${s.min_guests}–${s.max_guests}`}
          noSlots={
            <>
              Nothing is open for a party of {party} at this event. Try a different size, or{" "}
              <a className="rv-link" href={telHref(phone)}>
                call us
              </a>
              .
            </>
          }
        />
      ) : (
        <SlotPicker
          party={party}
          mode="new"
          calendarUrl={`/api/reserve/calendar?party=${party}`}
          slotsUrl={(d) => `/api/reserve/slots?date=${d}&party=${party}`}
          onChange={handleSelection}
          refreshKey={slotRefresh}
          phone={phone}
          belowCalendar={
            rules && (
              <p className="text-sm mt-4 opacity-90">
                <strong className="font-medium">{callSentence(rules)}</strong> Give us a call:{" "}
                <a className="rv-link whitespace-nowrap" href={telHref(phone)}>
                  {phone}
                </a>
              </p>
            )
          }
        />
      )}

      {/* ── 4. Your details ── */}
      {selection && (
        <section ref={detailsRef} aria-labelledby="rv-details-h" className="rv-step mt-10 scroll-mt-24">
          <h2 id="rv-details-h" className="rv-label mb-4">
            {event ? 3 : 4}. Your details
          </h2>

          {identity.kind === "ask" && (
            <form onSubmit={lookup} noValidate className="max-w-md">
              <label htmlFor="rv-lookup" className="block text-sm mb-2">
                Email or phone number
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="rv-lookup"
                  className="rv-input flex-1"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                  aria-invalid={!!lookupError}
                  aria-describedby={lookupError ? "rv-lookup-err" : undefined}
                />
                <button type="submit" className="rv-btn" disabled={lookupBusy}>
                  {lookupBusy ? "Checking…" : "Continue"}
                </button>
              </div>
              <div id="rv-lookup-err">
                <ErrorNote>{lookupError}</ErrorNote>
              </div>
            </form>
          )}

          {identity.kind === "match" && (
            <div className="p-4 max-w-md" style={{ border: "1px solid var(--rv-line)", background: "var(--rv-soft)" }}>
              <p className="text-lg mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Welcome back, {identity.masked.first_initial || "friend"}.
              </p>
              <p className="text-sm opacity-90 leading-relaxed">
                We&apos;ll use the details we have on file:{" "}
                <span className="whitespace-nowrap">{identity.masked.email_hint}</span>
                {identity.masked.email_hint && identity.masked.phone_hint ? " · " : ""}
                <span className="whitespace-nowrap">{identity.masked.phone_hint}</span>
              </p>
              <button type="button" className="rv-link text-sm mt-3" onClick={notMe}>
                That&apos;s not me
              </button>
            </div>
          )}

          {identity.kind === "new" && (
            <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
              {(
                [
                  ["first_name", "First name", "given-name", "text"],
                  ["last_name", "Last name", "family-name", "text"],
                  ["email", "Email", "email", "email"],
                  ["phone", "Phone", "tel", "tel"],
                ] as const
              ).map(([key, label, ac, type]) => (
                <div key={key}>
                  <label htmlFor={`rv-${key}`} className="block text-sm mb-1.5">
                    {label}
                  </label>
                  <input
                    id={`rv-${key}`}
                    className="rv-input"
                    type={type}
                    autoComplete={ac}
                    required
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    aria-invalid={!!formErrors[key]}
                    aria-describedby={formErrors[key] ? `rv-${key}-err` : undefined}
                  />
                  {formErrors[key] && (
                    <p id={`rv-${key}-err`} className="text-xs mt-1" style={{ color: "#F0A090" }}>
                      {formErrors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {identity.kind !== "ask" && (
            <div className="rv-step">
              <div className="mt-6 max-w-xl">
                <label htmlFor="rv-occasion" className="block text-sm mb-1.5">
                  What&apos;s the occasion? <span className="opacity-60">(optional)</span>
                </label>
                <textarea
                  id="rv-occasion"
                  className="rv-input min-h-[88px] resize-y"
                  maxLength={500}
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                />
                <p className="text-[11px] mt-1 opacity-60 text-right">{occasion.length}/500</p>
              </div>

              <div className="mt-6 p-4" style={{ borderLeft: "2px solid var(--rv-accent)", background: "var(--rv-soft)" }}>
                <p className="rv-label mb-1">Your request</p>
                <p className="leading-snug">{summary}</p>
              </div>

              <ErrorNote>{submitError}</ErrorNote>

              <div className="mt-6">
                <button type="button" className="rv-btn min-w-[160px]" onClick={next}>
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 5. Policies ── */}
      <Modal
        open={policiesOpen}
        onClose={() => !sending && setPoliciesOpen(false)}
        title="Before you send"
        footer={
          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer text-[15px]">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 shrink-0 accent-[#C97D5A]"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>I&apos;ve read and agree to these policies</span>
            </label>
            <button type="button" className="rv-btn w-full" disabled={!agreed || sending} onClick={send}>
              {sending ? (event ? "Reserving…" : "Sending…") : event ? "Reserve table" : "Send request"}
            </button>
          </div>
        }
      >
        <p className="text-sm opacity-80 mb-3">{summary}</p>
        {policies.length ? (
          <ul className="space-y-3 list-disc pl-5 leading-relaxed">
            {policies.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : (
          <p className="opacity-80">No special policies.</p>
        )}
      </Modal>
    </div>
  );
}
