"use client";

// Organizations (9.1), Opportunities (9.2), Add a pledge manually (9.7).

import { useMemo, useState } from "react";
import ImagePicker from "@/components/ui/ImagePicker";
import { PartnerCard } from "@/components/popup/givingTree/Partners";
import { GivingTreeStyles } from "@/components/popup/givingTree/theme";
import { TREE, ZONES } from "@/lib/givingTree/layout";
import type { OppType, Org, PublicOrg } from "@/lib/givingTree/types";
import { type Act, type AdminOpp, Area, Badge, Btn, Card, Check, Field, inputCls, type Snapshot, Text, TYPE_LABEL } from "./kit";

// ─── Organizations ───────────────────────────────────────────────────────────

const BLANK_ORG: Partial<Org> = { name: "", slug: "", description: "", logoUrl: "", website: "", publicPhone: "", publicEmail: "", publicAddress: "", hideAddress: false, socialLinks: [], publicContactNote: "", adminContactName: "", adminContactEmail: "", showOnPartners: true };

function asPublic(o: Partial<Org>): PublicOrg {
  return {
    id: o.id ?? "preview",
    slug: o.slug || "preview",
    name: o.name || "Organization name",
    description: o.description || null,
    logoUrl: o.logoUrl || null,
    website: o.website || null,
    phone: o.publicPhone || null,
    email: o.publicEmail || null,
    address: o.hideAddress ? null : o.publicAddress || null,
    socialLinks: (o.socialLinks ?? []).filter(Boolean),
    showOnPartners: o.showOnPartners !== false,
  };
}

function OrgEditor({ initial, act, onDone }: { initial: Partial<Org>; act: Act; onDone: () => void }) {
  const [o, setO] = useState<Partial<Org>>(initial);
  const [social, setSocial] = useState((initial.socialLinks ?? []).join("\n"));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Org>(k: K, v: Org[K]) => setO((x) => ({ ...x, [k]: v }));
  const links = social.split(/\s+/).filter(Boolean);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await act({ action: "saveOrg", org: { ...o, socialLinks: links } });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={o.id ? `Edit ${initial.name}` : "New organization"}>
      <Field label="Name"><Text value={o.name} onChange={(v) => set("name", v)} /></Field>
      <Field label="Slug" hint="Used in links and in the import file. Lower-case, dashes."><Text value={o.slug} onChange={(v) => set("slug", v)} /></Field>
      <Field label="Description"><Area value={o.description} onChange={(v) => set("description", v)} rows={4} /></Field>
      <ImagePicker label="Logo" value={o.logoUrl ?? ""} onChange={(v) => set("logoUrl", v)} />
      <p className="text-[10px] tracking-widest uppercase text-gray-500 pt-2">Public contact (each shown only when filled in)</p>
      <Field label="Website"><Text value={o.website} onChange={(v) => set("website", v)} placeholder="https://" /></Field>
      <Field label="Phone"><Text value={o.publicPhone} onChange={(v) => set("publicPhone", v)} inputMode="tel" /></Field>
      <Field label="Email"><Text value={o.publicEmail} onChange={(v) => set("publicEmail", v)} inputMode="email" /></Field>
      <Field label="Address"><Text value={o.publicAddress} onChange={(v) => set("publicAddress", v)} /></Field>
      <Check label="Hide address (never shown publicly, even if stored)" checked={!!o.hideAddress} onChange={(v) => set("hideAddress", v)} />
      <Field label="Social links" hint="One web address per line."><Area value={social} onChange={setSocial} rows={2} /></Field>
      <Check label="Show on Our Partners" checked={o.showOnPartners !== false} onChange={(v) => set("showOnPartners", v)} />
      <p className="text-[10px] tracking-widest uppercase text-gray-500 pt-2">Private (admin only)</p>
      <Field label="Contact note" hint="Reminders like “confirm phone before launch”. Never public."><Area value={o.publicContactNote} onChange={(v) => set("publicContactNote", v)} rows={2} /></Field>
      <Field label="Our contact's name"><Text value={o.adminContactName} onChange={(v) => set("adminContactName", v)} /></Field>
      <Field label="Our contact's email" hint="Who the volunteer list goes to. Never public."><Text value={o.adminContactEmail} onChange={(v) => set("adminContactEmail", v)} inputMode="email" /></Field>

      <p className="text-[10px] tracking-widest uppercase text-gray-500 pt-2">Partner card, as guests see it</p>
      <div className="gt-root p-3 rounded">
        <GivingTreeStyles />
        <PartnerCard org={asPublic({ ...o, socialLinks: links })} />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Btn kind="primary" disabled={busy} onClick={save}>Save</Btn>
        <Btn onClick={onDone}>Cancel</Btn>
      </div>
    </Card>
  );
}

export function OrgsSection({ s, act }: { s: Snapshot; act: Act }) {
  const [editing, setEditing] = useState<Partial<Org> | null>(null);
  if (editing) return <OrgEditor initial={editing} act={act} onDone={() => setEditing(null)} />;
  return (
    <Card title={`Organizations (${s.orgs.length})`} actions={<Btn kind="primary" small onClick={() => setEditing(BLANK_ORG)}>New organization</Btn>}>
      <ul className="space-y-2">
        {s.orgs.map((o) => {
          const n = s.opps.filter((x) => x.orgId === o.id).length;
          return (
            <li key={o.id} className="border border-gray-200 bg-white p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-800">{o.name}</span>
                {o.isDemo && <Badge>Demo</Badge>}
                {!o.showOnPartners && <Badge tone="amber">Not on Our Partners</Badge>}
                {o.hideAddress && <Badge>Address hidden</Badge>}
              </div>
              <p className="text-[12px] text-gray-500">{n} opportunit{n === 1 ? "y" : "ies"}{o.adminContactEmail ? ` · contact ${o.adminContactName || ""} ${o.adminContactEmail}` : " · no admin contact yet"}</p>
              {o.publicContactNote && <p className="text-[12px] text-amber-700">Note: {o.publicContactNote}</p>}
              <div className="flex gap-2 pt-1">
                <Btn small onClick={() => setEditing(o)}>Edit</Btn>
                <Btn small kind="danger" onClick={() => confirm(`Delete ${o.name} and all its opportunities and pledges? This can't be undone.`) && act({ action: "deleteOrg", id: o.id })}>Delete</Btn>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ─── Opportunities ───────────────────────────────────────────────────────────

/** Click on the little tree to place an ornament; clear to auto-place. */
function Placer({ zone, x, y, onChange }: { zone: OppType; x: number | null; y: number | null; onChange: (x: number | null, y: number | null) => void }) {
  const z = ZONES.find((q) => q.key === zone)!;
  return (
    <div className="space-y-1">
      <svg
        viewBox="0 0 100 100"
        className="w-full max-w-[260px] bg-gray-50 border border-gray-200 cursor-crosshair"
        onClick={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          onChange(Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, Math.round(((e.clientY - r.top) / r.height) * 1000) / 10);
        }}
      >
        <polygon points={`${TREE.apexX},${TREE.apexY} ${TREE.apexX + TREE.halfBase},${TREE.baseY} ${TREE.apexX - TREE.halfBase},${TREE.baseY}`} fill="#cfe3d3" />
        <rect x={0} y={z.y0} width={100} height={z.y1 - z.y0} fill="#C97D5A" opacity={0.15} />
        {x != null && y != null && <circle cx={x} cy={y} r={3} fill="#C97D5A" />}
      </svg>
      <p className="text-[11px] text-gray-500">
        {x != null && y != null ? `Placed at ${x}, ${y}. ` : "Auto-placed in its zone. "}
        Tap the tree to place it{x != null ? <>, or <button type="button" className="underline" onClick={() => onChange(null, null)}>go back to auto</button></> : ""}.
      </p>
    </div>
  );
}

function OppEditor({ initial, s, act, onDone }: { initial: Partial<AdminOpp>; s: Snapshot; act: Act; onDone: () => void }) {
  const [o, setO] = useState<Partial<AdminOpp>>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof AdminOpp, v: unknown) => setO((x) => ({ ...x, [k]: v }));
  const type = (o.type ?? "gift") as OppType;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await act({ action: "saveOpp", opp: o });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={o.id ? `Edit: ${initial.title}` : "New opportunity"}>
      <Field label="Organization">
        <select className={inputCls} value={o.orgId ?? ""} onChange={(e) => set("orgId", e.target.value)}>
          <option value="">Pick one</option>
          {s.orgs.map((x) => (
            <option key={x.id} value={x.id}>{x.name}{x.isDemo ? " (demo)" : ""}</option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <select className={inputCls} value={type} onChange={(e) => set("type", e.target.value)}>
          <option value="volunteer">Volunteer</option>
          <option value="gift">Gift</option>
          <option value="cash">Cash</option>
        </select>
      </Field>
      <Field label="Title (front of the ornament)"><Text value={o.title} onChange={(v) => set("title", v.slice(0, 80))} /></Field>
      <Field label="Description (back of the ornament)"><Area value={o.description} onChange={(v) => set("description", v)} /></Field>
      <Field label="Policies / details (optional, shown before confirming)"><Area value={o.details} onChange={(v) => set("details", v)} rows={2} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Status">
          <select className={inputCls} value={o.status ?? "draft"} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">Draft (not on the tree)</option>
            <option value="live">Live</option>
            <option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Deadline (optional)"><Text type="date" value={o.deadline} onChange={(v) => set("deadline", v || null)} /></Field>
      </div>
      {type !== "cash" && <Field label="Spots (how many people can claim it)"><Text inputMode="numeric" value={o.spots ?? 1} onChange={(v) => set("spots", v)} /></Field>}

      {type === "volunteer" && (
        <>
          <Field label="Hours">
            <select className={inputCls} value={o.hoursMode ?? "fixed"} onChange={(e) => set("hoursMode", e.target.value)}>
              <option value="fixed">A set shift</option>
              <option value="choose">The volunteer chooses</option>
            </select>
          </Field>
          {(o.hoursMode ?? "fixed") === "fixed" ? (
            <Field label="Hours"><Text inputMode="decimal" value={o.hoursFixed} onChange={(v) => set("hoursFixed", v)} /></Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fewest hours"><Text inputMode="decimal" value={o.hoursMin} onChange={(v) => set("hoursMin", v)} /></Field>
              <Field label="Most hours"><Text inputMode="decimal" value={o.hoursMax} onChange={(v) => set("hoursMax", v)} /></Field>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Event date"><Text type="date" value={o.eventDate} onChange={(v) => set("eventDate", v || null)} /></Field>
            <Field label="Start"><Text type="time" value={o.startTime} onChange={(v) => set("startTime", v || null)} /></Field>
            <Field label="End"><Text type="time" value={o.endTime} onChange={(v) => set("endTime", v || null)} /></Field>
          </div>
          <Field label="Location"><Text value={o.location} onChange={(v) => set("location", v)} /></Field>
          <Field label="Requirements (from the organization; we do no screening)"><Area value={o.requirements} onChange={(v) => set("requirements", v)} rows={2} /></Field>
        </>
      )}
      {type === "gift" && (
        <Field label="Drop-off instructions" hint={`Blank uses the default: “${s.settings.defaultDropoff}”`}>
          <Area value={o.dropoffInstructions} onChange={(v) => set("dropoffInstructions", v)} rows={2} />
        </Field>
      )}
      {type === "cash" && (
        <>
          <Field label="Goal amount ($)"><Text inputMode="decimal" value={o.goalAmount} onChange={(v) => set("goalAmount", v)} /></Field>
          <Field label="Give URL (the organization's own donation page)"><Text value={o.giveUrl} onChange={(v) => set("giveUrl", v)} placeholder="https://" /></Field>
        </>
      )}

      <Field label="Tree zone">
        <select className={inputCls} value={o.treeZone ?? ""} onChange={(e) => set("treeZone", e.target.value || null)}>
          <option value="">Same as its type</option>
          <option value="volunteer">Volunteer</option>
          <option value="gift">Gifts</option>
          <option value="cash">Funds</option>
        </select>
      </Field>
      <Placer zone={(o.treeZone as OppType) ?? type} x={o.treeX ?? null} y={o.treeY ?? null} onChange={(x, y) => setO((v) => ({ ...v, treeX: x, treeY: y }))} />

      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Btn kind="primary" disabled={busy} onClick={save}>Save</Btn>
        <Btn onClick={onDone}>Cancel</Btn>
      </div>
    </Card>
  );
}

export function OppsSection({ s, act }: { s: Snapshot; act: Act }) {
  const [editing, setEditing] = useState<Partial<AdminOpp> | null>(null);
  const [org, setOrg] = useState("");
  const [type, setType] = useState("");
  const list = useMemo(() => s.opps.filter((o) => (!org || o.orgId === org) && (!type || o.type === type)), [s.opps, org, type]);

  if (editing) return <OppEditor initial={editing} s={s} act={act} onDone={() => setEditing(null)} />;

  async function move(id: string, dir: -1 | 1) {
    const ids = s.opps.map((o) => o.id);
    const i = ids.indexOf(id);
    // Move past the neighbour that's visible under the current filter.
    const visible = list.map((o) => o.id);
    const vi = visible.indexOf(id);
    const other = visible[vi + dir];
    if (!other) return;
    const j = ids.indexOf(other);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await act({ action: "reorderOpps", ids });
  }

  return (
    <Card title={`Opportunities (${list.length})`} actions={<Btn kind="primary" small onClick={() => setEditing({ type: "gift", status: "draft", spots: 1, orgId: org || s.orgs[0]?.id })}>New opportunity</Btn>}>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Organization">
          <option value="">All organizations</option>
          {s.orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          <option value="volunteer">Volunteer</option>
          <option value="gift">Gift</option>
          <option value="cash">Cash</option>
        </select>
      </div>
      <ul className="space-y-2">
        {list.map((o, i) => (
          <li key={o.id} className="border border-gray-200 bg-white p-3 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={o.status === "live" ? (o.open ? "green" : "amber") : "gray"}>{o.status === "live" ? (o.open ? "On the tree" : o.left === 0 ? "All claimed" : "Past date") : o.status}</Badge>
              <Badge>{TYPE_LABEL[o.type]}</Badge>
              {o.isDemo && <Badge>Demo</Badge>}
              <span className="font-medium text-gray-800">{o.title}</span>
            </div>
            <p className="text-[12px] text-gray-500">
              {o.orgName}
              {o.type !== "cash" ? ` · ${o.taken} of ${o.spots} claimed` : ` · ${o.meterLabel} $${o.meterValue ?? 0} of $${o.goalAmount ?? 0}`}
              {` · takes claims through ${o.lastDay}`}
              {o.treeX != null ? " · placed by hand" : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Btn small onClick={() => setEditing(o)}>Edit</Btn>
              <Btn small onClick={() => act({ action: "duplicateOpp", id: o.id })}>Duplicate</Btn>
              {o.status !== "closed" ? <Btn small onClick={() => act({ action: "setOppStatus", id: o.id, status: "closed" })}>Close</Btn> : <Btn small onClick={() => act({ action: "setOppStatus", id: o.id, status: "live" })}>Reopen</Btn>}
              {o.status === "draft" && <Btn small onClick={() => act({ action: "setOppStatus", id: o.id, status: "live" })}>Put on tree</Btn>}
              <Btn small disabled={i === 0} onClick={() => move(o.id, -1)}>↑</Btn>
              <Btn small disabled={i === list.length - 1} onClick={() => move(o.id, 1)}>↓</Btn>
              <Btn small kind="danger" onClick={() => confirm(`Delete “${o.title}” and every pledge on it? This can't be undone.`) && act({ action: "deleteOpp", id: o.id })}>Delete</Btn>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─── Add a pledge manually ───────────────────────────────────────────────────

export function ManualSection({ s, act }: { s: Snapshot; act: Act }) {
  const [oppId, setOppId] = useState("");
  const [f, setF] = useState({ name: "", email: "", phone: "", anonymous: false, displayName: "", note: "", showGift: true, showAmount: true, hours: "", amount: "", markReceived: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const opp = s.opps.find((o) => o.id === oppId);
  const choices = s.opps.filter((o) => o.status !== "draft" && (o.type === "cash" || (o.left ?? 0) > 0));

  async function save() {
    setErr(null);
    setMsg(null);
    try {
      const r = await act({
        action: "manualPledge",
        pledge: {
          opportunityId: oppId,
          name: f.name,
          email: f.email || null,
          phone: f.phone || null,
          displayMode: f.anonymous ? "anonymous" : "named",
          displayName: f.anonymous ? null : f.displayName || f.name,
          note: f.note,
          showGift: f.showGift,
          showAmount: f.showAmount,
          hours: f.hours ? Number(f.hours) : null,
          amount: f.amount ? Number(f.amount) : null,
          markReceived: f.markReceived,
        },
      });
      setMsg(`Added. Code ${r.code}. It has a stocking and is in “Ornaments to write”.`);
      setF({ ...f, name: "", email: "", phone: "", displayName: "", note: "", hours: "", amount: "", markReceived: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    }
  }

  return (
    <Card title="Add a pledge manually">
      <p className="text-xs text-gray-500">For someone who gives in person. Email is optional here; if given, they get the confirmation email.</p>
      <Field label="Opportunity">
        <select className={inputCls} value={oppId} onChange={(e) => setOppId(e.target.value)}>
          <option value="">Pick one</option>
          {choices.map((o) => (
            <option key={o.id} value={o.id}>{TYPE_LABEL[o.type]}: {o.title} ({o.orgName}){o.isDemo ? " [demo]" : ""}</option>
          ))}
        </select>
      </Field>
      <Field label="Name"><Text value={f.name} onChange={(v) => setF({ ...f, name: v })} /></Field>
      <Field label="Email (optional)"><Text value={f.email} onChange={(v) => setF({ ...f, email: v })} inputMode="email" /></Field>
      {opp?.type === "volunteer" && <Field label="Phone"><Text value={f.phone} onChange={(v) => setF({ ...f, phone: v })} inputMode="tel" /></Field>}
      {opp?.type === "volunteer" && opp.hoursMode === "choose" && <Field label={`Hours (${opp.hoursMin}–${opp.hoursMax})`}><Text value={f.hours} onChange={(v) => setF({ ...f, hours: v })} inputMode="decimal" /></Field>}
      {opp?.type === "cash" && <Field label="Amount ($)"><Text value={f.amount} onChange={(v) => setF({ ...f, amount: v })} inputMode="decimal" /></Field>}
      <Check label="Anonymous on the tree" checked={f.anonymous} onChange={(v) => setF({ ...f, anonymous: v })} />
      {!f.anonymous && <Field label="Name on the stocking"><Text value={f.displayName} onChange={(v) => setF({ ...f, displayName: v })} placeholder={f.name} /></Field>}
      <Field label="Note (optional, 200 max)"><Area value={f.note} onChange={(v) => setF({ ...f, note: v.slice(0, 200) })} rows={2} /></Field>
      <Check label="Show what they gave on the stocking" checked={f.showGift} onChange={(v) => setF({ ...f, showGift: v })} />
      {opp?.type === "cash" && <Check label="Show the amount" checked={f.showAmount} onChange={(v) => setF({ ...f, showAmount: v })} />}
      {opp?.type === "gift" && <Check label="They brought the gift with them (mark received)" checked={f.markReceived} onChange={(v) => setF({ ...f, markReceived: v })} />}
      {err && <p className="text-xs text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      <Btn kind="primary" disabled={!oppId || !f.name} onClick={save}>Add pledge</Btn>
    </Card>
  );
}
