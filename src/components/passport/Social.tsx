"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { C, Check, Notice, inputCls, postJson } from "./ui";
import { BackLink } from "./bits";
import { notifyChanged } from "./appEvents";
import { useShell } from "./shellContext";
import { whenShort } from "@/lib/passport/inbox";
import { dayLong } from "@/lib/passport/shell";
import {
  ANSWERS, DM_MAX, LETSGO_NOTE_MAX, LETSGO_TIMES, LOOKUP_LINE, NOTE_MAX, POLL_MS, PRIVATE_LINE, SHARE_WORDS, answerWord, nextDays, shareHref, sortPlans,
} from "@/lib/passport/social";
import type { Conversation, DmPost, Friend, FriendsOverview, LetsGo, MemberNotice, Presence, ShareCard, ShareKind, SocialInbox } from "@/lib/passport/types";

/**
 * File 09: friends, direct messages, sharing, "Let's go" and "I'm here". Everything goes through the website's own
 * /api/passport routes, which act only for the signed-in member; the Bible decides who may see whom. Other members only
 * ever appear by their display name.
 */

const OFFLINE = "Couldn't do that. Please try again.";
const smallBtn = "rounded-full border px-4 min-h-[40px] font-body text-[12px] tracking-[0.12em] uppercase transition-colors disabled:opacity-50 pp-focus pp-press";
const kicker = "font-body text-[10px] tracking-[0.25em] uppercase";
const heading = "font-body text-[11px] tracking-[0.3em] uppercase mb-3";
const labelCls = "block font-body text-[11px] tracking-[0.2em] uppercase mb-1.5";

function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = useCallback(async <T,>(url: string, body: unknown, method = "POST"): Promise<T | null> => {
    setBusy(true);
    setError("");
    const r = await postJson<T>(url, body, method);
    setBusy(false);
    if (r.ok) return r.data;
    if (r.data.signed_out) { router.refresh(); return null; }
    setError(r.data.error || OFFLINE);
    return null;
  }, [router]);
  return { send, busy, error, setError };
}
function Pill({ on, children, onClick, disabled }: { on: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled} className="rounded-full border px-3.5 min-h-[40px] font-body text-[14px] pp-focus pp-press disabled:opacity-50"
      style={{ borderColor: on ? C.brass : C.line, color: on ? C.bg : C.text, background: on ? C.brass : "transparent" }}>{children}</button>
  );
}
/**
 * A sheet that slides up over the app (phones) or sits in the middle (wide screens). Drawn at the top of the page (a
 * portal), so it sits above the tab bar even when it opens from a page that slides over a tab.
 */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!host) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl border p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]" style={{ background: C.bg, borderColor: C.line }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-[26px] leading-tight" style={{ color: C.text }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 -mt-1 rounded-full flex items-center justify-center pp-focus" style={{ color: C.muted }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    host,
  );
}

// ── Home: the two round buttons, friends here, plans, shared with you ─────────
const HERE_SEEN = "pp-here-explained";
/** "I'm at Common Good" and "Let's go": the two round buttons at the top of Home (file 06 kept their place). */
export function HereButtons({ presence, hasFriends }: { presence?: Presence | null; hasFriends?: boolean }) {
  const shell = useShell();
  const { send, busy, error, setError } = useSend();
  const [p, setP] = useState(presence ?? null);
  const [explain, setExplain] = useState(false);
  useEffect(() => { setP(presence ?? null); }, [presence]);
  if (!p) return null;
  const tapHere = async () => {
    if (p.here) {
      const out = await send<{ presence: Presence }>("/api/passport/meetups", { what: "left" });
      if (out) { setP(out.presence); shell?.toast("You've left. Friends no longer see you here."); }
      return;
    }
    let seen = false;
    try { seen = localStorage.getItem(HERE_SEEN) === "1"; } catch { /* private mode */ }
    if (!seen || !p.share_presence) { setError(""); setExplain(true); return; }
    await checkIn();
  };
  const checkIn = async (turnOn = false) => {
    if (turnOn) {
      const s = await send<{ settings: { share_presence: boolean } }>("/api/passport/friends", { action: "settings", share_presence: true });
      if (!s) return;
    }
    const out = await send<{ presence: Presence }>("/api/passport/meetups", { what: "here" });
    if (out) {
      try { localStorage.setItem(HERE_SEEN, "1"); } catch { /* private mode */ }
      setP(out.presence);
      setExplain(false);
      shell?.toast("Friends can see you're at Common Good.");
      notifyChanged("inbox");
    }
  };
  const round = "w-[76px] h-[76px] rounded-full flex flex-col items-center justify-center gap-0.5 border pp-focus pp-press shrink-0";
  return (
    <section aria-label="I'm at Common Good, and Let's go" className="mt-6">
      <div className="flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-1.5">
          <button type="button" onClick={tapHere} disabled={busy} aria-pressed={p.here} className={round}
            style={{ borderColor: C.brass, background: p.here ? C.brass : "transparent", color: p.here ? C.bg : C.brass }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
          </button>
          <span className="font-body text-[11px] tracking-[0.14em] uppercase text-center" style={{ color: p.here ? C.brass : C.muted }}>{p.here ? "I've left" : "I'm here"}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Link href="/passport/letsgo" scroll={false} className={round} style={{ borderColor: C.line, color: C.text }} aria-label="Let's go to Common Good with friends">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 4.5h10l-5 7z" /><path d="M12 11.5V18M9 19.5h6" /><path d="M18.5 7.5l2-2M20.5 10h-2" /></svg>
          </Link>
          <span className="font-body text-[11px] tracking-[0.14em] uppercase" style={{ color: C.muted }}>Let&rsquo;s go</span>
        </div>
      </div>
      {p.here && p.until && <p className="font-body text-xs text-center mt-3" style={{ color: C.faint }}>Friends see you here until {new Date(p.until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}, or until you tap I&rsquo;ve left.</p>}
      {error && !explain && <div className="mt-3"><Notice>{error}</Notice></div>}
      {explain && (
        <Sheet title="I'm at Common Good" onClose={() => setExplain(false)}>
          <p className="font-body text-[15px] leading-relaxed" style={{ color: C.text }}>Your friends on Passport will see that you&rsquo;re at Common Good, on their Home, until closing time or until you tap I&rsquo;ve left (at most six hours).</p>
          <p className="font-body text-sm leading-relaxed mt-3" style={{ color: C.muted }}>Only friends see it, and only while &ldquo;Let friends see when I&rsquo;m at Common Good&rdquo; is on in your account. Our team can see who has checked in. Nothing checks where you are.</p>
          {!hasFriends && <p className="font-body text-sm mt-3" style={{ color: C.faint }}>You have no friends on Passport yet. <Link href="/passport/friends" scroll={false} className="underline" style={{ color: C.text }}>Add a friend</Link></p>}
          {error && <div className="mt-3"><Notice>{error}</Notice></div>}
          <button type="button" disabled={busy} onClick={() => checkIn(!p.share_presence)} className={`${smallBtn} w-full mt-5`} style={{ borderColor: C.brass, background: C.brass, color: C.bg }}>
            {busy ? "One moment…" : p.share_presence ? "I'm here" : "Turn it on and check in"}
          </button>
        </Sheet>
      )}
    </section>
  );
}

/** "{name} is at Common Good": friends who checked in and let friends see it. */
export function FriendsHere({ friends }: { friends?: { name: string }[] | null }) {
  if (!friends?.length) return null;
  return (
    <section aria-labelledby="pp-here" className="mt-8">
      <h2 id="pp-here" className={heading} style={{ color: C.brass }}>At Common Good now</h2>
      <ul className="space-y-2">
        {friends.map((f, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
            <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ background: "#86C07A" }} />
            <span className="font-body text-[15px]" style={{ color: C.text }}><span className="font-display text-[19px]">{f.name}</span> is at Common Good</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Let's go plans: friends' plans with In / Maybe / Can't, and the member's own with each friend's answer. */
export function LetsGoCards({ plans }: { plans?: LetsGo[] | null }) {
  const [list, setList] = useState(plans ?? []);
  const { send, busy, error } = useSend();
  useEffect(() => { setList(plans ?? []); }, [plans]);
  if (!list.length) return null;
  const answer = async (l: LetsGo, a: string) => {
    const out = await send<{ letsgo: LetsGo }>("/api/passport/meetups", { what: "answer", id: l.id, answer: a });
    if (out) setList((x) => x.map((y) => (y.id === l.id && !y.mine ? out.letsgo : y)));
  };
  const cancel = async (l: LetsGo) => {
    if (!confirm("Cancel this plan? Your friends will no longer see it.")) return;
    const out = await send("/api/passport/meetups", { what: "cancel", id: l.id });
    if (out) setList((x) => x.filter((y) => !(y.mine && y.id === l.id)));
  };
  return (
    <section aria-labelledby="pp-letsgo" className="mt-8">
      <h2 id="pp-letsgo" className={heading} style={{ color: C.brass }}>Let&rsquo;s go</h2>
      <ul className="space-y-3">
        {sortPlans(list).map((l) => (
          <li key={`${l.mine ? "m" : "f"}${l.id}`} className="rounded-xl border p-4" style={{ borderColor: l.mine ? C.line : `${C.brass}80`, background: l.mine ? C.card : "#1a1f14" }}>
            <span className={`block ${kicker}`} style={{ color: C.brass }}>{l.mine ? "Your plan" : `${l.from_name} is going to Common Good`}</span>
            <span className="block font-display text-[21px] leading-tight mt-1" style={{ color: C.text }}>{dayLong(l.day)} · {l.time_label}</span>
            {l.note && <span className="block font-body text-[14px] mt-1" style={{ color: C.muted }}>&ldquo;{l.note}&rdquo;</span>}
            {l.mine ? (
              <>
                <ul className="mt-2 space-y-0.5">
                  {(l.answers || []).map((a, i) => <li key={i} className="font-body text-[14px]" style={{ color: C.text }}>{a.name} · <span style={{ color: a.answer === "in" ? C.brass : C.muted }}>{answerWord(a.answer)}</span></li>)}
                </ul>
                <button type="button" disabled={busy} onClick={() => cancel(l)} className="mt-2 font-body text-xs underline" style={{ color: C.muted }}>Cancel plan</button>
              </>
            ) : (
              <>
                <div className="flex gap-2 mt-3" role="group" aria-label="Your answer">
                  {ANSWERS.map((a) => <Pill key={a.id} on={l.my_answer === a.id} disabled={busy} onClick={() => answer(l, a.id)}>{a.label}</Pill>)}
                </div>
                {(l.in_count || l.maybe_count) ? <span className="block font-body text-xs mt-2" style={{ color: C.faint }}>{l.in_count || 0} in · {l.maybe_count || 0} maybe</span> : null}
              </>
            )}
            <span className="block font-body text-xs mt-3" style={{ color: C.faint }}>Not a reservation. <a href="/reserve" className="underline" style={{ color: C.text }}>Book a table</a></span>
          </li>
        ))}
      </ul>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
    </section>
  );
}

/** Home's "Shared with you": what friends shared, newest first; each opens only what the member may open. */
export function SharedWithYou({ shared }: { shared?: ShareCard[] | null }) {
  const [gone, setGone] = useState<Set<number>>(() => new Set());
  const shown = (shared || []).filter((s) => !gone.has(s.id));
  if (!shown.length) return null;
  const dismiss = async (id: number) => {
    setGone((g) => new Set(g).add(id));
    const r = await postJson(`/api/passport/shares/${id}`, { action: "dismiss" });
    if (!r.ok) setGone((g) => { const n = new Set(g); n.delete(id); return n; });
  };
  return (
    <section aria-labelledby="pp-shared" className="mt-10">
      <h2 id="pp-shared" className={heading} style={{ color: C.brass }}>Shared with you</h2>
      <ul className="space-y-3">{shown.map((s) => <li key={s.id} className="relative"><ShareCardView s={s} /><span className="absolute top-1 right-1"><button type="button" onClick={() => dismiss(s.id)} aria-label={`Dismiss ${s.name}`} className="w-11 h-11 rounded-full flex items-center justify-center pp-focus" style={{ color: C.faint }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg></button></span></li>)}</ul>
    </section>
  );
}
export function ShareCardView({ s, inThread = false }: { s: ShareCard; inThread?: boolean }) {
  const href = shareHref(s);
  const inner = (
    <>
      <span className={`block ${kicker}`} style={{ color: C.brass }}>{inThread ? SHARE_WORDS[s.kind] : `${SHARE_WORDS[s.kind]} from ${s.from_name || "a friend"}`}</span>
      <span className="block font-display text-[20px] leading-tight mt-1 pr-8" style={{ color: C.text }}>{s.name}</span>
      {s.note && !inThread && <span className="block font-body text-[14px] mt-1" style={{ color: C.muted }}>&ldquo;{s.note}&rdquo;</span>}
      {!s.opens && <span className="block font-body text-xs mt-1" style={{ color: C.faint }}>This isn&rsquo;t available to open right now.</span>}
    </>
  );
  const cls = "block rounded-xl border p-4 pp-focus";
  const style = { borderColor: C.line, background: C.card };
  return href ? <Link href={href} scroll={false} className={`${cls} pp-row`} style={style}>{inner}</Link> : <div className={cls} style={style}>{inner}</div>;
}

// ── Share with a friend ──────────────────────────────────────────────────────
/** "Share with a friend" on a cocktail, bottle, house list, the member's own list or recipe, or a Passport event. */
export function ShareButton({ kind, id, name, compact = false }: { kind: ShareKind; id: number; name: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={compact ? "font-body text-xs underline" : "inline-flex items-center gap-2 rounded-full border px-4 min-h-[44px] font-body text-[12px] tracking-[0.12em] uppercase pp-focus pp-press"}
        style={compact ? { color: C.muted } : { borderColor: C.line, color: C.text }}>
        {!compact && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></svg>}
        {kind === "event" ? "Invite friends" : "Share with a friend"}
      </button>
      {open && <ShareSheet kind={kind} id={id} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
function ShareSheet({ kind, id, name, onClose }: { kind: ShareKind; id: number; name: string; onClose: () => void }) {
  const shell = useShell();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [pick, setPick] = useState<Set<number>>(() => new Set());
  const [note, setNote] = useState("");
  const { send, busy, error, setError } = useSend();
  useEffect(() => {
    let off = false;
    fetch("/api/passport/friends", { cache: "no-store" }).then((r) => r.json()).then((d: FriendsOverview & { error?: string }) => {
      if (off) return;
      if (d.error) { setError(d.error); setFriends([]); return; }
      setFriends(d.friends || []);
      setMuted(!!d.limits?.muted);
    }).catch(() => { if (!off) { setError(OFFLINE); setFriends([]); } });
    return () => { off = true; };
  }, [setError]);
  const toggle = (fid: number) => setPick((p) => { const n = new Set(p); if (n.has(fid)) n.delete(fid); else n.add(fid); return n; });
  const go = async () => {
    const out = await send<{ count: number }>("/api/passport/share", { kind, id, to: Array.from(pick), note });
    if (out) { shell?.toast(`Shared with ${out.count} friend${out.count === 1 ? "" : "s"}.`); notifyChanged("inbox"); onClose(); }
  };
  return (
    <Sheet title={kind === "event" ? "Invite friends" : "Share with a friend"} onClose={onClose}>
      <p className="font-body text-sm" style={{ color: C.muted }}>{name}</p>
      {kind === "list" && <p className="font-body text-xs mt-1" style={{ color: C.faint }}>They get a copy they can save. Your stars and notes stay private.</p>}
      {friends === null && <p className="font-body text-sm mt-4" style={{ color: C.faint }}>One moment…</p>}
      {friends && !friends.length && !error && <p className="font-body text-sm mt-4" style={{ color: C.muted }}>Add a friend first. <Link href="/passport/friends" scroll={false} className="underline" style={{ color: C.text }} onClick={onClose}>Friends</Link></p>}
      {muted && <div className="mt-4"><Notice>You can&rsquo;t share with friends right now.</Notice></div>}
      {!!friends?.length && !muted && (
        <>
          <ul className="mt-4 divide-y rounded-xl border" style={{ borderColor: C.line }}>
            {friends.map((f) => (
              <li key={f.id} style={{ borderColor: C.line }}>
                <label className="flex items-center gap-3 px-4 min-h-[52px] cursor-pointer font-body text-[15px]" style={{ color: C.text }}>
                  <input type="checkbox" className="w-[18px] h-[18px] accent-[#C9A96E]" checked={pick.has(f.id)} onChange={() => toggle(f.id)} />
                  <span className="flex-1">{f.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <label className="block mt-4">
            <span className={labelCls} style={{ color: C.muted }}>A note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} className={inputCls} placeholder="You have to try this" />
          </label>
          <p className="font-body text-xs mt-2" style={{ color: C.faint }}>{PRIVATE_LINE}</p>
          {error && <div className="mt-3"><Notice>{error}</Notice></div>}
          <button type="button" disabled={busy || !pick.size} onClick={go} className={`${smallBtn} w-full mt-4`} style={{ borderColor: C.brass, background: C.brass, color: C.bg }}>
            {busy ? "Sharing…" : `Share${pick.size ? ` with ${pick.size}` : ""}`}
          </button>
        </>
      )}
      {error && !friends?.length && <div className="mt-3"><Notice>{error}</Notice></div>}
    </Sheet>
  );
}

/** A shared copy of a friend's list or recipe (never their stars, notes or history). A list can be saved as one's own. */
export function SharedView({ initial }: { initial: ShareCard }) {
  const shell = useShell();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const { send, busy, error } = useSend();
  const save = async () => {
    const out = await send<{ list: { id: number } }>(`/api/passport/shares/${s.id}`, { action: "save" });
    if (out) { setS({ ...s, saved: true }); notifyChanged("lists"); shell?.toast("Saved to your lists."); router.push(`/passport/lists/${out.list.id}`, { scroll: false }); }
  };
  return (
    <div className="pb-16">
      <BackLink fallback="/passport" label="Home" />
      <p className="font-body text-[11px] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>{SHARE_WORDS[s.kind]}{s.from_name ? ` from ${s.from_name}` : ""}</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>{s.name}</h1>
      {s.note && <p className="font-body text-[15px] mt-3" style={{ color: C.muted }}>&ldquo;{s.note}&rdquo;</p>}
      {s.list && (
        <>
          <ol className="mt-6">
            {s.list.items.map((it, i) => (
              <li key={i} className="flex items-baseline gap-3 py-3 border-b" style={{ borderColor: C.line }}>
                {s.list!.ranked && <span className="font-display text-xl w-6 text-right" style={{ color: C.brass }}>{i + 1}</span>}
                {it.opens && it.id
                  ? <Link href={it.kind === "cocktail" ? `/passport/library/${it.id}` : `/passport/spirits/${it.id}`} scroll={false} className="font-body text-[16px] underline-offset-4 hover:underline pp-focus" style={{ color: C.text }}>{it.name}</Link>
                  : <span className="font-body text-[16px]" style={{ color: C.muted }}>{it.name}</span>}
              </li>
            ))}
          </ol>
          {s.from === "friend" && (s.saved
            ? <p className="font-body text-sm mt-6" style={{ color: C.muted }}>Saved to your lists. Later changes to {s.from_name}&rsquo;s list don&rsquo;t follow.</p>
            : <button type="button" disabled={busy} onClick={save} className={`${smallBtn} mt-6`} style={{ borderColor: C.brass, background: C.brass, color: C.bg }}>{busy ? "Saving…" : "Save a copy to my lists"}</button>)}
        </>
      )}
      {s.recipe && (
        <div className="mt-6 rounded-xl border p-5" style={{ borderColor: C.line, background: C.card }}>
          {s.recipe.made_by && <p className="font-body text-[11px] tracking-[0.15em] uppercase" style={{ color: C.brass }}>Made for {s.from_name || "them"} by {s.recipe.made_by} at Common Good</p>}
          <ul className="mt-2 space-y-1.5">
            {s.recipe.lines.map((l, i) => (
              <li key={i} className="font-body text-[15px]" style={{ color: C.text }}>{[l.quantity, l.unit, l.name].filter(Boolean).join(" ")}{l.sub_recipe && <span className="block text-sm ml-4" style={{ color: C.muted }}>{l.sub_recipe}</span>}</li>
            ))}
          </ul>
          {s.recipe.notes && <p className="font-body text-sm mt-3 whitespace-pre-wrap" style={{ color: C.muted }}>{s.recipe.notes}</p>}
        </div>
      )}
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}
    </div>
  );
}

// ── Friends (the page, from Account and the Inbox) ───────────────────────────
type FindHow = "email" | "phone" | "code";
export function FriendsPage({ initial, code = "" }: { initial: FriendsOverview; code?: string }) {
  const shell = useShell();
  const [d, setD] = useState(initial);
  const [how, setHow] = useState<FindHow>(code ? "code" : "email");
  const [value, setValue] = useState(code);
  const [sentMsg, setSentMsg] = useState("");
  const { send, busy, error, setError } = useSend();
  const act = async (body: Record<string, unknown>, done?: string) => {
    const out = await send<FriendsOverview>("/api/passport/friends", body);
    if (out) { setD(out); if (done) shell?.toast(done); notifyChanged("inbox"); }
    return out;
  };
  const reload = async () => {
    const r = await fetch("/api/passport/friends", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r && r.friends) setD(r);
  };
  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setSentMsg("");
    const out = await send<{ message: string }>("/api/passport/friends", { action: "find", [how]: value });
    if (out) { setSentMsg(out.message); setValue(""); void reload(); }
  };
  const confirmDo = (msg: string, body: Record<string, unknown>, done: string) => { if (confirm(msg)) void act(body, done); };
  return (
    <div className="pb-16 space-y-8">
      <div>
        <BackLink fallback="/passport/account" label="Account" />
        <p className="font-body text-[11px] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Passport</p>
        <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>Friends</h1>
        <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>Friends see your display name ({d.settings.shown_as}), can message you, share with you, and see your plans and when you&rsquo;re here. Never your email, phone, history or notes.</p>
      </div>

      {d.incoming.length > 0 && (
        <section aria-labelledby="pp-requests">
          <h2 id="pp-requests" className={heading} style={{ color: C.brass }}>Friend requests</h2>
          <ul className="space-y-3">
            {d.incoming.map((r) => (
              <li key={r.id} className="rounded-xl border p-4" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
                <span className="block font-display text-[21px]" style={{ color: C.text }}>{r.name}</span>
                <span className="block font-body text-xs mt-0.5" style={{ color: C.faint }}>{whenShort(r.at)}</span>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button type="button" disabled={busy} className={smallBtn} style={{ borderColor: C.brass, background: C.brass, color: C.bg }} onClick={() => act({ action: "accept", id: r.id }, `You and ${r.name} are friends.`)}>Accept</button>
                  <button type="button" disabled={busy} className={smallBtn} style={{ borderColor: C.line, color: C.text }} onClick={() => act({ action: "decline", id: r.id }, "Declined. They won't be told.")}>Decline</button>
                  <button type="button" disabled={busy} className={smallBtn} style={{ borderColor: C.line, color: C.muted }} onClick={() => confirmDo(`Block ${r.name}? They won't be told, and can no longer find you, message you or share with you.`, { action: "block", target: `ask:${r.id}` }, "Blocked.")}>Block</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pp-add" className="rounded-xl border p-5" style={{ borderColor: C.line, background: C.card }}>
        <h2 id="pp-add" className={heading} style={{ color: C.brass }}>Add a friend</h2>
        <form onSubmit={find} className="space-y-3" noValidate>
          <div className="flex gap-2" role="group" aria-label="Find them by">
            {(["email", "phone", "code"] as FindHow[]).map((h) => <Pill key={h} on={how === h} onClick={() => { setHow(h); setValue(""); setError(""); }}>{h === "email" ? "Email" : h === "phone" ? "Phone" : "Friend code"}</Pill>)}
          </div>
          <label className="block">
            <span className="sr-only">{how === "email" ? "Their exact email address" : how === "phone" ? "Their phone number" : "Their friend code"}</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} autoComplete="off" spellCheck={false}
              type={how === "email" ? "email" : how === "phone" ? "tel" : "text"} inputMode={how === "email" ? "email" : how === "phone" ? "tel" : "text"}
              placeholder={how === "email" ? "Their exact email address" : how === "phone" ? "(312) 555-0123" : "ABCD-2345"} />
          </label>
          <button type="submit" disabled={busy || !value.trim()} className={`${smallBtn} w-full`} style={{ borderColor: C.brass, background: C.brass, color: C.bg }}>{busy ? "One moment…" : "Send friend request"}</button>
          {sentMsg && <Notice kind="ok">{sentMsg}</Notice>}
          {error && <Notice>{error}</Notice>}
          <p className="font-body text-xs leading-relaxed" style={{ color: C.faint }}>{LOOKUP_LINE} There is no member directory.</p>
        </form>
      </section>

      {d.suggested.length > 0 && (
        <section aria-labelledby="pp-suggested">
          <h2 id="pp-suggested" className={heading} style={{ color: C.brass }}>In your household</h2>
          <ul className="space-y-2">
            {d.suggested.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: C.line }}>
                <span className="font-body text-[15px]" style={{ color: C.text }}>{s.name}</span>
                <button type="button" disabled={busy} className={smallBtn} style={{ borderColor: C.line, color: C.text }} onClick={async () => { const o = await send<{ message: string }>("/api/passport/friends", { action: "suggested", id: s.id }); if (o) { shell?.toast("Request sent."); void reload(); } }}>Add</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="pp-friends">
        <h2 id="pp-friends" className={heading} style={{ color: C.brass }}>Your friends{d.friends.length ? ` · ${d.friends.length}` : ""}</h2>
        {!d.friends.length && <p className="font-body text-sm" style={{ color: C.muted }}>When someone accepts your request, they show here.</p>}
        <ul>
          {d.friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-3 border-b" style={{ borderColor: C.line }}>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 font-display text-[20px]" style={{ color: C.text }}>{f.name}{f.here && <span className="font-body text-[10px] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border" style={{ color: "#86C07A", borderColor: "#86C07A66" }}>Here now</span>}{f.unread && <span aria-label="Unread" className="w-2 h-2 rounded-full" style={{ background: C.accent }} />}</span>
              </span>
              <Link href={f.conversation_id ? `/passport/inbox/friends/${f.conversation_id}` : `/passport/inbox/friends/new?friend=${f.id}`} scroll={false} className={smallBtn} style={{ borderColor: C.line, color: C.text }}>Message</Link>
              <FriendMenu f={f} busy={busy} onAct={(body, done) => act(body, done)} />
            </li>
          ))}
        </ul>
      </section>

      {d.sent.length > 0 && (
        <section aria-labelledby="pp-sent">
          <h2 id="pp-sent" className={heading} style={{ color: C.brass }}>Requests you sent</h2>
          <ul>
            {d.sent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-b font-body text-[14px]" style={{ borderColor: C.line, color: C.muted }}>
                <span className="min-w-0 truncate">{a.via === "code" ? `Friend code ${a.typed}` : a.typed} · Request sent</span>
                <button type="button" disabled={busy} className="underline text-xs shrink-0" style={{ color: C.muted }} onClick={() => act({ action: "withdraw", id: a.id })}>Withdraw</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.blocked.length > 0 && (
        <section aria-labelledby="pp-blocked">
          <h2 id="pp-blocked" className={heading} style={{ color: C.brass }}>Blocked</h2>
          <ul>
            {d.blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 border-b font-body text-[14px]" style={{ borderColor: C.line, color: C.text }}>
                <span>{b.name}</span>
                <button type="button" disabled={busy} className="underline text-xs" style={{ color: C.muted }} onClick={() => act({ action: "unblock", id: b.id }, "Unblocked. You aren't friends again unless one of you asks.")}>Unblock</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="font-body text-xs" style={{ color: C.faint }}>Your display name, friend code and &ldquo;Let friends see&rdquo; switch are in <Link href="/passport/account" scroll={false} className="underline" style={{ color: C.text }}>your account</Link>.</p>
    </div>
  );
}
function FriendMenu({ f, busy, onAct }: { f: Friend; busy: boolean; onAct: (body: Record<string, unknown>, done?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  return (
    <span className="relative">
      <button type="button" aria-label={`More for ${f.name}`} aria-expanded={open} onClick={() => setOpen(!open)} className="w-11 h-11 rounded-full flex items-center justify-center pp-focus" style={{ color: C.muted }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
      </button>
      {open && (
        <span className="absolute right-0 top-11 z-20 w-48 rounded-xl border py-1 shadow-xl" style={{ background: C.card, borderColor: C.line }}>
          <button type="button" disabled={busy} className="block w-full text-left px-4 py-2.5 font-body text-sm" style={{ color: C.text }} onClick={() => { setOpen(false); if (confirm(`Remove ${f.name} as a friend? Your conversation ends for both of you.`)) onAct({ action: "remove", target: `friend:${f.id}` }, "Removed."); }}>Remove friend</button>
          <button type="button" disabled={busy} className="block w-full text-left px-4 py-2.5 font-body text-sm" style={{ color: C.text }} onClick={() => { setOpen(false); if (confirm(`Block ${f.name}? They won't be told, and can no longer find you, message you or share with you.`)) onAct({ action: "block", target: `friend:${f.id}` }, "Blocked."); }}>Block</button>
          <button type="button" className="block w-full text-left px-4 py-2.5 font-body text-sm" style={{ color: C.accent }} onClick={() => { setOpen(false); setReporting(true); }}>Report</button>
        </span>
      )}
      {reporting && <ReportSheet target={`friend:${f.id}`} name={f.name} onClose={() => setReporting(false)} />}
    </span>
  );
}
/** Report a person or one message, with an optional reason. Admins see it at once. */
function ReportSheet({ target, messageId, conversationId, name, onClose }: { target?: string; messageId?: number; conversationId?: number; name: string; onClose: () => void }) {
  const shell = useShell();
  const [reason, setReason] = useState("");
  const { send, busy, error } = useSend();
  const go = async () => {
    const out = conversationId
      ? await send(`/api/passport/conversations/${conversationId}`, { action: "report", message_id: messageId, reason })
      : await send("/api/passport/friends", { action: "report", target, reason });
    if (out) { shell?.toast("Thank you. Our team will look at it."); onClose(); }
  };
  return (
    <Sheet title={messageId ? "Report this message" : `Report ${name}`} onClose={onClose}>
      <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>Our team will see {messageId ? "this message and a few around it" : "your report"}. {name} won&rsquo;t be told who reported it. You can also block them.</p>
      <label className="block mt-4">
        <span className={labelCls} style={{ color: C.muted }}>Why (optional)</span>
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
      </label>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <button type="button" disabled={busy} onClick={go} className={`${smallBtn} w-full mt-4`} style={{ borderColor: C.accent, color: C.accent }}>{busy ? "Sending…" : "Send report"}</button>
    </Sheet>
  );
}

// ── One conversation with a friend ───────────────────────────────────────────
export function ConversationView({ initial, friendId, friendName = "" }: { initial: Conversation | null; friendId?: number; friendName?: string }) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState<{ id?: number } | null>(null);
  const { send, busy, error } = useSend();
  const end = useRef<HTMLLIElement>(null);
  const id = c?.id;
  useEffect(() => {
    if (!id) return;
    notifyChanged("inbox");
    let off = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/passport/conversations/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (!off && d.conversation) setC(d.conversation);
      } catch { /* offline */ }
    };
    const t = setInterval(load, POLL_MS);
    const vis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { off = true; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [id]);
  const count = c?.posts?.length || 0;
  useEffect(() => { if (count) end.current?.scrollIntoView({ block: "nearest" }); }, [count]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const out = c
      ? await send<{ conversation: Conversation }>(`/api/passport/conversations/${c.id}`, { action: "send", body: text })
      : await send<{ conversation: Conversation }>("/api/passport/conversations", { friend_id: friendId, body: text });
    if (out) {
      setText("");
      if (!c) router.replace(`/passport/inbox/friends/${out.conversation.id}`, { scroll: false });
      setC(out.conversation);
      notifyChanged("inbox");
    }
  };
  if (c && !c.available) {
    return (
      <div className="pb-16">
        <BackLink fallback="/passport/inbox" label="Inbox" />
        <h1 className="font-display text-3xl mt-3" style={{ color: C.text }}>Conversation</h1>
        <p className="font-body text-[15px] mt-4" style={{ color: C.muted }}>This conversation is no longer available.</p>
      </div>
    );
  }
  return (
    <div className="pb-16">
      <BackLink fallback="/passport/inbox" label="Inbox" />
      <p className="font-body text-[11px] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Friend{c?.here ? " · at Common Good now" : ""}</p>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl leading-tight mt-1" style={{ color: C.text }}>{c?.name || friendName || "New message"}</h1>
        {c && <button type="button" onClick={() => setReporting({})} className="font-body text-xs underline mt-3 shrink-0" style={{ color: C.muted }}>Report</button>}
      </div>
      <ul className="space-y-3 mt-6" aria-live="polite">
        {(c?.posts || []).map((p: DmPost) => {
          const mine = p.from === "me";
          return (
            <li key={p.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5" style={mine ? { background: "#2a3220", color: C.text } : { background: C.card, color: C.text, border: `1px solid ${C.line}` }}>
                {p.removed ? <p className="font-body text-[14px] italic" style={{ color: C.faint }}>This message was removed.</p> : (
                  <>
                    {p.share && <div className="mb-2 min-w-[200px]"><ShareCardView s={p.share} inThread /></div>}
                    {p.body && <p className="font-body text-[15px] leading-relaxed whitespace-pre-wrap break-words">{p.body}</p>}
                  </>
                )}
                <p className="font-body text-[11px] mt-1 flex items-center gap-2" style={{ color: C.faint }}>
                  {mine ? "You" : c?.name} · {whenShort(p.at)}
                  {!mine && !p.removed && <button type="button" onClick={() => setReporting({ id: p.id })} className="underline">Report</button>}
                </p>
              </div>
            </li>
          );
        })}
        <li ref={end} aria-hidden />
      </ul>
      {c && c.can_write === false ? <div className="mt-6"><Notice>You can&rsquo;t send messages to friends right now.</Notice></div> : (
        <form className="mt-6 space-y-2" onSubmit={submit}>
          <label className="sr-only" htmlFor="pp-dm">Write to {c?.name || "your friend"}</label>
          <textarea id="pp-dm" rows={3} maxLength={DM_MAX} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder={`Write to ${c?.name || friendName || "your friend"}`} />
          <div className="flex items-center justify-between gap-3">
            <span className="font-body text-[11px] leading-snug" style={{ color: C.faint }}>{text.length > DM_MAX - 150 ? `${DM_MAX - text.length} left` : PRIVATE_LINE}</span>
            <button type="submit" disabled={busy || !text.trim()} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Sending…" : "Send"}</button>
          </div>
          {error && <Notice>{error}</Notice>}
        </form>
      )}
      {reporting && c && <ReportSheet conversationId={c.id} messageId={reporting.id} name={c.name || "them"} onClose={() => setReporting(null)} />}
    </div>
  );
}

// ── The Inbox: notices from the bar, friend requests, conversations with friends ──
export function InboxFriends({ social, title }: { social: SocialInbox | null | undefined; title: (id: string, children: ReactNode) => ReactNode }) {
  const [notices, setNotices] = useState<MemberNotice[]>(social?.notices || []);
  useEffect(() => { setNotices(social?.notices || []); }, [social]);
  if (!social) return null;
  const read = async (n: MemberNotice) => {
    if (!n.unread) return;
    setNotices((x) => x.map((y) => (y.id === n.id ? { ...y, unread: false } : y)));
    await postJson("/api/passport/friends", { action: "notice_read", id: n.id });
    notifyChanged("inbox");
  };
  return (
    <>
      {notices.length > 0 && (
        <section aria-labelledby="pp-notices">
          {title("pp-notices", "From Common Good")}
          <ul className="space-y-3">
            {notices.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => read(n)} className="w-full text-left rounded-xl border px-4 py-3.5 pp-focus" style={{ borderColor: n.unread ? `${C.brass}80` : C.line, background: n.unread ? "#1a1f14" : C.card }}>
                  <span className={`block ${kicker}`} style={{ color: C.brass }}>A note from the bar{n.unread ? " · new" : ""}</span>
                  <span className="block font-body text-[15px] mt-1 whitespace-pre-wrap" style={{ color: C.text }}>{n.body}</span>
                  <span className="block font-body text-[11px] mt-1" style={{ color: C.faint }}>{whenShort(n.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="pp-friends-inbox">
        {title("pp-friends-inbox", "Friends")}
        {social.incoming.length > 0 && (
          <Link href="/passport/friends" scroll={false} className="flex items-center gap-3 rounded-xl border px-4 py-3.5 mb-3 pp-focus pp-row" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
            <span className="flex-1 font-body text-[15px]" style={{ color: C.text }}>{social.incoming.length === 1 ? `${social.incoming[0].name} sent you a friend request` : `${social.incoming.length} friend requests`}</span>
            <span aria-hidden style={{ color: C.brass }}>→</span>
          </Link>
        )}
        {social.conversations.length > 0 ? (
          <ul>
            {social.conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/passport/inbox/friends/${c.id}`} scroll={false} className="flex items-start gap-3 py-3.5 border-b pp-row pp-focus rounded-sm" style={{ borderColor: C.line }}>
                  <span className="pt-2 w-2">{c.unread && <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.accent }}><span className="sr-only">Unread</span></span>}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-[19px] leading-tight truncate" style={{ color: C.text }}>{c.name}</span>
                      <span className="font-body text-[11px] shrink-0" style={{ color: C.faint }}>{whenShort(c.last_at)}</span>
                    </span>
                    <span className="block font-body text-[13px] truncate mt-0.5" style={{ color: c.unread ? C.text : C.muted }}>{c.last_from === "me" ? "You: " : ""}{c.preview}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm" style={{ color: C.faint }}>Message a friend from <Link href="/passport/friends" scroll={false} className="underline" style={{ color: C.text }}>Friends</Link>. {PRIVATE_LINE}</p>
        )}
      </section>
    </>
  );
}

// ── Let's go: plan a visit ───────────────────────────────────────────────────
export function LetsGoForm({ friends }: { friends: Friend[] }) {
  const router = useRouter();
  const shell = useShell();
  const days = nextDays();
  const [day, setDay] = useState(days[0].day);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [all, setAll] = useState(friends.length > 0 && friends.length <= 6);
  const [pick, setPick] = useState<Set<number>>(() => new Set());
  const { send, busy, error } = useSend();
  const ready = !!time && (all || pick.size > 0);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const out = await send("/api/passport/meetups", { what: "letsgo", day, time, note, to: all ? "all" : Array.from(pick) });
    if (out) { notifyChanged("inbox"); shell?.toast("Sent to your friends."); router.push("/passport", { scroll: false }); }
  };
  return (
    <form onSubmit={submit} className="pb-16 space-y-5" noValidate>
      <div>
        <BackLink fallback="/passport" label="Home" />
        <p className="font-body text-[11px] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Let&rsquo;s go</p>
        <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>Plan a visit</h1>
        <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>Tell friends when you&rsquo;re thinking of coming in. They can answer In, Maybe or Can&rsquo;t. It isn&rsquo;t a reservation, and it disappears the next morning.</p>
      </div>
      {!friends.length ? (
        <p className="font-body text-[15px]" style={{ color: C.text }}>Add a friend first. <Link href="/passport/friends" scroll={false} className="underline">Friends</Link></p>
      ) : (
        <>
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>Day</span>
            <select value={day} onChange={(e) => setDay(e.target.value)} className={inputCls}>{days.map((d) => <option key={d.day} value={d.day}>{d.label}</option>)}</select>
          </label>
          <fieldset>
            <legend className={labelCls} style={{ color: C.muted }}>Rough time</legend>
            <div className="flex flex-wrap gap-2">{LETSGO_TIMES.map((t) => <Pill key={t.id} on={time === t.id} onClick={() => setTime(t.id)}>{t.label}</Pill>)}</div>
          </fieldset>
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>A note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={LETSGO_NOTE_MAX} className={inputCls} placeholder="First round is on me" />
          </label>
          <fieldset className="space-y-2">
            <legend className={labelCls} style={{ color: C.muted }}>Who</legend>
            <Check checked={all} onChange={setAll}>All my friends ({friends.length})</Check>
            {!all && (
              <ul className="divide-y rounded-xl border" style={{ borderColor: C.line }}>
                {friends.map((f) => (
                  <li key={f.id} style={{ borderColor: C.line }}>
                    <label className="flex items-center gap-3 px-4 min-h-[50px] cursor-pointer font-body text-[15px]" style={{ color: C.text }}>
                      <input type="checkbox" className="w-[18px] h-[18px] accent-[#C9A96E]" checked={pick.has(f.id)} onChange={() => setPick((p) => { const n = new Set(p); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
                      {f.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          {error && <Notice>{error}</Notice>}
          <button type="submit" disabled={busy || !ready} className="w-full rounded-lg py-3.5 font-body text-[13px] tracking-[0.22em] uppercase transition-colors disabled:opacity-50 bg-[#C9A96E] text-[#13170F] hover:bg-[#d6b77d]">{busy ? "Sending…" : "Send to friends"}</button>
          <p className="font-body text-xs text-center" style={{ color: C.faint }}>Want a table held? <a href="/reserve" className="underline" style={{ color: C.text }}>Book a table</a></p>
        </>
      )}
    </form>
  );
}
