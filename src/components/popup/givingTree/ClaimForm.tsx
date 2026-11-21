"use client";

// ─── Hang my ornament (3.3–3.6) ──────────────────────────────────────────────
// No mailing-list opt-in here, ever. The server checks every field again.

import { useMemo, useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { longDate } from "@/lib/givingTree/format";
import type { PublicOpportunity, PublicOrg, PublicStar } from "@/lib/givingTree/types";

export interface ClaimSuccess {
  code: string;
  type: PublicOpportunity["type"];
  orgName: string;
  giveUrl: string | null;
  dueDate: string | null;
  dropoff: string | null;
  star: PublicStar;
  opportunity: PublicOpportunity;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function hourOptions(min: number, max: number): number[] {
  const out: number[] = [];
  for (let h = min; h <= max + 1e-9; h += 0.5) out.push(Math.round(h * 2) / 2);
  return out;
}

export default function ClaimForm({
  o,
  org,
  sandbox,
  contactEmail,
  onCancel,
  onSuccess,
}: {
  o: PublicOpportunity;
  org: PublicOrg;
  sandbox: boolean;
  contactEmail: string;
  onCancel: () => void;
  onSuccess: (s: ClaimSuccess) => void;
}) {
  const renderedAt = useMemo(() => Date.now(), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [showGift, setShowGift] = useState(true);
  const [showAmount, setShowAmount] = useState(true);
  const [hours, setHours] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = (k: string) => `gt-${o.id}-${k}`;

  function check(): string | null {
    if (!name.trim()) return COPY.errName;
    if (!EMAIL_RE.test(email.trim())) return COPY.errEmail;
    if (note.length > 200) return COPY.errNote;
    if (o.type === "volunteer") {
      if (phone.replace(/\D/g, "").length < 10) return COPY.errPhone;
      if (o.hoursMode === "choose" && !hours) return COPY.errHours;
      if (!consent) return COPY.errConsent;
    }
    if (o.type === "cash") {
      const a = Number(amount.replace(/[$,\s]/g, ""));
      if (!Number.isFinite(a) || a < 0.01) return COPY.errAmount;
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = check();
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const res = await fetch("/api/popup/giving-tree/pledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: o.id,
          name,
          email,
          phone: o.type === "volunteer" ? phone : null,
          displayMode: anonymous ? "anonymous" : "named",
          displayName: anonymous ? null : displayName || name,
          note,
          showGift,
          showAmount,
          hours: o.type === "volunteer" && o.hoursMode === "choose" ? Number(hours) : null,
          amount: o.type === "cash" ? Number(amount.replace(/[$,\s]/g, "")) : null,
          consent,
          sandbox,
          company,
          rendered_at: renderedAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? COPY.errGeneric);
      onSuccess({ ...data, opportunity: o });
    } catch (err) {
      setError(err instanceof Error ? err.message : COPY.errGeneric);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="gt-display text-[length:var(--gt-size-l)]">{COPY.formTitle}</h2>
        <button type="button" className="gt-btn gt-btn-small" onClick={onCancel}>
          {COPY.back}
        </button>
      </div>
      <p className="font-semibold">
        {o.title} <span className="font-normal gt-muted">· {org.name}</span>
      </p>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Company
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
      </div>

      <div>
        <label className="gt-label" htmlFor={id("name")}>{COPY.name}</label>
        <input id={id("name")} className="gt-input" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="gt-label" htmlFor={id("email")}>{COPY.email}</label>
        <input id={id("email")} className="gt-input" type="email" inputMode="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={id("email-help")} required />
        <p id={id("email-help")} className="gt-small gt-muted mt-1">{COPY.emailHelp}</p>
      </div>

      {o.type === "volunteer" && (
        <div>
          <label className="gt-label" htmlFor={id("phone")}>{COPY.phone}</label>
          <input id={id("phone")} className="gt-input" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} aria-describedby={id("phone-help")} required />
          <p id={id("phone-help")} className="gt-small gt-muted mt-1">{COPY.phoneHelp}</p>
        </div>
      )}

      <fieldset>
        <legend className="gt-label">{COPY.displayName}</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="radio" name={id("display")} checked={!anonymous} onChange={() => setAnonymous(false)} /> {COPY.showName}
          </label>
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="radio" name={id("display")} checked={anonymous} onChange={() => setAnonymous(true)} /> {COPY.stayAnonymous}
          </label>
        </div>
        {!anonymous && (
          <input className="gt-input" aria-label={COPY.displayName} maxLength={40} placeholder={name || COPY.name} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        )}
      </fieldset>

      <div>
        <label className="gt-label" htmlFor={id("note")}>{COPY.note}</label>
        <textarea id={id("note")} className="gt-input" rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={id("note-help")} />
        <p id={id("note-help")} className="gt-small gt-muted mt-1">
          {COPY.noteHelp} <span aria-live="polite">({note.length}/200)</span>
        </p>
      </div>

      <label className="flex items-center gap-2 min-h-[44px]">
        <input type="checkbox" checked={showGift} onChange={(e) => setShowGift(e.target.checked)} /> {COPY.showWhatIGave}
      </label>

      {o.type === "volunteer" && (
        <>
          {o.hoursMode === "choose" && o.hoursMin != null && o.hoursMax != null && (
            <div>
              <label className="gt-label" htmlFor={id("hours")}>{COPY.hours}</label>
              <select id={id("hours")} className="gt-input" value={hours} onChange={(e) => setHours(e.target.value)} required>
                <option value="">—</option>
                {hourOptions(o.hoursMin, o.hoursMax).map((h) => (
                  <option key={h} value={h}>
                    {COPY.hoursFixed(h)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {o.requirements && (
            <div className="gt-small">
              <p className="font-semibold">{COPY.requirements}</p>
              <p className="whitespace-pre-line">{o.requirements}</p>
            </div>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required aria-describedby={id("consent-help")} />
            <span>
              {COPY.volunteerConsent(org.name)}
              <span id={id("consent-help")} className="block gt-small gt-muted">{COPY.volunteerConsentAnon}</span>
            </span>
          </label>
        </>
      )}

      {o.type === "gift" && (
        <div className="gt-small rounded-lg bg-black/5 p-3 space-y-1">
          <p className="font-semibold">{COPY.giftDropoffTitle}</p>
          {o.dropoff && <p>{o.dropoff}</p>}
          {o.dueIfClaimedNow && <p>{COPY.giftDue(longDate(o.dueIfClaimedNow))}</p>}
          {o.deadline && <p>{COPY.giftOrgDeadline(longDate(o.deadline))}</p>}
        </div>
      )}

      {o.type === "cash" && (
        <>
          <div>
            <label className="gt-label" htmlFor={id("amount")}>{COPY.amount}</label>
            <input id={id("amount")} className="gt-input" inputMode="decimal" placeholder="$" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" checked={showAmount} onChange={(e) => setShowAmount(e.target.checked)} /> {COPY.showAmount}
          </label>
          <p className="gt-small rounded-lg bg-black/5 p-3">{COPY.cashExplain(org.name)}</p>
        </>
      )}

      {o.details && (
        <div className="gt-small">
          <p className="font-semibold">{COPY.details}</p>
          <p className="whitespace-pre-line">{o.details}</p>
        </div>
      )}

      <p className="gt-small italic">{COPY.trustLine}</p>
      {error && (
        <p className="gt-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="gt-btn gt-btn-primary w-full" disabled={busy}>
        {busy ? COPY.sending : COPY.confirm}
      </button>
      <p className="gt-small gt-muted text-center">{COPY.manageQuestions(contactEmail)}</p>
    </form>
  );
}
