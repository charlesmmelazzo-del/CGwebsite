"use client";

import { Band } from "./Library";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { C, Notice, postJson } from "./ui";
import { notifyChanged } from "./appEvents";
import { useShell } from "./shellContext";
import { Sheet } from "./Social";
import { Collage } from "./Drill";
import { ACCENTS } from "@/lib/passport/accents";
import { whenShort, needsYou } from "@/lib/passport/inbox";
import { money } from "@/lib/passport/bottles";
import {
  MESSAGES_TABS, badgeText, channelHref, chatHref, switcherItems,
  type ChannelCard, type ChatOverview, type ChatRow, type MessagesTabId,
} from "@/lib/passport/chat";
import type { BottleRequest, CommentNotice, EventNotice, FriendsOverview, InboxData, MemberNotice, SocialInbox } from "@/lib/passport/types";
import { itemHref } from "@/lib/passport/votes";

/**
 * File 16: the Messages tab's parts. Tabs across the top (Chats · Channels · Requests · Bottles · Friends) with a badge
 * on each that has something waiting; "Needs you" as a compact strip above them; the quick switcher; the "New message"
 * sheet. Everything here is the signed-in member's own (the Bible decides).
 */

const teal = ACCENTS.inbox;
const Dot = () => <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: C.accent }}><span className="sr-only">Unread</span></span>;
function Count({ n, mention = false }: { n: number; mention?: boolean }) {
  if (!n && !mention) return null;
  return <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full pp-num text-[0.75rem] font-medium shrink-0" style={{ background: C.accent, color: C.bg }} aria-label={mention ? `${n} unread, mentions you` : `${n} unread`}>{mention ? "@" : ""}{n ? badgeText(n) : ""}</span>;
}

// ── The top tabs ─────────────────────────────────────────────────────────────
export function TopTabs({ current, badges, onPick, stripRef }: { current: MessagesTabId; badges: Record<MessagesTabId, number>; onPick: (t: MessagesTabId) => void; stripRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div ref={stripRef} className="sticky z-20 -mx-5 mt-3 border-b" style={{ top: "var(--pp-top)", background: "rgba(19,23,15,0.97)", borderColor: C.line }}>
      <div role="tablist" aria-label="Messages sections" className="pp-tabs flex gap-0.5 overflow-x-auto px-3">
        {MESSAGES_TABS.map((t) => {
          const on = t.id === current;
          const n = badges[t.id];
          return (
            <button key={t.id} type="button" role="tab" id={`msg-tab-${t.id}`} aria-selected={on} aria-controls="msg-panel" onClick={() => onPick(t.id)}
              className="shrink-0 px-3 min-h-[48px] pp-t-body whitespace-nowrap pp-focus relative inline-flex items-center gap-1.5" style={{ color: on ? C.text : C.muted, fontWeight: on ? 500 : 400 }}>
              {t.label}
              {n > 0 && <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full pp-num text-[0.6875rem]" style={{ background: C.accent, color: C.bg }} aria-label={`${n} waiting`}>{badgeText(n)}</span>}
              <span aria-hidden className="absolute left-2 right-2 bottom-0 h-[3px] rounded-full" style={{ background: on ? teal.edge : "transparent" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── "Needs you", compact ─────────────────────────────────────────────────────
export function NeedsStrip({ inbox, bottles, offers }: { inbox: InboxData | null; bottles: BottleRequest[]; offers: EventNotice[] }) {
  const items: { key: string; label: string; title: string; href: string }[] = [
    ...needsYou(inbox, bottles).filter((n) => n.kind === "question" || n.kind === "price" || n.kind === "ready").map((n) => ({
      key: n.key, href: n.kind === "question" ? "/passport/inbox?tab=requests" : n.href,
      label: n.kind === "question" ? "A question from the bar" : n.kind === "price" ? "A price to answer" : "Ready for pickup",
      title: n.kind === "question" ? n.request.kind_label : n.kind === "price" ? `${n.bottle.name}${n.bottle.quote ? ` · ${money(n.bottle.quote.price_cents)}` : ""}` : n.kind === "ready" ? n.bottle.name : "",
    })),
    ...offers.map((o) => ({ key: `o${o.id}`, href: `/passport/events/${o.id}`, label: "A place held for you", title: o.title })),
  ];
  if (!items.length) return null;
  return (
    <section aria-label="Needs you" className="mt-2">
      <p className="pp-t-eyebrow mb-1.5" style={{ color: C.brass }}>Needs you</p>
      <ul className="pp-tabs -mx-5 px-5 flex gap-2 overflow-x-auto pb-1">
        {items.map((x) => (
          <li key={x.key} className="shrink-0 max-w-[260px]">
            <Link href={x.href} scroll={false} className="block rounded-xl border px-3.5 py-2.5 pp-focus pp-row" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
              <span className="block pp-t-secondary" style={{ color: C.brass }}>{x.label}</span>
              <span className="block font-body text-[0.9375rem] truncate" style={{ color: C.text }}>{x.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Chats ────────────────────────────────────────────────────────────────────
function ChatLine({ c }: { c: ChatRow }) {
  const unread = c.unread > 0;
  return (
    <li>
      <Link href={chatHref(c)} scroll={false} className="flex items-center gap-3 py-3 border-b pp-row pp-focus rounded-sm" style={{ borderColor: C.line }}>
        <Avatar kind={c.kind} name={c.name} />
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`font-display text-[1.1875rem] leading-tight truncate`} style={{ color: C.text }}>{c.name}{c.kind === "bar" && c.subtitle ? <span className="font-body text-[0.875rem]" style={{ color: C.muted }}> · {c.subtitle}</span> : null}</span>
            <span className="font-body text-[0.75rem] shrink-0" style={{ color: unread ? C.brass : C.faint }}>{whenShort(c.last_at)}</span>
          </span>
          <span className="flex items-center gap-2 mt-0.5">
            <span className="flex-1 block font-body text-[0.875rem] truncate" style={{ color: unread ? C.text : C.muted, fontWeight: unread ? 500 : 400 }}>{c.preview || (c.kind === "bar" ? c.status_label : "")}</span>
            <Count n={c.unread} mention={c.mentions > 0} />
          </span>
        </span>
      </Link>
    </li>
  );
}
function Avatar({ kind, name }: { kind: ChatRow["kind"] | "channel"; name: string }) {
  const bar = kind === "bar";
  const initials = bar ? "CG" : kind === "channel" ? "#" : name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <span aria-hidden className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-display text-[1rem]"
      style={bar ? { background: "#1d2318", border: `1.5px solid ${C.brass}`, color: C.brass } : kind === "group" ? { background: teal.tint, color: teal.ink } : { background: C.card, border: `1px solid ${C.line}`, color: C.muted }}>
      {kind === "group" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.5" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14.5 15c2.6-.4 4.7.9 5.5 3.5" /></svg> : initials}
    </span>
  );
}
export function ChatsPanel({ chat, social, onNew }: { chat: ChatOverview | null; social: SocialInbox | null; onNew: () => void }) {
  const [invites, setInvites] = useState(chat?.invitations || []);
  const [notices, setNotices] = useState<MemberNotice[]>(social?.notices || []);
  const { toast } = useShell() || { toast: () => {} };
  const router = useRouter();
  useEffect(() => { setInvites(chat?.invitations || []); }, [chat]);
  useEffect(() => { setNotices(social?.notices || []); }, [social]);
  const answer = async (id: number, yes: boolean) => {
    const r = await postJson<{ room?: { id: number } }>(`/api/passport/chat/group/${id}`, { action: yes ? "accept" : "decline" });
    if (!r.ok) { toast(r.data.error || "Couldn't do that. Please try again."); return; }
    setInvites((x) => x.filter((i) => i.id !== id));
    notifyChanged("inbox");
    if (yes) router.push(`/passport/inbox/groups/${id}`, { scroll: false }); else toast("Declined.");
  };
  const read = async (n: MemberNotice) => {
    if (!n.unread) return;
    setNotices((x) => x.map((y) => (y.id === n.id ? { ...y, unread: false } : y)));
    await postJson("/api/passport/friends", { action: "notice_read", id: n.id });
    notifyChanged("inbox");
  };
  const replies: CommentNotice[] = social?.comment_replies || [];
  const chats = chat?.chats || [];
  return (
    <div>
      <button type="button" onClick={onNew} className="w-full flex items-center justify-center gap-2 rounded-full border min-h-[46px] font-body text-[0.9375rem] pp-focus pp-press" style={{ borderColor: C.brass, background: C.brass, color: C.bg }}>
        <span aria-hidden>+</span> New message
      </button>
      {notices.filter((n) => n.unread).map((n) => (
        <button key={n.id} type="button" onClick={() => read(n)} className="w-full text-left mt-3 rounded-xl border px-4 py-3 pp-focus" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
          <span className="block pp-t-eyebrow" style={{ color: C.brass }}>A note from the bar · new</span>
          <span className="block font-body text-[1rem] mt-1 whitespace-pre-wrap" style={{ color: C.text }}>{n.body}</span>
        </button>
      ))}
      {invites.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Group invitations">
          {invites.map((i) => (
            <li key={i.id} className="rounded-xl border px-4 py-3" style={{ borderColor: `${teal.edge}`, background: teal.tint }}>
              <span className="block pp-t-eyebrow" style={{ color: teal.ink }}>Group invitation</span>
              <span className="block font-display text-[1.25rem] mt-0.5" style={{ color: C.text }}>{i.name}</span>
              <span className="block pp-t-secondary" style={{ color: C.muted }}>{i.from_name ? `${i.from_name} added you` : "You were added"} · {i.people} {i.people === 1 ? "person" : "people"}</span>
              <span className="flex gap-2 mt-2">
                <button type="button" onClick={() => answer(i.id, true)} className="rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] pp-focus" style={{ borderColor: C.brass, background: C.brass, color: C.bg }}>Join</button>
                <button type="button" onClick={() => answer(i.id, false)} className="rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] pp-focus" style={{ borderColor: C.line, color: C.text }}>Decline</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {replies.filter((n) => n.unread).length > 0 && (
        <ul className="mt-3 space-y-2">
          {replies.filter((n) => n.unread).map((n) => {
            const href = itemHref(n.link_kind, n.link_id);
            return <li key={n.id}>{href ? <Link href={href} scroll={false} className="block rounded-xl border px-4 py-3 pp-focus" style={{ borderColor: C.line, background: C.card }}><span className="block pp-t-eyebrow" style={{ color: C.brass }}>New reply to your comment</span><span className="block font-body text-[0.9375rem] mt-0.5" style={{ color: C.text }}>{n.name} replied on “{n.title}”</span></Link> : null}</li>;
          })}
        </ul>
      )}
      {!chat && <p className="font-body text-sm mt-6" style={{ color: C.faint }}>Your conversations can&rsquo;t load right now. Come back in a minute.</p>}
      {chat && (
        <ul className="mt-3">
          {!chats.some((c) => c.kind === "bar") && (
            <li>
              <Link href="/passport/inbox/new?kind=message" scroll={false} className="flex items-center gap-3 py-3 border-b pp-row pp-focus rounded-sm" style={{ borderColor: C.line }}>
                <Avatar kind="bar" name="Common Good" />
                <span className="flex-1 min-w-0"><span className="block font-display text-[1.1875rem]" style={{ color: C.text }}>Common Good</span><span className="block font-body text-[0.875rem]" style={{ color: C.muted }}>Message the bar about anything. Replies can take a day.</span></span>
              </Link>
            </li>
          )}
          {chats.map((c) => <ChatLine key={`${c.kind}${c.id}`} c={c} />)}
        </ul>
      )}
      {chat && !chats.some((c) => c.kind !== "bar") && <p className="font-body text-sm mt-4" style={{ color: C.faint }}>Chats with friends and groups show here. Start one with New message.</p>}
    </div>
  );
}

// ── Channels ─────────────────────────────────────────────────────────────────
function ChannelLine({ c, onJoin }: { c: ChannelCard; onJoin?: () => void }) {
  const unread = (c.unread || 0) > 0 && !c.muted;
  const cover = (
    <span className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
      <Collage covers={(c.covers || []).map((x) => ({ kind: x.kind, id: x.id, photo: x.photo, name: x.name || "", ...(x.photo_clear ? { clear: true } : {}) }))} section="inbox" label={c.name} />
    </span>
  );
  const body = (
    <span className="flex-1 min-w-0">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[1.1875rem] leading-tight truncate" style={{ color: C.text }}>{c.name}{c.pinned ? <span className="sr-only"> (pinned)</span> : null}</span>
        {c.joined ? <span className="font-body text-[0.75rem] shrink-0" style={{ color: unread ? C.brass : C.faint }}>{c.muted ? "Muted" : whenShort(c.last_at || null)}</span> : null}
      </span>
      <span className="flex items-center gap-2 mt-0.5">
        <span className="flex-1 block font-body text-[0.875rem] truncate" style={{ color: unread ? C.text : C.muted }}>{c.joined ? c.preview || c.description : c.description}</span>
        {c.joined && <Count n={c.muted ? 0 : c.unread || 0} mention={(c.mentions || 0) > 0} />}
      </span>
      {!c.joined && <span className="block pp-t-secondary mt-0.5" style={{ color: C.faint }}>{c.people} {c.people === 1 ? "person" : "people"}{c.started_by ? ` · Started by ${c.started_by}` : ""}{c.bar_only ? " · from Common Good" : ""}</span>}
    </span>
  );
  if (c.joined) return <li><Link href={channelHref(c.id)} scroll={false} className="flex items-center gap-3 py-3 border-b pp-row pp-focus rounded-sm" style={{ borderColor: C.line }}>{cover}{body}</Link></li>;
  return (
    <li className="flex items-center gap-3 py-3 border-b" style={{ borderColor: C.line }}>
      {cover}{body}
      <button type="button" onClick={onJoin} className="rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] shrink-0 pp-focus" style={{ borderColor: C.brass, color: C.brass }}>Join</button>
    </li>
  );
}
export function ChannelsPanel({ chat }: { chat: ChatOverview | null }) {
  const router = useRouter();
  const shell = useShell();
  if (!chat) return <p className="font-body text-sm mt-6" style={{ color: C.faint }}>Channels can&rsquo;t load right now. Come back in a minute.</p>;
  const join = async (id: number) => {
    const r = await postJson(`/api/passport/chat/channel/${id}`, { action: "join" });
    if (!r.ok) { shell?.toast(r.data.error || "Couldn't join. Please try again."); return; }
    notifyChanged("inbox");
    router.push(channelHref(id), { scroll: false });
  };
  return (
    <div>
      <p className="pp-t-secondary" style={{ color: C.faint }}>Rooms on one topic for members. Not private: everyone in a channel and the Common Good team can read it.</p>
      {chat.channels.length > 0 ? <ul className="mt-2">{chat.channels.map((c) => <ChannelLine key={c.id} c={c} />)}</ul> : <p className="font-body text-sm mt-4" style={{ color: C.muted }}>You haven&rsquo;t joined a channel yet. Browse below.</p>}
      {chat.browse.length > 0 && (
        <section aria-labelledby="pp-browse" className="mt-8">
          <Band section="inbox" id="pp-browse" className="mb-1">Browse</Band>
          <ul>{chat.browse.map((c) => <ChannelLine key={c.id} c={c} onJoin={() => join(c.id)} />)}</ul>
        </section>
      )}
      {chat.proposals.length > 0 && (
        <section aria-labelledby="pp-ideas" className="mt-8">
          <Band section="inbox" id="pp-ideas" className="mb-2">Your channel ideas</Band>
          <ul className="space-y-2">{chat.proposals.map((p) => (
            <li key={p.id} className="rounded-xl border px-4 py-3" style={{ borderColor: C.line, background: C.card }}>
              <span className="block font-display text-[1.125rem]" style={{ color: C.text }}>{p.name}</span>
              <span className="block pp-t-secondary" style={{ color: p.status === "declined" ? C.accent : C.muted }}>{p.status_label}{p.decline_reason ? `: ${p.decline_reason}` : ""}</span>
            </li>
          ))}</ul>
        </section>
      )}
      {chat.can_start !== "off" && (
        <Link href="/passport/inbox/channels/new" scroll={false} className="mt-6 flex items-center justify-center rounded-full border min-h-[46px] font-body text-[0.9375rem] pp-focus" style={{ borderColor: C.line, color: C.text }}>
          {chat.can_start === "on" ? "Start a channel" : "Suggest a channel"}
        </Link>
      )}
    </div>
  );
}

// ── New message ──────────────────────────────────────────────────────────────
export function NewMessageSheet({ friends, onClose }: { friends: FriendsOverview | null; onClose: () => void }) {
  const list = friends?.friends || [];
  const row = (href: string, title: string, sub: string, icon: ReactNode) => (
    <li><Link href={href} scroll={false} onClick={onClose} className="flex items-center gap-3 px-1 min-h-[56px] border-b pp-focus pp-row" style={{ borderColor: C.line }}>{icon}<span className="flex-1 min-w-0"><span className="block font-body text-[1rem]" style={{ color: C.text }}>{title}</span><span className="block pp-t-secondary truncate" style={{ color: C.faint }}>{sub}</span></span></Link></li>
  );
  return (
    <Sheet title="New message" onClose={onClose}>
      <ul>
        {row("/passport/inbox/new?kind=message", "Common Good", "Write to the bar", <Avatar kind="bar" name="CG" />)}
        {row("/passport/inbox/groups/new", "New group", "A private chat with some of your friends", <Avatar kind="group" name="" />)}
      </ul>
      <p className="pp-t-eyebrow mt-5 mb-1" style={{ color: C.muted }}>A friend</p>
      {!list.length ? <p className="font-body text-sm" style={{ color: C.muted }}>Add a friend first, on the Friends tab.</p> : (
        <ul>{list.map((f) => <li key={f.id}><Link href={f.conversation_id ? `/passport/inbox/friends/${f.conversation_id}` : `/passport/inbox/friends/new?friend=${f.id}`} scroll={false} onClick={onClose} className="flex items-center gap-3 px-1 min-h-[52px] border-b pp-focus pp-row" style={{ borderColor: C.line }}><Avatar kind="friend" name={f.name} /><span className="font-body text-[1rem]" style={{ color: C.text }}>{f.name}</span>{f.unread && <Dot />}</Link></li>)}</ul>
      )}
    </Sheet>
  );
}

// ── The quick switcher ───────────────────────────────────────────────────────
export function SwitcherButton({ chat }: { chat: ChatOverview | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Jump to a chat or channel" className="w-11 h-11 rounded-full border flex items-center justify-center pp-focus pp-press shrink-0" style={{ borderColor: C.line, color: C.text }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M4 12h10M4 17h7" /><circle cx="17.5" cy="16" r="2.8" /><path d="m19.6 18.1 1.9 1.9" /></svg>
      </button>
      {open && <Switcher chat={chat} onClose={() => setOpen(false)} />}
    </>
  );
}
function Switcher({ chat, onClose }: { chat: ChatOverview | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const items = useMemo(() => switcherItems(chat, q), [chat, q]);
  return (
    <Sheet title="Jump to" onClose={onClose}>
      <label className="sr-only" htmlFor="pp-switch">Filter chats and channels</label>
      <input id="pp-switch" ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" autoComplete="off" className="w-full rounded-xl border px-4 min-h-[46px] font-body pp-focus" style={{ background: C.card, borderColor: C.line, color: C.text }} />
      {!chat && <div className="mt-3"><Notice>Couldn&rsquo;t load your chats. Please try again.</Notice></div>}
      <ul className="mt-3">
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} scroll={false} onClick={onClose} className="flex items-center gap-3 px-1 min-h-[52px] border-b pp-focus pp-row" style={{ borderColor: C.line }}>
              <Avatar kind={i.kind} name={i.name} />
              <span className="flex-1 min-w-0"><span className="block font-body text-[1rem] truncate" style={{ color: C.text, fontWeight: i.unread ? 500 : 400 }}>{i.kind === "channel" ? "# " : ""}{i.name}</span><span className="block pp-t-secondary truncate" style={{ color: C.faint }}>{i.sub}</span></span>
              <Count n={i.unread} mention={i.mentions > 0} />
            </Link>
          </li>
        ))}
        {chat && !items.length && <li className="pp-t-secondary py-4" style={{ color: C.faint }}>Nothing matches.</li>}
      </ul>
    </Sheet>
  );
}
