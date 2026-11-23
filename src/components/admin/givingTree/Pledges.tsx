"use client";

// Pledges (9.4), Needs review (9.5), Check in a gift (9.6), Ornaments to write (9.8).

import { useMemo, useState } from "react";
import { money } from "@/lib/givingTree/rules";
import { type Act, type AdminPledge, Area, Badge, Btn, Card, Check, Field, fmtWhen, HOLD_LABEL, inputCls, type Snapshot, Text, TYPE_LABEL } from "./kit";

const STATUS_TONE = { pledged: "blue", received: "green", delivered: "green", released: "gray", not_received: "amber" } as const;

export function PledgeRow({ p, act, open: startOpen = false }: { p: AdminPledge; act: Act; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: p.name, email: p.email ?? "", phone: p.phone ?? "", displayMode: p.displayMode, displayName: p.displayName ?? "", note: p.note ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function op(name: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setErr(null);
    try {
      await act({ action: "pledge", id: p.id, op: name, ...extra });
      if (name === "edit") setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-gray-200 bg-white">
      <button type="button" className="w-full text-left p-3 flex flex-wrap items-center gap-x-3 gap-y-1" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-mono text-sm tracking-wider text-gray-800">{p.code}</span>
        <Badge tone={STATUS_TONE[p.status]}>{p.status.replace("_", " ")}</Badge>
        {p.hold !== "none" && <Badge tone={p.hold === "denied" ? "red" : "amber"}>{HOLD_LABEL[p.hold]}</Badge>}
        {p.hidden && <Badge tone="red">Hidden</Badge>}
        {p.overdue && <Badge tone="amber">Overdue</Badge>}
        {p.isDemo && <Badge>Demo</Badge>}
        {p.source === "manual" && <Badge>Manual</Badge>}
        <span className="text-sm text-gray-700">{p.name}</span>
        <span className="text-[11px] text-gray-400 w-full sm:w-auto">
          {TYPE_LABEL[p.oppType]} · {p.oppTitle} · {p.orgName}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 text-sm text-gray-700">
          {!editing ? (
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-gray-400">On the stocking</dt>
              <dd>{p.label}{p.displayMode === "anonymous" ? " (anonymous)" : ""}</dd>
              <dt className="text-gray-400">Note</dt>
              <dd>{p.note || "—"}</dd>
              <dt className="text-gray-400">Gave</dt>
              <dd>
                {p.gave}
                {!p.showGift && " (not shown on stocking)"}
                {p.oppType === "cash" && p.amount != null && !p.showAmount && " (amount not shown)"}
              </dd>
              <dt className="text-gray-400">Email</dt>
              <dd>{p.email || "—"}</dd>
              {p.oppType === "volunteer" && (
                <>
                  <dt className="text-gray-400">Phone</dt>
                  <dd>{p.phone || "—"}</dd>
                </>
              )}
              {p.dueDate && (
                <>
                  <dt className="text-gray-400">Due</dt>
                  <dd>
                    {p.dueDate}
                    {p.extendedOnce ? " (extended)" : ""}
                    {p.guestResponse ? ` · guest said: ${p.guestResponse === "still_on_it" ? "still on it" : "more time"}` : ""}
                  </dd>
                </>
              )}
              {p.reminderAt && (
                <>
                  <dt className="text-gray-400">Reminder</dt>
                  <dd>{p.reminderSentAt ? `sent ${fmtWhen(p.reminderSentAt)}` : `due ${fmtWhen(p.reminderAt)}`}</dd>
                </>
              )}
              {p.releasedAt && (
                <>
                  <dt className="text-gray-400">Released</dt>
                  <dd>{fmtWhen(p.releasedAt)} ({p.releaseReason})</dd>
                </>
              )}
              <dt className="text-gray-400">Pledged</dt>
              <dd>{fmtWhen(p.createdAt)}</dd>
              <dt className="text-gray-400">Wall</dt>
              <dd>{p.ornament === "hung" ? `hung ${fmtWhen(p.hungAt)}` : "to write"}</dd>
            </dl>
          ) : (
            <div className="space-y-2">
              <Field label="Name"><Text value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} /></Field>
              <Field label="Email"><Text value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} /></Field>
              {p.oppType === "volunteer" && <Field label="Phone"><Text value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} /></Field>}
              <Check label="Anonymous on the tree" checked={draft.displayMode === "anonymous"} onChange={(v) => setDraft({ ...draft, displayMode: v ? "anonymous" : "named" })} />
              {draft.displayMode === "named" && <Field label="Name on the stocking"><Text value={draft.displayName} onChange={(v) => setDraft({ ...draft, displayName: v })} /></Field>}
              <Field label="Note (200 max)"><Area value={draft.note} onChange={(v) => setDraft({ ...draft, note: v.slice(0, 200) })} rows={2} /></Field>
              <div className="flex gap-2">
                <Btn kind="primary" disabled={busy} onClick={() => op("edit", draft)}>Save</Btn>
                <Btn onClick={() => setEditing(false)}>Cancel</Btn>
              </div>
            </div>
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
          {!editing && (
            <div className="flex flex-wrap gap-2">
              {p.hold === "held_moderation" || p.hold === "held_amount" ? (
                <>
                  <Btn small kind="primary" disabled={busy} onClick={() => op("approve")}>Approve</Btn>
                  <Btn small kind="danger" disabled={busy} onClick={() => op("deny")}>Deny</Btn>
                </>
              ) : null}
              {p.oppType === "gift" && p.status !== "received" && p.status !== "delivered" && <Btn small kind="primary" disabled={busy} onClick={() => op("received")}>Received</Btn>}
              {p.oppType === "gift" && p.status === "received" && <Btn small disabled={busy} onClick={() => op("delivered")}>Delivered</Btn>}
              <Btn small disabled={busy} onClick={() => setEditing(true)}>Edit name / note</Btn>
              {p.hidden ? <Btn small disabled={busy} onClick={() => op("unhide")}>Unhide</Btn> : <Btn small disabled={busy} onClick={() => op("hide")}>Hide</Btn>}
              {p.status === "pledged" && (
                <Btn small kind="danger" disabled={busy} onClick={() => confirm("Release this pledge? The spot goes back on the tree; the stocking stays.") && op("release")}>Release</Btn>
              )}
              {(p.status !== "pledged" || p.hidden || p.hold === "denied") && <Btn small disabled={busy} onClick={() => op("restore")}>Restore</Btn>}
              {p.ornament === "to_write" ? <Btn small disabled={busy} onClick={() => op("hung")}>Mark hung</Btn> : <Btn small disabled={busy} onClick={() => op("unhung")}>Not hung</Btn>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function PledgesSection({ s, act }: { s: Snapshot; act: Act }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [org, setOrg] = useState("");
  const [status, setStatus] = useState("");
  const [hold, setHold] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return s.pledges.filter(
      (p) =>
        (!t || p.code.toLowerCase().includes(t) || p.name.toLowerCase().includes(t) || (p.email ?? "").includes(t) || (p.displayName ?? "").toLowerCase().includes(t)) &&
        (!type || p.oppType === type) &&
        (!org || p.orgId === org) &&
        (!status || p.status === status) &&
        (!hold || (hold === "hidden" ? p.hidden : p.hold === hold))
    );
  }, [s.pledges, q, type, org, status, hold]);

  return (
    <Card title={`Pledges (${list.length} of ${s.pledges.length})`}>
      <input className={inputCls} placeholder="Search code, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          <option value="volunteer">Volunteer</option>
          <option value="gift">Gift</option>
          <option value="cash">Cash</option>
        </select>
        <select className={inputCls} value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Organization">
          <option value="">All organizations</option>
          {s.orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {["pledged", "received", "delivered", "released", "not_received"].map((x) => (
            <option key={x} value={x}>{x.replace("_", " ")}</option>
          ))}
        </select>
        <select className={inputCls} value={hold} onChange={(e) => setHold(e.target.value)} aria-label="Hold">
          <option value="">Any hold</option>
          <option value="none">Not held</option>
          <option value="held_moderation">Held: wording</option>
          <option value="held_amount">Held: amount</option>
          <option value="denied">Denied</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <ul className="space-y-2">
        {list.slice(0, 200).map((p) => (
          <PledgeRow key={p.id} p={p} act={act} />
        ))}
      </ul>
      {list.length > 200 && <p className="text-xs text-gray-400">Showing the newest 200. Search to narrow it down.</p>}
    </Card>
  );
}

export function ReviewSection({ s, act }: { s: Snapshot; act: Act }) {
  const held = s.pledges.filter((p) => p.hold === "held_moderation" || p.hold === "held_amount");
  const overdue = s.pledges.filter((p) => p.overdue);
  return (
    <div className="space-y-4">
      <Card title={`Held for review (${held.length})`}>
        <p className="text-xs text-gray-500">The guest saw the normal success screen and email. Approve to make it public and counted; deny keeps it hidden (no email is sent).</p>
        {held.length === 0 ? <p className="text-sm text-gray-400">Nothing waiting.</p> : <ul className="space-y-2">{held.map((p) => <PledgeRow key={p.id} p={p} act={act} open />)}</ul>}
      </Card>
      <Card title={`Overdue gifts the guest is still on (${overdue.length})`}>
        <p className="text-xs text-gray-500">These answered the reminder, so they are never released automatically. Decide: mark received, release, or leave it.</p>
        {overdue.length === 0 ? <p className="text-sm text-gray-400">None.</p> : <ul className="space-y-2">{overdue.map((p) => <PledgeRow key={p.id} p={p} act={act} open />)}</ul>}
      </Card>
    </div>
  );
}

export function CheckInSection({ s, act, onAddManual }: { s: Snapshot; act: Act; onAddManual: () => void }) {
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const found = clean.length === 6 ? s.pledges.find((p) => p.code === clean) : undefined;
  const t = q.trim().toLowerCase();
  const matches = t.length >= 2 ? s.pledges.filter((p) => p.oppType === "gift" && (p.name.toLowerCase().includes(t) || (p.email ?? "").includes(t))).slice(0, 20) : [];

  return (
    <div className="space-y-4">
      <Card title="Check in a gift">
        <Field label="Code on the tag">
          <input
            className={`${inputCls} font-mono text-2xl tracking-[0.3em] uppercase text-center`}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            placeholder="K7M2QX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        {clean.length === 6 && !found && <p className="text-sm text-amber-700">No pledge with that code. Check the letters, or search by name below.</p>}
        {found && (
          <div className="space-y-2">
            <ul>
              <PledgeRow key={found.id} p={found} act={act} open />
            </ul>
            {found.oppType === "gift" && found.status !== "received" && found.status !== "delivered" && (
              <button
                type="button"
                className="w-full min-h-[56px] bg-green-700 text-white text-base tracking-wide"
                onClick={async () => {
                  await act({ action: "pledge", id: found.id, op: "received" });
                  setCode("");
                }}
              >
                Received
              </button>
            )}
            {(found.status === "received" || found.status === "delivered") && <p className="text-sm text-green-700">Already checked in. Thank you!</p>}
          </div>
        )}
      </Card>
      <Card title="No code? Find it">
        <input className={inputCls} placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="space-y-2">{matches.map((p) => <PledgeRow key={p.id} p={p} act={act} />)}</ul>
        {t.length >= 2 && matches.length === 0 && <p className="text-sm text-gray-400">No gift pledges match.</p>}
        <Btn onClick={onAddManual}>Add it as a manual pledge</Btn>
      </Card>
    </div>
  );
}

export function OrnamentsSection({ s, act }: { s: Snapshot; act: Act }) {
  const [demo, setDemo] = useState(true);
  const list = s.pledges
    .filter((p) => p.ornament === "to_write" && p.hold === "none" && !p.hidden && (demo || !p.isDemo))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <Card
      title={`Ornaments to write (${list.length})`}
      actions={
        <a className="text-xs underline text-gray-600" href={`/api/admin/giving-tree/print${demo ? "?demo=1" : ""}`} target="_blank" rel="noopener noreferrer">
          Print view
        </a>
      }
    >
      <Check label="Include demo / sandbox pledges" checked={demo} onChange={setDemo} />
      <p className="text-xs text-gray-500">Released pledges stay here: their ornament still goes on the wall.</p>
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id} className="border border-gray-200 bg-white p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium text-gray-800">{p.label}</p>
              {p.note && <p className="italic text-gray-600">“{p.note}”</p>}
              {p.showGift && p.gave && <p className="text-[12px] text-gray-500">{p.oppType === "cash" && !p.showAmount ? p.oppTitle : p.gave}</p>}
              <p className="text-[11px] text-gray-400 font-mono">{p.code}{p.status === "released" ? " · released" : ""}</p>
            </div>
            <Btn small kind="primary" onClick={() => act({ action: "pledge", id: p.id, op: "hung" })}>Hung</Btn>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CashSection({ s, act }: { s: Snapshot; act: Act }) {
  const cash = s.opps.filter((o) => o.type === "cash");
  return (
    <Card title="Cash check">
      <p className="text-xs text-gray-500">
        Pledged is what guests promised (approved, not released). Enter a confirmed figure from the organization and the ornament&rsquo;s meter shows it as
        &ldquo;raised, as of&rdquo; that date instead. Clear it to go back to pledged.
      </p>
      <ul className="space-y-2">
        {cash.map((o) => (
          <CashRow key={o.id} o={o} pledged={s.pledges.filter((p) => p.opportunityId === o.id && p.status !== "released" && p.hold === "none").reduce((a, p) => a + (p.amount ?? 0), 0)} act={act} />
        ))}
      </ul>
    </Card>
  );
}

function CashRow({ o, pledged, act }: { o: Snapshot["opps"][number]; pledged: number; act: Act }) {
  const [raised, setRaised] = useState(o.confirmedRaised?.toString() ?? "");
  const [asOf, setAsOf] = useState(o.confirmedAsOf ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className="border border-gray-200 bg-white p-3 space-y-2 text-sm">
      <p className="font-medium text-gray-800">
        {o.title} <span className="text-gray-400 font-normal">· {o.orgName}{o.isDemo ? " · demo" : ""}</span>
      </p>
      <p className="text-gray-600">
        Pledged {money(pledged)} of {money(o.goalAmount ?? 0)}
        {o.confirmedRaised != null && ` · confirmed ${money(o.confirmedRaised)} as of ${o.confirmedAsOf ?? "?"}`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Confirmed raised"><Text inputMode="decimal" value={raised} onChange={setRaised} /></Field>
        <Field label="As of"><Text type="date" value={asOf} onChange={setAsOf} /></Field>
      </div>
      <Btn
        small
        onClick={async () => {
          try {
            await act({ action: "saveOpp", opp: { ...o, confirmedRaised: raised === "" ? null : Number(raised), confirmedAsOf: asOf || null } });
            setMsg("Saved.");
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Failed.");
          }
        }}
      >
        Save
      </Btn>
      {msg && <span className="ml-2 text-xs text-gray-500">{msg}</span>}
    </li>
  );
}
