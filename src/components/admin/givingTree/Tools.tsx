"use client";

// Bulk import (9.3), Exports (9.10), Settings (9.11), Demo tools (9.12),
// Close out season (9.13).

import { useState } from "react";
import type { Settings } from "@/lib/givingTree/types";
import { type Act, Area, Btn, Card, Check, Field, inputCls, type Snapshot, Text } from "./kit";

type Preview = {
  errors: string[];
  orgs: { slug: string; name: string; isDemo: boolean }[];
  opportunities: { row: number; orgSlug: string; type: string; title: string; isDemo: boolean }[];
  existingOrgSlugs: string[];
  duplicates: number[];
};

export function ImportSection({ act }: { act: Act }) {
  const [text, setText] = useState("");
  const [forceDemo, setForceDemo] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function parse(): unknown {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`That isn't valid JSON: ${e instanceof Error ? e.message : ""}`);
    }
  }

  async function check() {
    setErr(null);
    setDone(null);
    setPreview(null);
    try {
      setPreview((await act({ action: "previewImport", data: parse(), forceDemo }, { reload: false })) as unknown as Preview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function commit() {
    setErr(null);
    try {
      const r = (await act({ action: "commitImport", data: parse(), forceDemo })).result as Record<string, number>;
      setDone(`Done: ${r.orgsCreated} organizations created, ${r.orgsUpdated} updated, ${r.oppsCreated} opportunities created${r.skipped ? `, ${r.skipped} skipped as already on the site` : ""}.`);
      setPreview(null);
      setText("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    }
  }

  const counts = preview && {
    volunteer: preview.opportunities.filter((o) => o.type === "volunteer").length,
    gift: preview.opportunities.filter((o) => o.type === "gift").length,
    cash: preview.opportunities.filter((o) => o.type === "cash").length,
  };

  return (
    <Card title="Bulk import">
      <p className="text-xs text-gray-500">
        Paste or upload JSON in the same format as the demo seed file (an &ldquo;organizations&rdquo; list and an &ldquo;opportunities&rdquo; list). Nothing is
        written until you&rsquo;ve seen the preview. Organizations are matched by slug and updated; opportunities already on the site are skipped.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        className="text-xs"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setText(await f.text());
        }}
      />
      <Area value={text} onChange={setText} rows={8} />
      <Check label="Mark everything as demo data" checked={forceDemo} onChange={setForceDemo} />
      <div className="flex gap-2">
        <Btn onClick={check} disabled={!text.trim()}>Check and preview</Btn>
      </div>
      {err && <p className="text-xs text-red-600 whitespace-pre-line">{err}</p>}
      {done && <p className="text-sm text-green-700">{done}</p>}
      {preview && (
        <div className="space-y-2 text-sm">
          {preview.errors.length > 0 ? (
            <div className="border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-700">{preview.errors.length} problem{preview.errors.length === 1 ? "" : "s"} to fix. Nothing was imported.</p>
              <ul className="mt-2 list-disc pl-5 text-[12px] text-red-700 space-y-0.5">
                {preview.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border border-green-200 bg-green-50 p-3 space-y-1">
              <p>
                {preview.orgs.length} organizations ({preview.existingOrgSlugs.length} already here, will be updated) and {preview.opportunities.length} opportunities: {counts!.volunteer} volunteer,{" "}
                {counts!.gift} gift, {counts!.cash} cash.
                {preview.duplicates.length ? ` ${preview.duplicates.length} already on the site will be skipped.` : ""}
                {preview.opportunities.some((o) => o.isDemo) ? " Marked as demo." : ""}
              </p>
              <ul className="text-[12px] text-gray-600 max-h-48 overflow-y-auto">
                {preview.opportunities.map((o) => (
                  <li key={o.row} className={preview.duplicates.includes(o.row) ? "line-through text-gray-400" : ""}>
                    {o.orgSlug} · {o.type} · {o.title}
                  </li>
                ))}
              </ul>
              <Btn kind="primary" onClick={commit}>Import</Btn>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function ExportsSection({ s }: { s: Snapshot }) {
  const [org, setOrg] = useState(s.orgs[0]?.id ?? "");
  const [demo, setDemo] = useState(false);
  const base = "/api/admin/giving-tree/export";
  const d = demo ? "&demo=1" : "";
  return (
    <Card title="Exports (CSV)">
      <Field label="Volunteers for one organization" hint="Includes phone numbers. Send it to the organization's admin contact.">
        <div className="flex gap-2">
          <select className={inputCls} value={org} onChange={(e) => setOrg(e.target.value)}>
            {s.orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{o.adminContactEmail ? ` (${o.adminContactEmail})` : ""}</option>
            ))}
          </select>
          <a className="shrink-0 min-h-[44px] px-4 border border-gray-300 text-xs flex items-center" href={`${base}?kind=volunteers&org=${encodeURIComponent(org)}`}>
            Download
          </a>
        </div>
      </Field>
      <Check label="Include demo / sandbox pledges in the two exports below" checked={demo} onChange={setDemo} />
      <div className="flex flex-wrap gap-2">
        <a className="min-h-[44px] px-4 border border-gray-300 text-xs flex items-center" href={`${base}?kind=pledges${d}`}>All pledges</a>
        <a className="min-h-[44px] px-4 border border-gray-300 text-xs flex items-center" href={`${base}?kind=recap${d}`}>Recap list (name, email, what they gave)</a>
      </div>
    </Card>
  );
}

const SETTING_FIELDS: { key: keyof Settings; label: string; hint?: string; type?: string }[] = [
  { key: "seasonEnd", label: "Season end", type: "date", hint: "Gifts are due by then; opportunities with no deadline stop taking claims after it." },
  { key: "dueWindowDays", label: "Gift due window (days)" },
  { key: "reminderLeadDays", label: "Reminder (days before due)" },
  { key: "graceDays", label: "Grace before auto-release (days)" },
  { key: "amountThreshold", label: "Hold cash pledges above ($)" },
  { key: "capOpenGift", label: "Open gift pledges per email" },
  { key: "capOpenVolunteer", label: "Open volunteer pledges per email" },
  { key: "capCashPerDay", label: "Cash pledges per email per day" },
  { key: "ipPerHour", label: "Pledges per internet address per hour", hint: "Guests on the bar's Wi-Fi share one address. Raise this if real guests get blocked on a busy night." },
  { key: "contactEmail", label: "Contact email", hint: "Reply-to on every email, and shown to guests." },
];

export function SettingsSection({ s, act }: { s: Snapshot; act: Act }) {
  const [v, setV] = useState<Settings>(s.settings);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Card title="Settings">
      {SETTING_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint}>
          <Text type={f.type} inputMode={f.type ? undefined : f.key === "contactEmail" ? "email" : "decimal"} value={v[f.key] as string | number} onChange={(x) => setV({ ...v, [f.key]: x })} />
        </Field>
      ))}
      <Field label="Default drop-off instructions" hint="Used by any gift without its own.">
        <Area value={v.defaultDropoff} onChange={(x) => setV({ ...v, defaultDropoff: x })} rows={3} />
      </Field>
      <Btn
        kind="primary"
        onClick={async () => {
          try {
            await act({ action: "saveSettings", settings: v });
            setMsg("Saved.");
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Failed.");
          }
        }}
      >
        Save settings
      </Btn>
      {msg && <p className="text-xs text-gray-600">{msg}</p>}
    </Card>
  );
}

export function DemoSection({ s, act }: { s: Snapshot; act: Act }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const demoOrgs = s.orgs.filter((o) => o.isDemo).length;
  const demoOpps = s.opps.filter((o) => o.isDemo).length;
  const demoPledges = s.pledges.filter((p) => p.isDemo).length;
  const phones = s.pledges.filter((p) => p.phone).length;

  async function run(body: Record<string, unknown>, done: (r: Record<string, unknown>) => string) {
    setMsg(null);
    try {
      setMsg(done(await act(body)));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed.");
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Preview">
        <p className="text-sm text-gray-600">
          The Christmas pop-up is a draft. See it (with any demo data) in the sandbox:{" "}
          <a className="underline" href="/popup/preview/christmas" target="_blank" rel="noopener noreferrer">/popup/preview/christmas</a>. Going live is done from the Pop Ups list, like every
          other pop-up, and is refused while demo data exists.
        </p>
        {s.memoryMode && <p className="text-xs text-amber-700">Local test mode: data is kept in memory and disappears when the server restarts.</p>}
      </Card>
      <Card title="Demo data">
        <p className="text-sm text-gray-600">
          Made-up opportunities for three real organizations, for showing the flow before partners are confirmed. None of it has been agreed with them. Demo records
          only ever appear in the sandbox.
        </p>
        <p className="text-sm">
          Now: {demoOrgs} demo organizations, {demoOpps} demo opportunities, {demoPledges} demo or sandbox pledges.
        </p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => run({ action: "loadDemo" }, (r) => { const x = r.result as Record<string, number>; return `Loaded: ${x.orgsCreated + x.orgsUpdated} organizations, ${x.oppsCreated} opportunities${x.skipped ? ` (${x.skipped} already there)` : ""}.`; })}>
            Load demo data
          </Btn>
          <Btn kind="danger" disabled={!s.hasDemo} onClick={() => confirm("Delete all demo organizations, their opportunities, and every demo or sandbox pledge?") && run({ action: "wipeDemo" }, (r) => { const x = r.result as Record<string, number>; return `Wiped ${x.orgs} organizations, ${x.opps} opportunities, ${x.pledges} pledges.`; })}>
            Wipe demo data
          </Btn>
        </div>
      </Card>
      <Card title="Reminders and auto-release">
        <p className="text-sm text-gray-600">
          These run whenever the tree, the sky, this admin or a guest&rsquo;s link is opened (at most once a minute). Run them now by hand:
        </p>
        <Btn onClick={() => run({ action: "sweep" }, (r) => { const x = (r.report ?? {}) as Record<string, number>; return `Reminders sent ${x.reminded ?? 0}, released ${x.released ?? 0}, closed as not received ${x.notReceived ?? 0}, flagged overdue ${x.flagged ?? 0}.`; })}>
          Run now
        </Btn>
      </Card>
      <Card title="Close out season">
        <p className="text-sm text-gray-600">
          Take the exports first. This permanently deletes every phone number ({phones} stored). Guests were told at sign-up that phone numbers are deleted when the
          season ends. Type DELETE PHONES to confirm.
        </p>
        <input className={inputCls} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE PHONES" />
        <Btn kind="danger" disabled={confirmText !== "DELETE PHONES"} onClick={() => run({ action: "closeOut", confirm: confirmText }, (r) => `Deleted ${r.deleted} phone numbers.`)}>
          Delete all phone numbers
        </Btn>
      </Card>
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
