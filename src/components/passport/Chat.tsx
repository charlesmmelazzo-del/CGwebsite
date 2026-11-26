"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { C, Notice } from "./ui";
import { reducedMotion } from "./appEvents";
import {
  BODY_MAX, REACTIONS, ROOM_POLL_MS, chatLines, composerBottom, hiddenWords, insertMention, keyboardOpen, mentionQuery, mentionsLeft, timeOf,
  type ChatReaction, type MentionOption,
} from "@/lib/passport/chat";

/**
 * File 16: one conversation screen for every kind (the bar, a friend, a group, a channel, a thread), like a
 * text-messaging app: bubbles (mine on the right; others on the left, with their name in groups and channels), day
 * separators, the time when a message is tapped, newest at the bottom, the composer fixed above the keyboard, older
 * messages loading as the member scrolls up, and a "New messages" jump when they have scrolled away from the bottom.
 */

export interface UiPost {
  id: number; at: string; hidden?: boolean; mine?: boolean; author?: string; fromBar?: boolean; body?: string;
  /** In place of the words: "Removed by Common Good", "Message deleted", "This message was removed." */
  gone?: string | null;
  tag?: string | null;
  quote?: { name: string; text: string } | null;
  reactions?: ChatReaction[];
  share?: ReactNode;
  replies?: number; threadHref?: string; threadLocked?: boolean;
  mentionsMe?: boolean; pinned?: boolean;
  canReport?: boolean; canDelete?: boolean; canBlock?: boolean;
}

/** Ask for news every few seconds while the screen is visible; pause while the tab or app is in the background. */
export function useRoomPoll(load: () => Promise<void>, ms = ROOM_POLL_MS, on = true) {
  const ref = useRef(load);
  ref.current = load;
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!t) t = setInterval(() => { if (document.visibilityState === "visible") void ref.current(); }, ms); };
    const stop = () => { if (t) { clearInterval(t); t = null; } };
    const vis = () => { if (document.visibilityState === "visible") { void ref.current(); start(); } else stop(); };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", vis);
    return () => { stop(); document.removeEventListener("visibilitychange", vis); };
  }, [ms, on]);
}

/** The scrolling box a page sits in (the page over a tab), or the window. */
function scroller(el: HTMLElement | null): HTMLElement {
  let n = el?.parentElement || null;
  while (n) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n;
    if (n.classList.contains("pp-overlay")) return n;
    n = n.parentElement;
  }
  return (document.scrollingElement as HTMLElement) || document.documentElement;
}

/** How much of the screen the on-screen keyboard covers (iPhone and Android), so the composer stays above it. */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const on = () => {
      const i = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(i);
      // With the keyboard open the composer sits right on it and the tab bar is not shown underneath (globals.css).
      if (keyboardOpen(i)) document.documentElement.dataset.ppKeyboard = "open"; else delete document.documentElement.dataset.ppKeyboard;
    };
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    on();
    return () => { vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on); delete document.documentElement.dataset.ppKeyboard; };
  }, []);
  return inset;
}

export interface ChatScreenProps {
  header: ReactNode;
  posts: UiPost[];
  /** Who can read this, in words, shown where members write. */
  line: string;
  canWrite: boolean;
  whyNot?: string;
  placeholder: string;
  max?: number;
  showNames?: boolean;
  /** Replies that quote a message, and reactions, where the conversation has them. */
  replies?: boolean;
  reactions?: boolean;
  hasMore?: boolean;
  onOlder?: () => Promise<void>;
  onSend: (text: string, extra: { replyTo: number | null; mentions: string[] }) => Promise<boolean>;
  onReact?: (postId: number, emoji: string) => Promise<void>;
  onReport?: (post: UiPost) => void;
  onBlock?: (post: UiPost) => void;
  onDelete?: (post: UiPost) => Promise<void>;
  mentionSource?: (q: string) => Promise<MentionOption[]>;
  above?: ReactNode;
  busy?: boolean;
  error?: string;
  emptyText?: string;
}

export function ChatScreen(p: ChatScreenProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<UiPost | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // The composer is fixed above the tab bar (or the keyboard); the list leaves room for all of it below the last message.
  const [composerH, setComposerH] = useState(120);
  const lastId = p.posts.length ? p.posts[p.posts.length - 1].id : 0;
  const firstId = p.posts.length ? p.posts[0].id : 0;
  const prevLast = useRef(0);
  const prevFirst = useRef(0);
  const heightBefore = useRef(0);
  const nearBottom = () => { const b = boxRef.current; return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 160; };
  const toBottom = useCallback((smooth = false) => {
    const b = boxRef.current;
    if (!b) return;
    b.scrollTo({ top: b.scrollHeight, behavior: smooth && !reducedMotion() ? "smooth" : ("instant" as ScrollBehavior) });
    setNewBelow(false);
  }, []);
  // Newest at the bottom: start there; follow new messages only while the member is already near the bottom.
  useLayoutEffect(() => {
    boxRef.current = scroller(listRef.current);
    const b = boxRef.current;
    if (!prevLast.current) { toBottom(); }
    else if (firstId < prevFirst.current && heightBefore.current) {
      // Older messages arrived in front: keep the member's place.
      b.scrollTop += b.scrollHeight - heightBefore.current;
      heightBefore.current = 0;
    } else if (lastId > prevLast.current) {
      const mine = p.posts[p.posts.length - 1]?.mine;
      if (mine || nearBottom()) toBottom(true); else setNewBelow(true);
    }
    prevLast.current = lastId;
    prevFirst.current = firstId;
  }, [lastId, firstId, p.posts, toBottom]);
  // Older messages load as the member scrolls up; the jump goes once they are back at the bottom.
  const hasMore = p.hasMore;
  const onOlder = p.onOlder;
  useEffect(() => {
    const b = boxRef.current;
    if (!b) return;
    const target: HTMLElement | Window = b === document.scrollingElement || b === document.documentElement ? window : b;
    const on = () => {
      if (b.scrollHeight - b.scrollTop - b.clientHeight < 160) setNewBelow(false);
      if (hasMore && onOlder && !loadingOlder && b.scrollTop < 120) {
        setLoadingOlder(true);
        heightBefore.current = b.scrollHeight;
        void onOlder().finally(() => setLoadingOlder(false));
      }
    };
    target.addEventListener("scroll", on, { passive: true });
    return () => target.removeEventListener("scroll", on);
  }, [hasMore, onOlder, loadingOlder]);

  const lines = chatLines(p.posts);
  return (
    <div ref={listRef} style={{ paddingBottom: composerH + 12 }}>
      {p.header}
      {p.above}
      {p.hasMore && <p className="text-center pp-t-secondary mt-4" style={{ color: C.faint }}>{loadingOlder ? "Loading earlier messages…" : <button type="button" className="underline pp-focus rounded min-h-[44px] px-2" onClick={() => { if (!p.onOlder) return; heightBefore.current = boxRef.current?.scrollHeight || 0; setLoadingOlder(true); void p.onOlder().finally(() => setLoadingOlder(false)); }}>Load earlier messages</button>}</p>}
      <ol className="mt-4 space-y-1.5" aria-label="Messages" aria-live="polite">
        {!p.posts.length && <li className="pp-t-secondary py-6 text-center" style={{ color: C.faint }}>{p.emptyText || "No messages yet. Say hello."}</li>}
        {lines.map((l) => l.kind === "day" ? (
          <li key={l.key} className="flex justify-center py-2"><span className="pp-t-eyebrow rounded-full px-3 py-1" style={{ color: C.muted, background: C.card }}>{l.label}</span></li>
        ) : l.kind === "hidden" ? (
          <li key={l.key} className="flex justify-center"><span className="pp-t-secondary italic" style={{ color: C.faint }}>{hiddenWords(l.count)}</span></li>
        ) : (
          <Bubble key={l.key} post={l.post} showName={!!p.showNames} open={selected === l.post.id} onTap={() => setSelected(selected === l.post.id ? null : l.post.id)}
            replies={!!p.replies} reactions={!!p.reactions} onReply={() => { setReplyTo(l.post); setSelected(null); }}
            onReact={p.onReact ? (e) => p.onReact!(l.post.id, e) : undefined} onReport={p.onReport ? () => { setSelected(null); p.onReport!(l.post); } : undefined}
            onBlock={p.onBlock ? () => { setSelected(null); p.onBlock!(l.post); } : undefined} onDelete={p.onDelete ? () => { setSelected(null); void p.onDelete!(l.post); } : undefined} />
        ))}
      </ol>
      <Composer {...p} replyTo={replyTo} clearReply={() => setReplyTo(null)} onHeight={setComposerH}
        jump={newBelow ? <button type="button" onClick={() => toBottom(true)} className="pointer-events-auto rounded-full px-4 min-h-[40px] pp-t-secondary shadow-lg pp-focus" style={{ background: C.brass, color: C.bg }}>New messages ↓</button> : null} />
    </div>
  );
}

function Bubble({ post, showName, open, onTap, replies, reactions, onReply, onReact, onReport, onBlock, onDelete }: {
  post: UiPost; showName: boolean; open: boolean; onTap: () => void; replies: boolean; reactions: boolean; onReply: () => void;
  onReact?: (emoji: string) => void; onReport?: () => void; onBlock?: () => void; onDelete?: () => void;
}) {
  const mine = !!post.mine;
  const bubble = mine ? { background: "#2a3220", color: C.text } : post.fromBar ? { background: "#1d2a2a", color: C.text, border: `1px solid #2f4a48` } : { background: C.card, color: C.text, border: `1px solid ${C.line}` };
  const acts = !post.gone;
  return (
    <li className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {showName && !mine && <span className="pp-t-secondary ml-3 mb-0.5" style={{ color: post.fromBar ? "#8fc4be" : C.muted }}>{post.author}</span>}
      <button type="button" onClick={onTap} aria-expanded={open} className={`max-w-[85%] text-left rounded-2xl px-4 py-2.5 pp-focus ${post.mentionsMe ? "ring-1" : ""}`}
        style={{ ...bubble, ...(post.mentionsMe ? { boxShadow: `0 0 0 1px ${C.brass}` } : {}) }}>
        {post.pinned && <span className="block pp-t-eyebrow mb-1" style={{ color: C.brass }}>Pinned</span>}
        {post.tag && <span className="block pp-t-eyebrow mb-1" style={{ color: C.brass }}>{post.tag}</span>}
        {post.quote && (
          <span className="block border-l-2 pl-2 mb-1.5 pp-t-secondary" style={{ borderColor: C.brass, color: C.muted }}>
            <span className="block font-medium" style={{ color: C.text }}>{post.quote.name}</span>{post.quote.text}
          </span>
        )}
        {post.gone ? <span className="block pp-t-secondary italic" style={{ color: C.faint }}>{post.gone}</span> : (
          <>
            {post.share && <span className="block mb-1.5 min-w-[200px]" onClick={(e) => e.stopPropagation()}>{post.share}</span>}
            {post.body && <span className="block font-body text-[1rem] leading-relaxed whitespace-pre-wrap break-words">{post.body}</span>}
          </>
        )}
        {open && <span className="block pp-t-secondary mt-1" style={{ color: C.faint }}>{timeOf(post.at)}</span>}
      </button>
      {!!post.reactions?.length && (
        <span className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
          {post.reactions.map((r) => (
            <button key={r.emoji} type="button" disabled={!onReact} onClick={() => onReact?.(r.emoji)} title={r.names.join(", ")} aria-label={`${r.emoji} ${r.count}: ${r.names.join(", ")}${r.mine ? ". Tap to take yours back" : ""}`}
              className="rounded-full border px-2 min-h-[32px] text-[0.875rem] pp-focus" style={{ borderColor: r.mine ? C.brass : C.line, background: r.mine ? "#2a2617" : "transparent", color: C.text }}>
              {r.emoji} <span className="pp-num">{r.count}</span>
            </button>
          ))}
        </span>
      )}
      {open && !!post.reactions?.length && <span className="pp-t-secondary mt-0.5" style={{ color: C.faint }}>{post.reactions.map((r) => `${r.emoji} ${r.names.join(", ")}`).join(" · ")}</span>}
      {post.threadHref && (
        <Link href={post.threadHref} scroll={false} className="pp-t-secondary underline underline-offset-4 mt-1 ml-3 min-h-[32px] inline-flex items-center pp-focus rounded" style={{ color: C.brass }}>
          {post.replies ? `${post.replies} ${post.replies === 1 ? "reply" : "replies"}` : "Reply in thread"}{post.threadLocked ? " · closed" : ""}
        </Link>
      )}
      {open && acts && (
        <span className={`flex flex-wrap items-center gap-1 mt-1 ${mine ? "justify-end" : ""}`} role="group" aria-label="Message actions">
          {reactions && onReact && REACTIONS.map((e) => <button key={e} type="button" aria-label={`React ${e}`} onClick={() => onReact(e)} className="w-10 h-10 rounded-full border text-[1.125rem] pp-focus" style={{ borderColor: C.line }}>{e}</button>)}
          {replies && <ActBtn onClick={onReply}>Reply</ActBtn>}
          {onDelete && post.canDelete && <ActBtn onClick={onDelete}>Delete</ActBtn>}
          {onReport && post.canReport && <ActBtn onClick={onReport} warn>Report</ActBtn>}
          {onBlock && post.canBlock && <ActBtn onClick={onBlock}>Block</ActBtn>}
        </span>
      )}
    </li>
  );
}
function ActBtn({ children, onClick, warn = false }: { children: ReactNode; onClick: () => void; warn?: boolean }) {
  return <button type="button" onClick={onClick} className="rounded-full border px-3 min-h-[40px] pp-t-secondary pp-focus" style={{ borderColor: C.line, color: warn ? C.accent : C.text }}>{children}</button>;
}

function Composer({ canWrite, whyNot, placeholder, max = BODY_MAX, line, onSend, mentionSource, busy, error, replyTo, clearReply, onHeight, jump }: ChatScreenProps & { replyTo: UiPost | null; clearReply: () => void; onHeight: (h: number) => void; jump: ReactNode }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<MentionOption[]>([]);
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [q, setQ] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const block = useRef<HTMLDivElement>(null);
  const kb = useKeyboardInset();
  useEffect(() => {
    if (q === null || !mentionSource) { setOptions([]); return; }
    let off = false;
    const t = setTimeout(() => { void mentionSource(q).then((o) => { if (!off) setOptions(o); }).catch(() => {}); }, 150);
    return () => { off = true; clearTimeout(t); };
  }, [q, mentionSource]);
  useEffect(() => { if (replyTo) ta.current?.focus(); }, [replyTo]);
  // Tell the list how tall the composer block is, so the last message and its reactions are never under it.
  useEffect(() => {
    const el = block.current;
    if (!el) return;
    const report = () => onHeight(Math.ceil(el.getBoundingClientRect().height));
    report();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight, canWrite]);
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    const ok = await onSend(text, { replyTo: replyTo ? replyTo.id : null, mentions: mentionsLeft(text, picked) });
    if (ok) { setText(""); setPicked([]); setQ(null); clearReply(); }
  };
  const pick = (o: MentionOption) => {
    const el = ta.current;
    const caret = el ? el.selectionStart : text.length;
    const next = insertMention(text, caret, o.name);
    setText(next.text);
    setPicked((x) => [...x.filter((y) => y.seat !== o.seat), o]);
    setQ(null);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(next.caret, next.caret); } });
  };
  // File 16: the whole block (who can read it, then the box and Send) is fixed above the tab bar and the safe area, or
  // directly on top of the keyboard while it is open: never under the tab bar on any phone.
  return (
    <div ref={block} data-pp-composer className="fixed inset-x-0 z-30 border-t" style={{ bottom: composerBottom(kb), background: "rgba(19,23,15,0.97)", borderColor: C.line }}>
      {jump && <div className="absolute inset-x-0 bottom-full flex justify-center pb-3 pointer-events-none">{jump}</div>}
      <div className="max-w-xl mx-auto px-5 pt-2 pb-2.5">
        <p data-pp-line className="pp-t-secondary leading-snug mb-1.5" style={{ color: C.faint }}>{canWrite && text.length > max - 150 ? `${max - text.length} characters left` : line}</p>
        {!canWrite ? <Notice>{whyNot || "You can't write here right now."}</Notice> : (
          <form onSubmit={submit}>
            {replyTo && (
              <div className="flex items-start gap-2 mb-2 border-l-2 pl-2" style={{ borderColor: C.brass }}>
                <span className="flex-1 min-w-0 pp-t-secondary truncate" style={{ color: C.muted }}>Replying to <span style={{ color: C.text }}>{replyTo.mine ? "yourself" : replyTo.author}</span>: {(replyTo.body || "").slice(0, 80)}</span>
                <button type="button" onClick={clearReply} aria-label="Cancel the reply" className="w-9 h-9 rounded-full pp-focus" style={{ color: C.muted }}>×</button>
              </div>
            )}
            {options.length > 0 && q !== null && (
              <ul className="mb-2 rounded-xl border max-h-48 overflow-y-auto" style={{ borderColor: C.line, background: C.card }} role="listbox" aria-label="People in this conversation">
                {options.map((o) => <li key={o.seat}><button type="button" role="option" aria-selected={false} onClick={() => pick(o)} className="w-full text-left px-4 min-h-[44px] font-body pp-focus" style={{ color: C.text }}>@{o.name}</button></li>)}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="pp-chat-compose">{placeholder}</label>
              <textarea id="pp-chat-compose" ref={ta} rows={1} maxLength={max} value={text} placeholder={placeholder}
                onChange={(e) => { setText(e.target.value); setQ(mentionSource ? mentionQuery(e.target.value, e.target.selectionStart) : null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia?.("(pointer: fine)").matches) { e.preventDefault(); void submit(); } }}
                className="flex-1 rounded-2xl border px-4 py-2.5 font-body text-[1rem] leading-snug resize-none max-h-36 pp-focus" style={{ background: C.card, borderColor: C.line, color: C.text, fieldSizing: "content" } as React.CSSProperties} />
              <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 pp-focus pp-press" style={{ background: C.brass, color: C.bg }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
            {error && <div className="mt-2"><Notice>{error}</Notice></div>}
          </form>
        )}
      </div>
    </div>
  );
}
