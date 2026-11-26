"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { C, Notice, inputCls, postJson } from "./ui";
import { BackLink } from "./bits";
import { notifyChanged } from "./appEvents";
import { useShell } from "./shellContext";
import { ChatScreen, useRoomPoll, type UiPost } from "./Chat";
import { money } from "@/lib/passport/bottles";
import { dayLong } from "@/lib/passport/shell";
import {
  BODY_MAX, BUDGETS, DETAILS_MAX, EVENT_KINDS, MAX_GUESTS, POLL_MS, REQUEST_KINDS, SUBJECT_MAX, TIMES, askHref, needsYou, refHref, whenShort,
  OPEN_EVENT, OPEN_REQUEST, type NeedsItem,
} from "@/lib/passport/inbox";
import type { BottleRequest, EventInquiry, InboxData, InboxPost, InboxRef, InboxThread, Member, MemberRequest } from "@/lib/passport/types";

/**
 * File 08: the Inbox. Message the bar, make a request, plan an event; follow each one; answer the bar's questions in
 * place. Everything goes through /api/passport/inbox, which only ever acts for the signed-in member. Staff appear by
 * first name only. Replies can take a day; nothing here replaces talking to us during service.
 */

const OFFLINE = "Couldn't send that. Please try again.";
const smallBtn = "rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] tracking-[0.12em] uppercase transition-colors disabled:opacity-50 pp-focus pp-press";
const labelCls = "block font-body text-[0.75rem] tracking-[0.2em] uppercase mb-1.5";
export const REPLY_LINE = "Replies can take a day. For anything during service, just ask us at the bar.";

function Tag({ children, brass = false }: { children: ReactNode; brass?: boolean }) {
  return (
    <span className="font-body text-[0.75rem] tracking-[0.18em] uppercase rounded px-1.5 py-0.5 border whitespace-nowrap"
      style={{ color: brass ? C.brass : C.muted, borderColor: brass ? `${C.brass}80` : C.line }}>
      {children}
    </span>
  );
}
function UnreadDot({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: C.accent }}><span className="sr-only">Unread</span></span>;
}

/** Send to our own API; on a sign-in that ended, refresh (the app shows sign-in). */
function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = useCallback(async <T,>(url: string, body: unknown): Promise<T | null> => {
    setBusy(true);
    setError("");
    const r = await postJson<T>(url, body);
    setBusy(false);
    if (r.ok) return r.data;
    if (r.data.signed_out) { router.refresh(); return null; }
    setError(r.data.error || OFFLINE);
    return null;
  }, [router]);
  return { send, busy, error, setError };
}

/** Keep an open item fresh while it is on screen (every 30 seconds, and when the app comes back to the front). */
function usePoll<T>(url: string, pick: (d: Record<string, unknown>) => T | undefined, onData: (x: T) => void) {
  const pickRef = useRef(pick);
  const dataRef = useRef(onData);
  pickRef.current = pick;
  dataRef.current = onData;
  useEffect(() => {
    let off = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const x = pickRef.current(await res.json());
        if (!off && x) dataRef.current(x);
      } catch { /* offline: try again next time */ }
    };
    const t = setInterval(load, POLL_MS);
    const vis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { off = true; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [url]);
}

// ── The Inbox tab ────────────────────────────────────────────────────────────
/**
 * The three ways to start something, always at the top. File 12: one compact row (short words, full names for screen
 * readers) so the Inbox's own sections start sooner, even with every section present.
 */
export function InboxActions() {
  const a = (kind: string, short: string, label: string) => (
    <Link href={`/passport/inbox/new?kind=${kind}`} scroll={false} aria-label={label}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border px-3 min-h-[44px] font-body text-[0.875rem] whitespace-nowrap pp-focus pp-press"
      style={{ borderColor: kind === "message" ? C.brass : C.line, color: kind === "message" ? C.bg : C.text, background: kind === "message" ? C.brass : "transparent" }}>
      <span aria-hidden>+</span> {short}
    </Link>
  );
  return (
    <div className="grid grid-cols-3 gap-2 -mt-2" role="group" aria-label="Start something">
      {a("message", "Message", "Message the bar")}{a("request", "Request", "Make a request")}{a("event", "Event", "Plan an event")}
    </div>
  );
}

function NeedsCard({ n, onAnswered }: { n: NeedsItem; onAnswered: (r: MemberRequest) => void }) {
  if (n.kind === "question") return <QuestionCard r={n.request} onAnswered={onAnswered} />;
  const words = n.kind === "reply" ? { kicker: "A reply from the bar", title: n.thread.subject || (n.thread.ref ? n.thread.ref.name : "Your message"), line: n.thread.preview }
    : n.kind === "event" ? { kicker: "About your event", title: `${n.inquiry.kind_label} · ${dayLong(n.inquiry.preferred_date)}`, line: n.inquiry.status_label }
      : n.kind === "note" ? { kicker: "A note about your request", title: n.request.kind_label, line: n.request.status_label }
        : n.kind === "price" ? { kicker: "A price is waiting for you", title: n.bottle.name, line: n.bottle.quote ? `${money(n.bottle.quote.price_cents)} a bottle, plus tax. Accept or decline below.` : "Accept or decline below." }
          : { kicker: "Ready for pickup", title: "bottle" in n ? n.bottle.name : "", line: "Set aside for you at the bar" };
  return (
    <li>
      <Link href={n.href} scroll={false} className="flex items-center gap-3 rounded-xl border px-4 py-3.5 pp-focus pp-row" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
        <span className="flex-1 min-w-0">
          <span className="block font-body text-[0.75rem] tracking-[0.25em] uppercase" style={{ color: C.brass }}>{words.kicker}</span>
          <span className="block font-display text-[1.25rem] leading-tight mt-1 truncate" style={{ color: C.text }}>{words.title}</span>
          {words.line && <span className="block font-body text-[0.875rem] mt-0.5 truncate" style={{ color: C.muted }}>{words.line}</span>}
        </span>
        <span aria-hidden style={{ color: C.brass }}>→</span>
      </Link>
    </li>
  );
}

/** A question from the bar on a request: shown with the request, answered right here. */
function QuestionCard({ r, onAnswered }: { r: MemberRequest; onAnswered: (r: MemberRequest) => void }) {
  const { send, busy, error } = useSend();
  const [text, setText] = useState("");
  const q = [...r.posts].reverse().find((p) => p.kind === "question");
  return (
    <li className="rounded-xl border px-4 py-4" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
      <span className="block font-body text-[0.75rem] tracking-[0.25em] uppercase" style={{ color: C.brass }}>A question about your request</span>
      <Link href={`/passport/inbox/requests/${r.id}`} scroll={false} className="block font-display text-[1.25rem] leading-tight mt-1" style={{ color: C.text }}>{r.kind_label}</Link>
      {q && <p className="font-body text-[1rem] mt-2 whitespace-pre-wrap" style={{ color: C.text }}>{q.body}<span className="block text-[0.75rem] mt-1" style={{ color: C.faint }}>{q.by || "Common Good"} · {whenShort(q.at)}</span></p>}
      <form className="mt-3 space-y-2" onSubmit={async (e) => {
        e.preventDefault();
        const out = await send<{ member_request: MemberRequest }>(`/api/passport/inbox/requests/${r.id}`, { action: "answer", body: text });
        if (out) { setText(""); onAnswered(out.member_request); notifyChanged("inbox"); }
      }}>
        <label className="sr-only" htmlFor={`ans-${r.id}`}>Your answer</label>
        <textarea id={`ans-${r.id}`} rows={2} maxLength={BODY_MAX} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="Your answer" />
        {error && <Notice>{error}</Notice>}
        <button type="submit" disabled={busy || !text.trim()} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Sending…" : "Send answer"}</button>
      </form>
    </li>
  );
}

function ThreadRow({ t }: { t: InboxThread }) {
  return (
    <li>
      <Link href={`/passport/inbox/messages/${t.id}`} scroll={false} className="flex items-start gap-3 py-3.5 border-b pp-row pp-focus rounded-sm" style={{ borderColor: C.line }}>
        <span className="pt-2 w-2"><UnreadDot on={t.unread} /></span>
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`font-display text-[1.1875rem] leading-tight truncate ${t.unread ? "" : "opacity-90"}`} style={{ color: C.text }}>{t.subject || (t.ref ? `About ${t.ref.name}` : "Message to the bar")}</span>
            <span className="font-body text-[0.75rem] shrink-0" style={{ color: C.faint }}>{whenShort(t.last_at)}</span>
          </span>
          <span className="block font-body text-[0.875rem] truncate mt-0.5" style={{ color: t.unread ? C.text : C.muted }}>{t.last_from === "member" ? "You: " : ""}{t.preview}</span>
          <span className="block font-body text-[0.75rem] mt-1" style={{ color: t.status === "answered" ? C.brass : C.faint }}>{t.status_label}</span>
        </span>
      </Link>
    </li>
  );
}
function RequestRow({ href, title, line, status, unread, open }: { href: string; title: string; line: string; status: string; unread: boolean; open: boolean }) {
  return (
    <li>
      <Link href={href} scroll={false} className="flex items-start gap-3 py-3.5 border-b pp-row pp-focus rounded-sm" style={{ borderColor: C.line, opacity: open ? 1 : 0.7 }}>
        <span className="pt-2 w-2"><UnreadDot on={unread} /></span>
        <span className="flex-1 min-w-0">
          <span className="flex items-start justify-between gap-3">
            <span className="font-display text-[1.1875rem] leading-tight" style={{ color: C.text }}>{title}</span>
            <Tag brass={unread}>{status}</Tag>
          </span>
          {line && <span className="block font-body text-[0.875rem] truncate mt-0.5" style={{ color: C.muted }}>{line}</span>}
        </span>
      </Link>
    </li>
  );
}

/** Top to bottom, each only when it has something: Needs you, Messages, Requests (general and events). */
export function InboxSections({ inbox, bottles, title }: { inbox: InboxData | null; bottles: BottleRequest[]; title: (id: string, children: ReactNode) => ReactNode }) {
  const [data, setData] = useState(inbox);
  useEffect(() => { setData(inbox); }, [inbox]);
  const shell = useShell();
  const needs = needsYou(data, bottles);
  useEffect(() => { if (needsYou(data, []).length > 0) shell?.setMessagesDot(true); }, [data, shell]);
  const answered = (r: MemberRequest) => setData((d) => (d ? { ...d, member_requests: d.member_requests.map((x) => (x.id === r.id ? r : x)) } : d));
  if (!data) {
    return <p className="font-body text-sm mt-6" style={{ color: C.faint }}>Your messages and requests can&rsquo;t load right now. Pull down or come back in a minute.</p>;
  }
  const requests = [
    ...data.member_requests.map((r) => ({ at: r.updated_at, open: OPEN_REQUEST.has(r.status), el: (
      <RequestRow key={`r${r.id}`} href={`/passport/inbox/requests/${r.id}`} title={r.kind_label} line={r.date ? `For ${dayLong(r.date)} · ${r.details}` : r.details}
        status={r.question ? "Question for you" : r.status_label} unread={r.unread} open={OPEN_REQUEST.has(r.status)} />
    ) })),
    ...data.inquiries.map((q) => ({ at: q.updated_at, open: OPEN_EVENT.has(q.status), el: (
      <RequestRow key={`e${q.id}`} href={`/passport/inbox/events/${q.id}`} title={`${q.kind_label} · ${dayLong(q.preferred_date)}`} line={`${q.guests} ${q.guests === 1 ? "guest" : "guests"} · ${q.time_label}`}
        status={q.status_label} unread={q.unread} open={OPEN_EVENT.has(q.status)} />
    ) })),
  ].sort((a, b) => Number(b.open) - Number(a.open) || (b.at || "").localeCompare(a.at || ""));
  return (
    <>
      {needs.length > 0 && (
        <section aria-labelledby="pp-needs-you">
          {title("pp-needs-you", "Needs you")}
          <ul className="space-y-3">{needs.map((n) => <NeedsCard key={n.key} n={n} onAnswered={answered} />)}</ul>
        </section>
      )}
      {data.threads.length > 0 && (
        <section aria-labelledby="pp-messages">
          {title("pp-messages", "Messages")}
          <ul>{data.threads.map((t) => <ThreadRow key={t.id} t={t} />)}</ul>
        </section>
      )}
      {requests.length > 0 && (
        <section aria-labelledby="pp-requests">
          {title("pp-requests", "Requests")}
          <ul>{requests.map((x) => x.el)}</ul>
        </section>
      )}
      {!data.threads.length && !requests.length && (
        <p className="font-body text-sm mt-6 leading-relaxed" style={{ color: C.faint }}>Write to us about anything: a drink, a bottle, a night you&rsquo;re planning. {REPLY_LINE}</p>
      )}
    </>
  );
}

/**
 * File 16: the Requests top tab. General requests and event inquiries with their status, as before, under two buttons
 * worded exactly "Send a request" and "Book an event". A question from the bar is answered right here.
 */
export function RequestsPanel({ inbox }: { inbox: InboxData | null }) {
  const [data, setData] = useState(inbox);
  useEffect(() => { setData(inbox); }, [inbox]);
  const answered = (r: MemberRequest) => setData((d) => (d ? { ...d, member_requests: d.member_requests.map((x) => (x.id === r.id ? r : x)) } : d));
  const btn = (kind: string, label: string, primary: boolean) => (
    <Link href={`/passport/inbox/new?kind=${kind}`} scroll={false} className="inline-flex items-center justify-center gap-1.5 rounded-full border px-4 min-h-[44px] font-body text-[0.9375rem] whitespace-nowrap pp-focus pp-press"
      style={{ borderColor: primary ? C.brass : C.line, color: primary ? C.bg : C.text, background: primary ? C.brass : "transparent" }}>{label}</Link>
  );
  const questions = (data?.member_requests || []).filter((r) => r.question);
  const rows = data ? [
    ...data.member_requests.filter((r) => !r.question).map((r) => ({ at: r.updated_at, open: OPEN_REQUEST.has(r.status), el: (
      <RequestRow key={`r${r.id}`} href={`/passport/inbox/requests/${r.id}`} title={r.kind_label} line={r.date ? `For ${dayLong(r.date)} · ${r.details}` : r.details}
        status={r.status_label} unread={r.unread} open={OPEN_REQUEST.has(r.status)} />
    ) })),
    ...data.inquiries.map((q) => ({ at: q.updated_at, open: OPEN_EVENT.has(q.status), el: (
      <RequestRow key={`e${q.id}`} href={`/passport/inbox/events/${q.id}`} title={`${q.kind_label} · ${dayLong(q.preferred_date)}`} line={`${q.guests} ${q.guests === 1 ? "guest" : "guests"} · ${q.time_label}`}
        status={q.status_label} unread={q.unread} open={OPEN_EVENT.has(q.status)} />
    ) })),
  ].sort((a, b) => Number(b.open) - Number(a.open) || (b.at || "").localeCompare(a.at || "")) : [];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Start a request">{btn("request", "Send a request", true)}{btn("event", "Book an event", false)}</div>
      {!data && <p className="font-body text-sm mt-6" style={{ color: C.faint }}>Your requests can&rsquo;t load right now. Come back in a minute.</p>}
      {questions.length > 0 && <ul className="space-y-3 mt-5">{questions.map((r) => <QuestionCard key={r.id} r={r} onAnswered={answered} />)}</ul>}
      {rows.length > 0 && <ul className="mt-4">{rows.map((x) => x.el)}</ul>}
      {data && !rows.length && !questions.length && <p className="font-body text-sm mt-6 leading-relaxed" style={{ color: C.faint }}>Something for your next visit, a celebration, a seating need, or a private event: ask here and follow it through. {REPLY_LINE}</p>}
    </div>
  );
}

// ── One conversation ─────────────────────────────────────────────────────────
function Posts({ posts, memberWord = "You" }: { posts: InboxPost[]; memberWord?: string }) {
  const end = useRef<HTMLLIElement>(null);
  const count = posts.length;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    end.current?.scrollIntoView({ block: "nearest" });
  }, [count]);
  return (
    <ul className="space-y-3 mt-6" aria-live="polite">
      {posts.map((p) => {
        const mine = p.from === "member";
        return (
          <li key={p.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5" style={mine ? { background: "#2a3220", color: C.text } : { background: C.card, color: C.text, border: `1px solid ${C.line}` }}>
              {p.kind === "question" && <span className="block font-body text-[0.75rem] tracking-[0.2em] uppercase mb-1" style={{ color: C.brass }}>A question for you</span>}
              <p className="font-body text-[1rem] leading-relaxed whitespace-pre-wrap break-words">{p.body}</p>
              <p className="font-body text-[0.75rem] mt-1" style={{ color: C.faint }}>{mine ? memberWord : (p.by || "Common Good")} · {whenShort(p.at)}</p>
            </div>
          </li>
        );
      })}
      <li ref={end} aria-hidden />
    </ul>
  );
}
function RefChip({ r }: { r: InboxRef }) {
  const href = refHref(r);
  const word = r.kind === "list" ? "List" : r.kind === "bottle" ? "Bottle" : "Cocktail";
  const inner = <><span className="font-body text-[0.75rem] tracking-[0.2em] uppercase" style={{ color: C.faint }}>{word}</span> <span className="font-body text-sm" style={{ color: C.text }}>{r.name}</span>{href && <span aria-hidden style={{ color: C.brass }}> →</span>}</>;
  return href
    ? <Link href={href} scroll={false} className="inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[44px] pp-focus" style={{ borderColor: C.line }}>{inner}</Link>
    : <span className="inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[44px]" style={{ borderColor: C.line }}>{inner}</span>;
}
function Composer({ onSend, busy, error, placeholder, cta = "Send" }: { onSend: (text: string) => Promise<boolean>; busy: boolean; error: string; placeholder: string; cta?: string }) {
  const [text, setText] = useState("");
  return (
    <form className="mt-6 space-y-2" onSubmit={async (e) => { e.preventDefault(); if (await onSend(text)) setText(""); }}>
      <label className="sr-only" htmlFor="pp-compose">{placeholder}</label>
      <textarea id="pp-compose" rows={3} maxLength={BODY_MAX} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder={placeholder} />
      <div className="flex items-center justify-between gap-3">
        <span className="font-body text-[0.75rem]" style={{ color: C.faint }}>{text.length > BODY_MAX - 200 ? `${BODY_MAX - text.length} left` : REPLY_LINE}</span>
        <button type="submit" disabled={busy || !text.trim()} className={smallBtn} style={{ borderColor: C.brass, color: C.bg, background: C.brass }}>{busy ? "Sending…" : cta}</button>
      </div>
      {error && <Notice>{error}</Notice>}
    </form>
  );
}

/**
 * A conversation with the bar, in the one conversation screen (file 16): subject, status, staff first names and
 * "Ask about this" stay as file 08 set them. It asks for news every 5 seconds while it is on screen.
 */
export function ThreadView({ initial }: { initial: InboxThread }) {
  const [t, setT] = useState(initial);
  const { send, busy, error } = useSend();
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/passport/inbox/threads/${initial.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (d.thread) setT(d.thread);
    } catch { /* offline */ }
  }, [initial.id]);
  useRoomPoll(load);
  // Opening it read the bar's replies: Messages and its dot follow.
  useEffect(() => { notifyChanged("inbox"); }, []);
  const posts: UiPost[] = (t.posts || []).map((p) => ({ id: p.id, at: p.at, mine: p.from === "member", author: p.from === "member" ? "You" : `Common Good${p.by ? ` · ${p.by}` : ""}`, fromBar: p.from !== "member", body: p.body, tag: p.kind === "question" ? "A question for you" : null }));
  const header = (
    <div>
      <BackLink fallback="/passport/inbox" label="Messages" />
      <p className="pp-t-eyebrow mt-2" style={{ color: C.brass }}>Common Good</p>
      <h1 className="font-display text-3xl leading-tight mt-1" style={{ color: C.text }}>{t.subject || (t.ref ? `About ${t.ref.name}` : "Your message")}</h1>
      <div className="flex flex-wrap items-center gap-2 mt-3"><Tag brass={t.status === "answered"}>{t.status_label}</Tag>{t.ref && <RefChip r={t.ref} />}</div>
    </div>
  );
  return (
    <ChatScreen header={header} posts={posts} line={t.status === "closed" ? `This conversation is closed. Writing again opens it. ${REPLY_LINE}` : REPLY_LINE} canWrite placeholder="Write to the bar" max={BODY_MAX} showNames busy={busy} error={error}
      onSend={async (text) => {
        const out = await send<{ thread: InboxThread }>(`/api/passport/inbox/threads/${t.id}`, { action: "reply", body: text });
        if (out) { setT(out.thread); notifyChanged("inbox"); return true; }
        return false;
      }} />
  );
}

function ConfirmCancel({ what, onYes, busy }: { what: string; onYes: () => void; busy: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" onClick={() => setAsking(true)} className={`${smallBtn} mt-8`} style={{ borderColor: C.line, color: C.muted }}>Cancel {what}</button>;
  return (
    <div className="mt-8 space-y-2">
      <p className="font-body text-sm" style={{ color: C.text }}>Cancel this {what}?</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={onYes} className={smallBtn} style={{ borderColor: C.accent, color: C.accent }}>Cancel it</button>
        <button type="button" disabled={busy} onClick={() => setAsking(false)} className={smallBtn} style={{ borderColor: C.line, color: C.muted }}>Keep it</button>
      </div>
    </div>
  );
}
function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="mt-5 rounded-xl border divide-y" style={{ borderColor: C.line, background: C.card }}>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2.5" style={{ borderColor: C.line }}>
          <dt className="font-body text-[0.75rem] tracking-[0.18em] uppercase shrink-0" style={{ color: C.faint }}>{k}</dt>
          <dd className="font-body text-[1rem] text-right" style={{ color: C.text }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RequestView({ initial }: { initial: MemberRequest }) {
  const [r, setR] = useState(initial);
  const { send, busy, error } = useSend();
  usePoll(`/api/passport/inbox/requests/${initial.id}`, (d) => d.member_request as MemberRequest | undefined, setR);
  useEffect(() => { notifyChanged("inbox"); }, []);
  const act = async (body: Record<string, unknown>) => {
    const out = await send<{ member_request: MemberRequest }>(`/api/passport/inbox/requests/${r.id}`, body);
    if (out) { setR(out.member_request); notifyChanged("inbox"); return true; }
    return false;
  };
  return (
    <div className="pb-16">
      <BackLink fallback="/passport/inbox" label="Messages" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Your request</p>
      <h1 className="font-display text-3xl leading-tight mt-1" style={{ color: C.text }}>{r.kind_label}</h1>
      <div className="mt-3"><Tag brass={r.question}>{r.question ? "A question for you" : r.status_label}</Tag></div>
      <Facts rows={[["For", r.date ? dayLong(r.date) : null], ["Status", r.status_label]]} />
      <p className="font-body text-[1rem] mt-5 whitespace-pre-wrap leading-relaxed" style={{ color: C.text }}>{r.details}</p>
      {r.status === "declined" && r.decline_reason && <p className="font-body text-sm mt-4 border-l-2 pl-3" style={{ borderColor: C.brass, color: C.text }}>{r.decline_reason}<span className="block text-[0.75rem] mt-1" style={{ color: C.faint }}>From the bar</span></p>}
      {r.posts.length > 0 && <Posts posts={r.posts} />}
      {r.can_answer && <Composer busy={busy} error={error} placeholder="Your answer" cta="Send answer" onSend={(text) => act({ action: "answer", body: text })} />}
      {!r.can_answer && error && <div className="mt-4"><Notice>{error}</Notice></div>}
      {r.can_cancel && <ConfirmCancel what="request" busy={busy} onYes={() => void act({ action: "cancel" })} />}
    </div>
  );
}

export function InquiryView({ initial, me }: { initial: EventInquiry; me?: Pick<Member, "email" | "phone"> | null }) {
  const [q, setQ] = useState(initial);
  const { send, busy, error } = useSend();
  usePoll(`/api/passport/inbox/events/${initial.id}`, (d) => d.inquiry as EventInquiry | undefined, setQ);
  useEffect(() => { notifyChanged("inbox"); }, []);
  const act = async (body: Record<string, unknown>) => {
    const out = await send<{ inquiry: EventInquiry }>(`/api/passport/inbox/events/${q.id}`, body);
    if (out) { setQ(out.inquiry); notifyChanged("inbox"); return true; }
    return false;
  };
  return (
    <div className="pb-16">
      <BackLink fallback="/passport/inbox" label="Messages" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Your event inquiry</p>
      <h1 className="font-display text-3xl leading-tight mt-1" style={{ color: C.text }}>{q.kind_label}</h1>
      <div className="mt-3"><Tag brass={q.unread || q.status === "confirmed"}>{q.status_label}</Tag></div>
      <Facts rows={[["Date", dayLong(q.preferred_date)], ["Backup", q.backup_date ? dayLong(q.backup_date) : null], ["Time", q.time_label], ["Guests", String(q.guests)], ["Budget", q.budget_label]]} />
      {q.details && <p className="font-body text-[1rem] mt-5 whitespace-pre-wrap leading-relaxed" style={{ color: C.text }}>{q.details}</p>}
      {q.status === "declined" && q.decline_reason && <p className="font-body text-sm mt-4 border-l-2 pl-3" style={{ borderColor: C.brass, color: C.text }}>{q.decline_reason}<span className="block text-[0.75rem] mt-1" style={{ color: C.faint }}>From the bar</span></p>}
      {me && <p className="font-body text-[0.875rem] mt-4" style={{ color: C.faint }}>We&rsquo;ll reach you at {me.email}{me.phone ? ` or ${me.phone}` : ""}. Nothing is paid or held in the app.</p>}
      {q.posts.length > 0 && <Posts posts={q.posts} />}
      {q.can_reply && <Composer busy={busy} error={error} placeholder="Write to us about your event" onSend={(text) => act({ action: "reply", body: text })} />}
      {!q.can_reply && error && <div className="mt-4"><Notice>{error}</Notice></div>}
      {q.can_cancel && <ConfirmCancel what="inquiry" busy={busy} onYes={() => void act({ action: "cancel" })} />}
    </div>
  );
}

// ── Starting something new ───────────────────────────────────────────────────
const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T | ""; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className={labelCls} style={{ color: C.muted }}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className="rounded-full border px-3.5 min-h-[44px] font-body text-[0.875rem] pp-focus pp-press"
            style={{ borderColor: value === o.id ? C.brass : C.line, color: value === o.id ? C.bg : C.text, background: value === o.id ? C.brass : "transparent" }}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Counter({ n, max }: { n: number; max: number }) {
  return <span className="block font-body text-[0.75rem] mt-1 text-right" style={{ color: n > max - 100 ? C.brass : C.faint }}>{n.toLocaleString("en-US")} / {max.toLocaleString("en-US")}</span>;
}

/** "Message the bar", "Make a request" and "Plan an event". The member's name, email and phone come from their account. */
export function NewInboxItem({ kind, about, aboutName, me }: { kind: "message" | "request" | "event"; about: { kind: InboxRef["kind"]; id: number } | null; aboutName: string; me: Pick<Member, "first_name" | "email" | "phone"> | null }) {
  const router = useRouter();
  const { send, busy, error, setError } = useSend();
  const [f, setF] = useState({ subject: "", body: "", rkind: "" as string, date: "", details: "", ekind: "" as string, preferred: "", backup: "", time: "" as string, guests: "", budget: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const min = todayLocal();
  const done = (href: string) => { notifyChanged("inbox"); router.replace(href, { scroll: false }); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (kind === "message") {
      const out = await send<{ thread: InboxThread }>("/api/passport/inbox", { what: "message", subject: f.subject, body: f.body, ...(about ? { ref_kind: about.kind, ref_id: about.id } : {}) });
      if (out) done(`/passport/inbox/messages/${out.thread.id}`);
    } else if (kind === "request") {
      const out = await send<{ member_request: MemberRequest }>("/api/passport/inbox", { what: "request", kind: f.rkind, date: f.date, details: f.details });
      if (out) done(`/passport/inbox/requests/${out.member_request.id}`);
    } else {
      const out = await send<{ inquiry: EventInquiry }>("/api/passport/inbox", { what: "event", kind: f.ekind, preferred_date: f.preferred, backup_date: f.backup, time_of_day: f.time, guests: Number(f.guests), budget: f.budget, details: f.details });
      if (out) done(`/passport/inbox/events/${out.inquiry.id}`);
    }
  };
  const title = kind === "message" ? "Message the bar" : kind === "request" ? "Make a request" : "Plan an event";
  const ready = kind === "message" ? !!f.body.trim() : kind === "request" ? !!f.rkind && !!f.details.trim() : !!f.ekind && !!f.preferred && !!f.time && Number(f.guests) > 0;
  return (
    <form onSubmit={submit} className="pb-16 space-y-5" noValidate>
      <div>
        <BackLink fallback="/passport/inbox" label="Messages" />
        <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>Messages</p>
        <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>{title}</h1>
        <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>
          {kind === "message" ? "Questions about a drink, a bottle, making something at home, or anything else." : kind === "request" ? "Something we can have ready, or a need we should know about." : "A private party, a tasting, a buyout. We'll follow up here."} {REPLY_LINE}
        </p>
      </div>
      {kind === "message" && (
        <>
          {about && aboutName && (
            <p className="font-body text-sm" style={{ color: C.muted }}>About <span className="rounded-full border px-3 py-1 ml-1" style={{ borderColor: C.line, color: C.text }}>{aboutName}</span></p>
          )}
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>Subject (optional)</span>
            <input value={f.subject} onChange={(e) => set("subject")(e.target.value)} maxLength={SUBJECT_MAX} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>Your message</span>
            <textarea rows={6} value={f.body} onChange={(e) => set("body")(e.target.value)} maxLength={BODY_MAX} className={inputCls} autoFocus />
            <Counter n={f.body.length} max={BODY_MAX} />
          </label>
        </>
      )}
      {kind === "request" && (
        <>
          <Chips label="What is it?" options={REQUEST_KINDS} value={f.rkind as MemberRequest["kind"] | ""} onChange={set("rkind")} />
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>For a date (optional)</span>
            <input type="date" min={min} value={f.date} onChange={(e) => set("date")(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>Tell us about it</span>
            <textarea rows={5} value={f.details} onChange={(e) => set("details")(e.target.value)} maxLength={DETAILS_MAX} className={inputCls} />
            <Counter n={f.details.length} max={DETAILS_MAX} />
          </label>
        </>
      )}
      {kind === "event" && (
        <>
          <Chips label="What kind of event?" options={EVENT_KINDS} value={f.ekind as EventInquiry["kind"] | ""} onChange={set("ekind")} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={labelCls} style={{ color: C.muted }}>Preferred date</span>
              <input type="date" min={min} value={f.preferred} onChange={(e) => set("preferred")(e.target.value)} className={inputCls} /></label>
            <label className="block"><span className={labelCls} style={{ color: C.muted }}>Backup (optional)</span>
              <input type="date" min={min} value={f.backup} onChange={(e) => set("backup")(e.target.value)} className={inputCls} /></label>
          </div>
          <Chips label="Time of day" options={TIMES} value={f.time} onChange={set("time")} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={labelCls} style={{ color: C.muted }}>Guests</span>
              <input type="number" inputMode="numeric" min={1} max={MAX_GUESTS} value={f.guests} onChange={(e) => set("guests")(e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputCls} /></label>
            <label className="block"><span className={labelCls} style={{ color: C.muted }}>Budget (optional)</span>
              <select value={f.budget} onChange={(e) => set("budget")(e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select></label>
          </div>
          <label className="block">
            <span className={labelCls} style={{ color: C.muted }}>Anything else (optional)</span>
            <textarea rows={4} value={f.details} onChange={(e) => set("details")(e.target.value)} maxLength={DETAILS_MAX} className={inputCls} placeholder="The occasion, food, drinks, anything we should know" />
          </label>
          {me && <p className="font-body text-[0.875rem] leading-relaxed" style={{ color: C.faint }}>We&rsquo;ll reach you at {me.email}{me.phone ? ` or ${me.phone}` : ""}, from your account. Nothing is paid or held in the app.</p>}
        </>
      )}
      {error && <Notice>{error}</Notice>}
      <button type="submit" disabled={busy || !ready} className="w-full rounded-lg py-3.5 font-body text-[0.875rem] tracking-[0.22em] uppercase transition-colors disabled:opacity-50 bg-[#C9A96E] text-[#13170F] hover:bg-[#d6b77d]">
        {busy ? "Sending…" : kind === "message" ? "Send to the bar" : kind === "request" ? "Send request" : "Send inquiry"}
      </button>
    </form>
  );
}

/** "Ask about this" on a cocktail, bottle or house list page: a new message with the item attached. */
export function AskAboutThis({ kind, id, name }: { kind: InboxRef["kind"]; id: number; name: string }) {
  return (
    <div className="mt-6">
      <Link href={askHref(kind, id, name)} scroll={false} className="inline-flex items-center gap-2 rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] tracking-[0.12em] uppercase pp-focus pp-press"
        style={{ borderColor: C.line, color: C.text }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M4 5h16v11H8l-4 4z" /></svg>
        Ask about this
      </Link>
    </div>
  );
}
