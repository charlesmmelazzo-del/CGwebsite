"use client";

// ─── A guest's own pledge (6) ────────────────────────────────────────────────

import { useState } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { longDate } from "@/lib/givingTree/format";
import { hoursLabel, money } from "@/lib/givingTree/rules";
import type { OppType, PledgeStatus } from "@/lib/givingTree/types";

type Action = "still" | "more" | "release";

export default function ManagePanel({
  token,
  initial,
  pledge,
  opp,
  orgName,
  contactEmail,
}: {
  token: string;
  initial: Action | null;
  pledge: { code: string; name: string; status: PledgeStatus; dueDate: string | null; extendedOnce: boolean; guestResponse: string | null; amount: number | null; hours: number | null };
  opp: { type: OppType; title: string; giveUrl: string | null; dropoff: string };
  orgName: string;
  contactEmail: string;
}) {
  const [status, setStatus] = useState(pledge.status);
  const [due, setDue] = useState(pledge.dueDate);
  const [extended, setExtended] = useState(pledge.extendedOnce);
  const [confirming, setConfirming] = useState<Action | null>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = status === "pledged";
  const isGift = opp.type === "gift";

  async function act(action: Action) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/popup/giving-tree/manage/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? COPY.errGeneric);
      setMessage(data.message);
      if (action === "release") setStatus("released");
      if (action === "more") {
        setDue(data.dueDate);
        setExtended(true);
      }
      setConfirming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const label: Record<Action, string> = { still: COPY.manageStillOnIt, more: COPY.manageMoreTime, release: COPY.manageCantMake };

  return (
    <div className="gt-card max-w-md mx-auto p-5 space-y-3">
      <h1 className="gt-display text-[var(--gt-size-xl)]">{status === "released" ? COPY.manageReleasedTitle : COPY.manageTitle}</h1>
      <p>
        <span className="font-semibold">{opp.title}</span> · {orgName}
      </p>
      <ul className="gt-small space-y-1">
        <li>
          {COPY.codeLabel}: <span className="font-mono font-semibold tracking-widest">{pledge.code}</span>
        </li>
        <li>{COPY.manageStatus[status] ?? status}</li>
        {opp.type === "cash" && pledge.amount != null && <li>{money(pledge.amount)}</li>}
        {opp.type === "volunteer" && pledge.hours ? <li>{hoursLabel(pledge.hours)}</li> : null}
        {isGift && open && due && <li>{COPY.giftDue(longDate(due))}</li>}
      </ul>
      {isGift && open && <p className="gt-small rounded-lg bg-black/5 p-3">{COPY.giftCodeFirst(pledge.code)} {opp.dropoff}</p>}
      {opp.type === "cash" && opp.giveUrl && status !== "released" && (
        <a className="gt-btn w-full" href={opp.giveUrl} target="_blank" rel="noopener noreferrer">
          {COPY.cashContinue(orgName)}
        </a>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-black/5 p-3">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="gt-error">
          {error}
        </p>
      )}

      {open && confirming && (
        <div className="rounded-lg border border-black/15 p-3 space-y-2">
          <p>{confirming === "release" ? COPY.manageConfirmRelease : `${label[confirming]}?`}</p>
          <div className="flex gap-2">
            <button type="button" className="gt-btn gt-btn-primary flex-1" disabled={busy} onClick={() => act(confirming)}>
              {confirming === "release" ? COPY.manageYes : label[confirming]}
            </button>
            <button type="button" className="gt-btn flex-1" onClick={() => setConfirming(null)}>
              {COPY.back}
            </button>
          </div>
        </div>
      )}

      {open && !confirming && (
        <div className="flex flex-col gap-2">
          {isGift && <button type="button" className="gt-btn" onClick={() => setConfirming("still")}>{COPY.manageStillOnIt}</button>}
          {isGift && !extended && <button type="button" className="gt-btn" onClick={() => setConfirming("more")}>{COPY.manageMoreTime}</button>}
          <button type="button" className="gt-btn" onClick={() => setConfirming("release")}>{COPY.manageCantMake}</button>
        </div>
      )}

      <p className="gt-small italic">{COPY.trustLine}</p>
      <p className="gt-small gt-muted">{COPY.manageQuestions(contactEmail)}</p>
    </div>
  );
}
