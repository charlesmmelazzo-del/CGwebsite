"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InstallHint from "./InstallHint";
import { Button, C, Check, Field, Notice, inputCls, postJson, useBotFields } from "./ui";
import type { Me } from "@/lib/passport/bible";

export default function Account({ me: initial }: { me: Me }) {
  const router = useRouter();
  const [me, setMe] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showInstall, setShowInstall] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [sentTo, setSentTo] = useState("");
  // Up to 3 people in a household, counting anyone invited who hasn't joined.
  const full = me.household.length >= 2;
  const m = me.member;

  const setMarketing = async (on: boolean) => {
    setSaving(true);
    setError("");
    const r = await postJson<Me>("/api/passport/me", { marketing_consent: on }, "PUT");
    setSaving(false);
    if (r.ok) setMe(r.data);
    else if (r.data.signed_out) router.refresh();
    else setError(r.data.error || "Couldn't save that. Please try again.");
  };

  const signOut = async () => {
    await postJson("/api/passport/signout", {});
    router.replace("/passport");
    router.refresh();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Your account</p>
        <h1 className="font-display text-4xl mt-1">{m.first_name} {m.last_name}</h1>
        {m.member_since && <p className="font-body text-sm mt-2" style={{ color: C.muted }}>Member since {new Date(m.member_since + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>}
      </div>

      <Block title="Contact">
        <Row label="Email" value={m.email} />
        <Row label="Phone" value={m.phone ? formatPhone(m.phone) : "Not added yet"} />
        <p className="font-body text-xs leading-relaxed pt-1" style={{ color: C.faint }}>To change these, message us or ask at the bar. They&rsquo;re how we match your visits to your Passport.</p>
      </Block>

      <Block title="Household">
        {me.household.length ? (
          <ul className="space-y-2">
            {me.household.map((h, i) => (
              <li key={i} className="flex items-center justify-between font-body text-[15px]">
                <span>{h.first_name} {h.last_name}</span>
                <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: h.status === "active" ? C.muted : C.brass }}>{h.status === "active" ? "Joined" : "Invited"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm" style={{ color: C.muted }}>Nobody else yet.</p>
        )}
        <p className="font-body text-xs leading-relaxed" style={{ color: C.faint }}>Everyone in a household has their own sign-in and sees only their own history and notes.</p>
        {sentTo && <Notice kind="ok">Invitation sent to {sentTo}.</Notice>}
        {full && m.can_invite_household && <p className="font-body text-xs" style={{ color: C.faint }}>A household can have up to 3 people.</p>}
        {m.can_invite_household && !full && (inviting
          ? <InviteForm onDone={(first) => { setSentTo(first); setInviting(false); }} onCancel={() => setInviting(false)} />
          : <button type="button" className="font-body text-sm underline underline-offset-4" style={{ color: C.text }} onClick={() => setInviting(true)}>+ Add someone in your household</button>)}
      </Block>

      <Block title="Email from Common Good">
        <Check checked={m.marketing_consent} onChange={setMarketing}>
          Send me occasional news and offers. {saving && <span style={{ color: C.faint }}>Saving…</span>}
        </Check>
        <p className="font-body text-xs leading-relaxed" style={{ color: C.faint }}>Account emails, like password resets, always come through.</p>
        {error && <Notice>{error}</Notice>}
      </Block>

      {showInstall
        ? <InstallHint force onClose={() => setShowInstall(false)} />
        : <button type="button" onClick={() => setShowInstall(true)} className="font-body text-sm underline underline-offset-4" style={{ color: C.text }}>Save Passport to your home screen</button>}

      <div className="pt-2">
        <Button type="button" kind="quiet" onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
}

function InviteForm({ onDone, onCancel }: { onDone: (firstName: string) => void; onCancel: () => void }) {
  const { trap, fields } = useBotFields();
  const [p, setP] = useState({ first_name: "", last_name: "", email: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await postJson("/api/passport/household", { ...p, ...fields() });
    setBusy(false);
    // The same "Invitation sent" whether or not they already have a Passport.
    if (r.ok) onDone(p.first_name.trim());
    else setError(r.data.error || "Couldn't send the invitation. Please try again.");
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4 relative" style={{ borderColor: C.line }} noValidate>
      {trap}
      <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>We&rsquo;ll email them a link to set up their own Passport and choose their own password.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><input className={inputCls} value={p.first_name} onChange={(e) => setP({ ...p, first_name: e.target.value })} /></Field>
        <Field label="Last name"><input className={inputCls} value={p.last_name} onChange={(e) => setP({ ...p, last_name: e.target.value })} /></Field>
      </div>
      <Field label="Their email"><input className={inputCls} type="email" inputMode="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
      {error && <Notice>{error}</Notice>}
      <Button busy={busy}>Send invitation</Button>
      <button type="button" onClick={onCancel} className="w-full font-body text-sm underline" style={{ color: C.muted }}>Cancel</button>
    </form>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5 space-y-3" style={{ borderColor: C.line, background: C.card }}>
      <h2 className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>{title}</h2>
      {children}
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 font-body">
      <span className="text-xs tracking-[0.15em] uppercase" style={{ color: C.faint }}>{label}</span>
      <span className="text-[15px] text-right break-all">{value || "—"}</span>
    </div>
  );
}
function formatPhone(p: string) {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}
