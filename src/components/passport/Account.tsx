"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InstallHint from "./InstallHint";
import { Button, C, Check, Field, Notice, inputCls, postJson, useBotFields } from "./ui";
import type { FriendsOverview, Me, NotifyPrefs } from "@/lib/passport/bible";
import Link from "next/link";
import { friendLink } from "@/lib/passport/social";

export default function Account({ me: initial, prefs, friends }: { me: Me; prefs?: NotifyPrefs | null; friends?: FriendsOverview | null }) {
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

      {friends && <FriendsBlock initial={friends} />}

      {prefs ? <Notifications initial={prefs} onNews={(on) => setMe({ ...me, member: { ...m, marketing_consent: on } })} /> : (
        <Block title="Email from Common Good">
          <Check checked={m.marketing_consent} onChange={setMarketing}>
            Send me occasional news and offers. {saving && <span style={{ color: C.faint }}>Saving…</span>}
          </Check>
          <p className="font-body text-xs leading-relaxed" style={{ color: C.faint }}>Account emails, like password resets, always come through.</p>
          {error && <Notice>{error}</Notice>}
        </Block>
      )}

      {showInstall
        ? <InstallHint force onClose={() => setShowInstall(false)} />
        : <button type="button" onClick={() => setShowInstall(true)} className="font-body text-sm underline underline-offset-4" style={{ color: C.text }}>Save Passport to your home screen</button>}

      <div className="pt-2">
        <Button type="button" kind="quiet" onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const hourWord = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
/**
 * File 08: Account → Notifications. A switch per kind, and one daily summary instead of separate emails. "Ready for
 * pickup" always sends. News from the bar is the same choice as "occasional news and offers".
 */
function Notifications({ initial, onNews }: { initial: NotifyPrefs; onNews: (on: boolean) => void }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (patch: Partial<NotifyPrefs>) => {
    const before = p;
    setP({ ...p, ...patch });
    setSaving(true);
    setError("");
    const r = await postJson<{ notify_prefs: NotifyPrefs }>("/api/passport/notifications", patch, "PUT");
    setSaving(false);
    if (r.ok) { setP(r.data.notify_prefs); if (patch.news !== undefined) onNews(r.data.notify_prefs.news); }
    else if (r.data.signed_out) router.refresh();
    else { setP(before); setError(r.data.error || "Couldn't save that. Please try again."); }
  };
  return (
    <Block title="Notifications">
      <p className="font-body text-xs leading-relaxed" style={{ color: C.faint }}>Email me when{saving && <span> · Saving…</span>}</p>
      <Check checked={p.messages} onChange={(v) => save({ messages: v })}>The bar replies to a message</Check>
      <Check checked={p.requests} onChange={(v) => save({ requests: v })}>Something changes on a request or event inquiry</Check>
      <Check checked={p.bottles} onChange={(v) => save({ bottles: v })}>There is news about a bottle request <span style={{ color: C.faint }}>(a bottle ready for pickup is always emailed)</span></Check>
      {p.friends !== undefined && <Check checked={!!p.friends} onChange={(v) => save({ friends: v })}>A friend sends me a request or a message <span style={{ color: C.faint }}>(who, never the words)</span></Check>}
      {p.comments !== undefined && <Check checked={!!p.comments} onChange={(v) => save({ comments: v })}>Comments: someone replies to my comment <span style={{ color: C.faint }}>(who and where, never the words)</span></Check>}
      {p.votes !== undefined && <Check checked={!!p.votes} onChange={(v) => save({ votes: v })}>Votes and brackets: a bracket I voted in opens its next round or has a winner <span style={{ color: C.faint }}>(at most one a day)</span></Check>}
      <Check checked={p.news} onChange={(v) => save({ news: v })}>News from the bar: occasional news and offers</Check>
      <div className="pt-2 border-t space-y-2" style={{ borderColor: C.line }}>
        <Check checked={p.digest} onChange={(v) => save({ digest: v })}>One daily summary instead of separate emails</Check>
        {p.digest && (
          <label className="flex items-center gap-3 font-body text-sm pl-[30px]" style={{ color: C.muted }}>
            Send it at
            <select value={p.digest_hour} onChange={(e) => save({ digest_hour: Number(e.target.value) })} className="rounded-lg px-3 py-2 bg-[#0E120B] border border-[#323B29] text-[#EDE6D3] text-[15px]">
              {HOURS.map((h) => <option key={h} value={h}>{hourWord(h)}</option>)}
            </select>
          </label>
        )}
      </div>
      <p className="font-body text-xs leading-relaxed" style={{ color: C.faint }}>Emails only say that something is waiting; read it in your Inbox. At most one an hour about the same conversation, and none while you have it open. Notifications on this phone are coming in a later update. Account emails, like password resets, always come through.</p>
      {error && <Notice>{error}</Notice>}
    </Block>
  );
}

/**
 * File 09: Friends in Account: the name friends see, the member's friend code (show it, copy the "add me" link, reset
 * it), "Let friends see when I'm at Common Good" (on by default), and who they blocked, with a way to the Friends page.
 */
function FriendsBlock({ initial }: { initial: FriendsOverview }) {
  const router = useRouter();
  const [s, setS] = useState(initial.settings);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [name, setName] = useState(initial.settings.display_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    const r = await postJson<{ settings?: FriendsOverview["settings"]; blocked?: FriendsOverview["blocked"] }>("/api/passport/friends", body);
    setBusy(false);
    if (r.ok) { if (r.data.settings) setS(r.data.settings); if (r.data.blocked) setBlocked(r.data.blocked); return true; }
    if (r.data.signed_out) router.refresh(); else setError(r.data.error || "Couldn't save that. Please try again.");
    return false;
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(friendLink(window.location.origin, s.friend_code)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError("Couldn't copy. Your code is " + s.friend_code); }
  };
  return (
    <Block title="Friends">
      <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>Friends see you as <span style={{ color: C.text }}>{s.shown_as}</span>. Never your email, phone, history or notes.</p>
      <Field label="Display name for friends" hint={`Leave it empty to show ${s.default_name}.`}>
        <div className="flex gap-2">
          <input className={inputCls} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder={s.default_name} />
          <button type="button" disabled={busy || name.trim() === s.display_name} onClick={() => call({ action: "settings", display_name: name.trim() })}
            className="shrink-0 rounded-lg border px-4 font-body text-[12px] tracking-[0.12em] uppercase disabled:opacity-40" style={{ borderColor: C.brass, color: C.brass }}>Save</button>
        </div>
      </Field>
      <div className="pt-1">
        <span className="block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>Your friend code</span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display text-[28px] tracking-[0.12em]" style={{ color: C.text }}>{s.friend_code}</span>
          <button type="button" onClick={copy} className="font-body text-sm underline" style={{ color: C.text }}>{copied ? "Link copied" : "Copy my link"}</button>
          <button type="button" disabled={busy} onClick={() => { if (confirm("Reset your friend code? The old code and link stop working.")) void call({ action: "code_reset" }); }} className="font-body text-sm underline" style={{ color: C.muted }}>Reset</button>
        </div>
        <p className="font-body text-xs mt-1" style={{ color: C.faint }}>Share it with people you want as friends on Passport. Anyone with it can send you a request.</p>
      </div>
      <Check checked={s.share_presence} onChange={(v) => call({ action: "settings", share_presence: v })}>Let friends see when I&rsquo;m at Common Good <span style={{ color: C.faint }}>(and that I&rsquo;m going to a Passport event)</span></Check>
      {blocked.length > 0 && (
        <div className="pt-1">
          <span className="block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5" style={{ color: C.muted }}>Blocked</span>
          <ul className="space-y-1.5">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between font-body text-[15px]" style={{ color: C.text }}>
                <span>{b.name}</span>
                <button type="button" disabled={busy} className="text-xs underline" style={{ color: C.muted }} onClick={() => call({ action: "unblock", id: b.id })}>Unblock</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <Notice>{error}</Notice>}
      <Link href="/passport/friends" scroll={false} className="inline-flex items-center gap-1.5 min-h-[44px] font-body text-sm underline underline-offset-4" style={{ color: C.text }}>
        Friends{initial.incoming.length ? ` · ${initial.incoming.length} request${initial.incoming.length === 1 ? "" : "s"} waiting` : ""} <span aria-hidden>→</span>
      </Link>
    </Block>
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
