"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { C, Notice, inputCls, postJson } from "./ui";
import { BackLink } from "./bits";
import { notifyChanged } from "./appEvents";
import { useShell } from "./shellContext";
import { ChatScreen, useRoomPoll, type UiPost } from "./Chat";
import { Sheet, ShareCardView } from "./Social";
import { Collage } from "./Drill";
import {
  CHANNEL_DESC_MAX, CHANNEL_NAME_MAX, GROUP_MAX, GROUP_NAME_MAX, NOTIFY_WORDS, mergePosts, threadHref,
  type ChannelNotify, type ChatPost, type ChatPerson, type ChatRoom, type MentionOption,
} from "@/lib/passport/chat";
import type { Friend, ShareCard } from "@/lib/passport/types";

/**
 * File 16: friend groups, channels and threads, each in the one conversation screen (Chat.tsx). Everything goes through
 * /api/passport/chat, which acts only for the signed-in member; the Bible decides what each member may see.
 */
const OFFLINE = "Couldn't do that. Please try again.";
const smallBtn = "rounded-full border px-4 min-h-[44px] font-body text-[0.875rem] tracking-[0.12em] uppercase disabled:opacity-50 pp-focus pp-press";

/** A message from the Bible as the conversation screen draws it. */
export function uiPost(p: ChatPost, roomId?: number): UiPost {
  if (p.hidden) return { id: p.id, at: p.at, hidden: true };
  const share: ShareCard | null = p.share ? { id: p.id, kind: p.share.kind, name: p.share.name, note: "", from: p.mine ? "me" : "friend", from_name: null, ref_id: p.share.ref_id, opens: p.share.opens, saved: false, at: p.at, ...(p.share.public_event_id ? { public_event_id: p.share.public_event_id } : {}),
    // File 17: the shared item's small picture (photo_logo: a brand logo, drawn on its light panel; file 17b:
    // photo_logo_light, a light logo, on the dark panel).
    ...(p.share.photo ? { photo: p.share.photo, ...(p.share.photo_clear ? { photo_clear: true } : {}), ...(p.share.photo_logo ? { photo_logo: true, ...(p.share.photo_logo_light ? { photo_logo_light: true } : {}) } : {}) } : {}) } : null;
  return {
    id: p.id, at: p.at, mine: p.mine, author: p.from_name, fromBar: p.from_bar, body: p.body,
    gone: p.removed === "bar" ? "Removed by Common Good" : p.removed === "author" ? "Message deleted" : null,
    quote: p.reply_to ? { name: p.reply_to.name, text: p.reply_to.text } : null, reactions: p.reactions || [], share: share ? <ShareCardView s={share} inThread /> : null,
    replies: p.replies, threadHref: roomId && p.replies !== undefined ? threadHref(roomId, p.id) : undefined, threadLocked: p.thread_locked,
    mentionsMe: p.mentions_me, pinned: p.pinned, canReport: p.can_report, canDelete: p.can_delete, canBlock: !!p.person,
  };
}

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

/** Report or block the writer of one message (the same Report sheet as file 09, for groups and channels). */
function ReportMessage({ post, onClose }: { post: UiPost; onClose: () => void }) {
  const shell = useShell();
  const [reason, setReason] = useState("");
  const { send, busy, error } = useSend();
  return (
    <Sheet title="Report this message" onClose={onClose}>
      <p className="font-body text-sm leading-relaxed" style={{ color: C.muted }}>Our team will see this message and a few around it. {post.author} won&rsquo;t be told who reported it. You can also block them.</p>
      <label className="block mt-4">
        <span className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>Why (optional)</span>
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
      </label>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <button type="button" disabled={busy} onClick={async () => { if (await send("/api/passport/chat", { action: "report", post_id: post.id, reason })) { shell?.toast("Thank you. Our team will look at it."); onClose(); } }}
        className={`${smallBtn} w-full mt-4`} style={{ borderColor: C.accent, color: C.accent }}>{busy ? "Sending…" : "Send report"}</button>
    </Sheet>
  );
}
async function blockWriter(post: UiPost, done: () => void) {
  if (!confirm(`Block ${post.author}? They won't be told. You won't see each other's messages anywhere, and they can no longer reach you.`)) return;
  const r = await postJson("/api/passport/friends", { action: "block", target: `chatpost:${post.id}` });
  if (r.ok) { notifyChanged("inbox"); done(); } else alert(r.data.error || OFFLINE);
}

/** One group or channel: loads, polls every 5 seconds while open, loads older messages, sends. */
function useRoom(kind: "group" | "channel", initial: ChatRoom) {
  const [room, setRoom] = useState(initial);
  const [posts, setPosts] = useState(initial.posts);
  const [hasMore, setHasMore] = useState(!!initial.has_more);
  const [gone, setGone] = useState(false);
  const base = `/api/passport/chat/${kind}/${initial.id}`;
  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.status === 404) { setGone(true); return; }
      if (!res.ok) return;
      const d = await res.json();
      if (d.room) { setRoom(d.room); setPosts((x) => mergePosts(x, d.room.posts)); }
    } catch { /* offline: next time */ }
  }, [base]);
  useRoomPoll(load, undefined, !gone);
  useEffect(() => { notifyChanged("inbox"); }, []);
  const older = useCallback(async () => {
    const first = posts[0];
    if (!first) return;
    const d = await fetch(`${base}?before=${first.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.room) { setPosts((x) => mergePosts(x, d.room.posts, { older: true })); setHasMore(!!d.room.has_more); }
  }, [base, posts]);
  const mention = useCallback(async (q: string): Promise<MentionOption[]> => {
    const d = await fetch(`${base}?mention=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    return d?.options || [];
  }, [base]);
  return { room, setRoom, posts, setPosts, hasMore, older, mention, load, gone, base };
}

function Gone({ title }: { title: string }) {
  return (
    <div className="pb-16">
      <BackLink fallback="/passport/inbox" label="Messages" />
      <h1 className="font-display text-3xl mt-3" style={{ color: C.text }}>{title}</h1>
      <p className="font-body text-[1rem] mt-4" style={{ color: C.muted }}>This conversation is no longer available.</p>
    </div>
  );
}

// ── A friend group ───────────────────────────────────────────────────────────
export function GroupView({ initial }: { initial: ChatRoom }) {
  const r = useRoom("group", initial);
  const { send, busy, error } = useSend();
  const [reporting, setReporting] = useState<UiPost | null>(null);
  const [people, setPeople] = useState(false);
  if (r.gone) return <Gone title={initial.name} />;
  const list = Array.isArray(r.room.people) ? r.room.people : [];
  const header = (
    <div>
      <BackLink fallback="/passport/inbox" label="Messages" />
      <p className="pp-t-eyebrow mt-2" style={{ color: C.brass }}>Group</p>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-3xl leading-tight mt-1" style={{ color: C.text }}>{r.room.name}</h1>
        <button type="button" onClick={() => setPeople(true)} className="pp-t-secondary underline mt-3 shrink-0 min-h-[44px] pp-focus rounded px-1" style={{ color: C.muted }}>{list.filter((p) => !p.invited).length} people</button>
      </div>
      <p className="pp-t-secondary mt-1 truncate" style={{ color: C.faint }}>{list.filter((p) => !p.invited).map((p) => p.name).join(", ")}</p>
    </div>
  );
  return (
    <>
      <ChatScreen header={header} posts={r.posts.map((p) => uiPost(p))} line={r.room.line} canWrite={r.room.can_write} whyNot={r.room.why_not}
        placeholder={`Write to ${r.room.name}`} showNames replies reactions hasMore={r.hasMore} onOlder={r.older} mentionSource={r.mention} busy={busy} error={error}
        onSend={async (text, x) => {
          const out = await send<{ room: ChatRoom }>(r.base, { action: "send", body: text, reply_to: x.replyTo, mentions: x.mentions });
          if (out) { r.setRoom(out.room); r.setPosts((p) => mergePosts(p, out.room.posts)); notifyChanged("inbox"); return true; }
          return false;
        }}
        onReact={async (id, emoji) => { const o = await postJson<{ reactions: ChatPost["reactions"] }>("/api/passport/chat", { action: "react", kind: "chat", post_id: id, emoji }); if (o.ok) r.setPosts((p) => p.map((x) => (x.id === id ? { ...x, reactions: o.data.reactions } : x))); }}
        onDelete={async (post) => { if (!confirm("Delete this message? Everyone sees “Message deleted”.")) return; const o = await postJson("/api/passport/chat", { action: "delete", post_id: post.id }); if (o.ok) void r.load(); }}
        onReport={(post) => setReporting(post)} onBlock={(post) => void blockWriter(post, () => void r.load())} />
      {reporting && <ReportMessage post={reporting} onClose={() => setReporting(null)} />}
      {people && <GroupPeople room={r.room} people={list} onClose={() => setPeople(false)} onRoom={(x) => { r.setRoom(x); }} />}
    </>
  );
}

function GroupPeople({ room, people, onClose, onRoom }: { room: ChatRoom; people: ChatPerson[]; onClose: () => void; onRoom: (r: ChatRoom) => void }) {
  const router = useRouter();
  const shell = useShell();
  const { send, busy, error } = useSend();
  const [name, setName] = useState(room.name);
  const [adding, setAdding] = useState(false);
  const base = `/api/passport/chat/group/${room.id}`;
  const act = async (body: Record<string, unknown>, done: string) => {
    const out = await send<{ room?: ChatRoom; ok?: boolean }>(base, body);
    if (out?.room) onRoom(out.room);
    if (out) shell?.toast(done);
    return out;
  };
  return (
    <Sheet title="People in this group" onClose={onClose}>
      <ul className="divide-y rounded-xl border" style={{ borderColor: C.line }}>
        {people.map((p) => (
          <li key={p.seat} className="flex items-center gap-3 px-4 min-h-[52px]" style={{ borderColor: C.line }}>
            <span className="flex-1 font-body text-[1rem]" style={{ color: C.text }}>{p.name}{p.organiser && <span className="pp-t-secondary ml-2" style={{ color: C.brass }}>organiser</span>}{p.invited && <span className="pp-t-secondary ml-2" style={{ color: C.faint }}>invited</span>}</span>
            {room.organiser && !p.me && <button type="button" disabled={busy} className="pp-t-secondary underline min-h-[44px] pp-focus rounded px-1" style={{ color: C.muted }} onClick={() => { if (confirm(`Remove ${p.name} from the group?`)) void act({ action: "remove", seat: p.seat }, "Removed."); }}>Remove</button>}
          </li>
        ))}
      </ul>
      <p className="pp-t-secondary mt-2" style={{ color: C.faint }}>Up to {GROUP_MAX} people. Anyone in the group can add their own friends; each gets an invitation.</p>
      {adding ? <AddFriends groupId={room.id} people={people} onDone={(x) => { setAdding(false); if (x) onRoom(x); }} /> : <button type="button" onClick={() => setAdding(true)} className={`${smallBtn} w-full mt-3`} style={{ borderColor: C.line, color: C.text }}>Add friends</button>}
      {room.organiser && (
        <form className="mt-5 space-y-2" onSubmit={(e) => { e.preventDefault(); void act({ action: "rename", name }, "Renamed."); }}>
          <label className="block"><span className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>Group name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={GROUP_NAME_MAX} className={inputCls} /></label>
          <button type="submit" disabled={busy || !name.trim() || name.trim() === room.name} className={smallBtn} style={{ borderColor: C.line, color: C.text }}>Rename</button>
        </form>
      )}
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <button type="button" disabled={busy} className={`${smallBtn} w-full mt-6`} style={{ borderColor: C.accent, color: C.accent }}
        onClick={async () => { if (!confirm(`Leave ${room.name}?${room.organiser ? " The person who has been in it longest becomes the organiser." : ""}`)) return; if (await send(base, { action: "leave" })) { notifyChanged("inbox"); router.push("/passport/inbox?tab=chats", { scroll: false }); } }}>Leave the group</button>
    </Sheet>
  );
}

function useFriends() {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/passport/friends", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!off) setFriends(d.friends || []); }).catch(() => { if (!off) setFriends([]); });
    return () => { off = true; };
  }, []);
  return friends;
}
function AddFriends({ groupId, people, onDone }: { groupId: number; people: ChatPerson[]; onDone: (r: ChatRoom | null) => void }) {
  const friends = useFriends();
  const [pick, setPick] = useState<Set<number>>(() => new Set());
  const { send, busy, error } = useSend();
  const there = new Set(people.map((p) => p.name));
  const options = (friends || []).filter((f) => !there.has(f.name));
  return (
    <div className="mt-3 space-y-2">
      {friends === null ? <p className="pp-t-secondary" style={{ color: C.faint }}>One moment…</p> : !options.length ? <p className="pp-t-secondary" style={{ color: C.muted }}>All your friends are already here.</p> : (
        <FriendChecks friends={options} pick={pick} setPick={setPick} />
      )}
      {error && <Notice>{error}</Notice>}
      <div className="flex gap-2">
        <button type="button" className={smallBtn} style={{ borderColor: C.line, color: C.muted }} onClick={() => onDone(null)}>Cancel</button>
        <button type="button" disabled={busy || !pick.size} className={smallBtn} style={{ borderColor: C.brass, background: C.brass, color: C.bg }}
          onClick={async () => { const o = await send<{ room: ChatRoom }>(`/api/passport/chat/group/${groupId}`, { action: "add", friends: Array.from(pick) }); if (o) onDone(o.room); }}>Invite {pick.size || ""}</button>
      </div>
    </div>
  );
}
function FriendChecks({ friends, pick, setPick }: { friends: Friend[]; pick: Set<number>; setPick: (f: (p: Set<number>) => Set<number>) => void }) {
  return (
    <ul className="divide-y rounded-xl border" style={{ borderColor: C.line }}>
      {friends.map((f) => (
        <li key={f.id} style={{ borderColor: C.line }}>
          <label className="flex items-center gap-3 px-4 min-h-[52px] cursor-pointer font-body text-[1rem]" style={{ color: C.text }}>
            <input type="checkbox" className="w-[18px] h-[18px] accent-[#C9A96E]" checked={pick.has(f.id)} onChange={() => setPick((p) => { const n = new Set(p); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
            {f.name}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** A new group: a name and friends (2 to 20 people in all). Each friend gets an invitation they accept or decline. */
export function NewGroup() {
  const router = useRouter();
  const friends = useFriends();
  const [name, setName] = useState("");
  const [pick, setPick] = useState<Set<number>>(() => new Set());
  const { send, busy, error } = useSend();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const out = await send<{ room: ChatRoom }>("/api/passport/chat", { action: "create_group", name, friends: Array.from(pick) });
    if (out) { notifyChanged("inbox"); router.replace(`/passport/inbox/groups/${out.room.id}`, { scroll: false }); }
  };
  return (
    <form onSubmit={submit} className="pb-16 space-y-5" noValidate>
      <div>
        <BackLink fallback="/passport/inbox" label="Messages" />
        <p className="pp-t-eyebrow mt-2" style={{ color: C.brass }}>New group</p>
        <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>Start a group</h1>
        <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>A private chat with friends. Each friend you add gets an invitation; they join when they accept. Up to {GROUP_MAX} people.</p>
      </div>
      <label className="block"><span className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>Group name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={GROUP_NAME_MAX} className={inputCls} placeholder="Friday crew" /></label>
      <fieldset>
        <legend className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>Friends</legend>
        {friends === null ? <p className="pp-t-secondary" style={{ color: C.faint }}>One moment…</p> : !friends.length ? <p className="font-body" style={{ color: C.text }}>Add a friend first. <Link href="/passport/inbox?tab=friends" scroll={false} className="underline">Friends</Link></p> : <FriendChecks friends={friends} pick={pick} setPick={setPick} />}
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <button type="submit" disabled={busy || !name.trim() || !pick.size || pick.size + 1 > GROUP_MAX} className="w-full rounded-lg py-3.5 font-body text-[0.875rem] tracking-[0.22em] uppercase disabled:opacity-50 bg-[#C9A96E] text-[#13170F]">{busy ? "Starting…" : `Start the group${pick.size ? ` with ${pick.size}` : ""}`}</button>
      <p className="pp-t-secondary" style={{ color: C.faint }}>Private between the people in the group. If something is reported, our team can review it.</p>
    </form>
  );
}

// ── A channel ────────────────────────────────────────────────────────────────
export function ChannelView({ initial }: { initial: ChatRoom }) {
  const r = useRoom("channel", initial);
  const { send, busy, error } = useSend();
  const [reporting, setReporting] = useState<UiPost | null>(null);
  const [settings, setSettings] = useState(false);
  if (r.gone) return <Gone title={initial.name} />;
  const header = (
    <div>
      <BackLink fallback="/passport/inbox?tab=channels" label="Channels" />
      <div className="flex items-start gap-3 mt-2">
        {!!r.room.covers?.length && <span className="w-14 h-14 shrink-0 rounded-lg overflow-hidden"><Collage covers={r.room.covers.map((c) => ({ kind: c.kind, id: c.id, photo: c.photo, name: c.name || "", ...(c.photo_clear ? { clear: true } : {}) }))} section="inbox" label={r.room.name} /></span>}
        <div className="flex-1 min-w-0">
          <p className="pp-t-eyebrow" style={{ color: C.brass }}>Channel{r.room.locked ? " · read-only" : ""}{r.room.bar_only ? " · announcements" : ""}</p>
          <h1 className="font-display text-3xl leading-tight mt-1" style={{ color: C.text }}>{r.room.name}</h1>
        </div>
        <button type="button" onClick={() => setSettings(true)} aria-label="Channel settings and notifications" className="w-11 h-11 rounded-full flex items-center justify-center pp-focus shrink-0" style={{ color: C.muted }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>{r.room.muted ? <><path d="M6 8a6 6 0 0 1 10.5-4M18 13v-2a6 6 0 0 0-.2-1.6M4 17h12M3 3l18 18" /></> : <><path d="M6 17V11a6 6 0 0 1 12 0v6M4 17h16M10 20a2 2 0 0 0 4 0" /></>}</svg>
        </button>
      </div>
      {r.room.description && <p className="font-body text-[0.9375rem] mt-2" style={{ color: C.muted }}>{r.room.description}</p>}
      <p className="pp-t-secondary mt-1" style={{ color: C.faint }}>{typeof r.room.people === "number" ? `${r.room.people} ${r.room.people === 1 ? "person" : "people"}` : ""}{r.room.started_by ? ` · Started by ${r.room.started_by}` : ""}{r.room.slow_seconds ? ` · slow mode` : ""}</p>
      {!!r.room.pinned_posts?.length && (
        <div className="mt-3 rounded-xl border px-4 py-3" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
          <p className="pp-t-eyebrow" style={{ color: C.brass }}>Pinned</p>
          {r.room.pinned_posts.map((p) => <p key={p.id} className="font-body text-[0.9375rem] mt-1" style={{ color: C.text }}><span style={{ color: C.muted }}>{p.from_name}: </span>{p.body}</p>)}
        </div>
      )}
    </div>
  );
  return (
    <>
      <ChatScreen header={header} posts={r.posts.map((p) => uiPost(p, r.room.id))} line={r.room.line} canWrite={r.room.can_write} whyNot={r.room.why_not}
        placeholder={`Message ${r.room.name}`} showNames replies reactions hasMore={r.hasMore} onOlder={r.older} mentionSource={r.mention} busy={busy} error={error}
        onSend={async (text, x) => {
          const out = await send<{ room: ChatRoom }>(r.base, { action: "send", body: text, reply_to: x.replyTo, mentions: x.mentions });
          if (out) { r.setRoom(out.room); r.setPosts((p) => mergePosts(p, out.room.posts)); notifyChanged("inbox"); return true; }
          return false;
        }}
        onReact={async (id, emoji) => { const o = await postJson<{ reactions: ChatPost["reactions"] }>("/api/passport/chat", { action: "react", kind: "chat", post_id: id, emoji }); if (o.ok) r.setPosts((p) => p.map((x) => (x.id === id ? { ...x, reactions: o.data.reactions } : x))); }}
        onDelete={async (post) => { if (!confirm("Delete this message?")) return; const o = await postJson("/api/passport/chat", { action: "delete", post_id: post.id }); if (o.ok) void r.load(); }}
        onReport={(post) => setReporting(post)} onBlock={(post) => void blockWriter(post, () => void r.load())} />
      {reporting && <ReportMessage post={reporting} onClose={() => setReporting(null)} />}
      {settings && <ChannelSettings room={r.room} onClose={() => setSettings(false)} onChange={(n, m) => r.setRoom({ ...r.room, notify: n, muted: m })} />}
    </>
  );
}

function ChannelSettings({ room, onClose, onChange }: { room: ChatRoom; onClose: () => void; onChange: (n: ChannelNotify, muted: boolean) => void }) {
  const router = useRouter();
  const shell = useShell();
  const { send, busy, error } = useSend();
  const base = `/api/passport/chat/channel/${room.id}`;
  const set = async (b: { notify?: ChannelNotify; muted?: boolean }) => {
    const out = await send<{ notify: ChannelNotify; muted: boolean }>(base, { action: "notify", ...b });
    if (out) { onChange(out.notify, out.muted); notifyChanged("inbox"); }
  };
  return (
    <Sheet title={room.name} onClose={onClose}>
      <p className="font-body text-sm" style={{ color: C.muted }}>{room.line}</p>
      <fieldset className="mt-4">
        <legend className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>Notify me about</legend>
        <div className="space-y-1">
          {(["all", "mentions", "nothing"] as ChannelNotify[]).map((n) => (
            <label key={n} className="flex items-center gap-3 min-h-[44px] font-body" style={{ color: C.text }}>
              <input type="radio" name="pp-notify" className="w-[18px] h-[18px] accent-[#C9A96E]" checked={room.notify === n} disabled={busy} onChange={() => void set({ notify: n })} />
              {NOTIFY_WORDS[n]}{n === "mentions" ? " (default)" : ""}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-3 min-h-[44px] mt-2 font-body" style={{ color: C.text }}>
        <input type="checkbox" className="w-[18px] h-[18px] accent-[#C9A96E]" checked={!!room.muted} disabled={busy} onChange={(e) => void set({ muted: e.target.checked })} />
        Mute this channel <span className="pp-t-secondary" style={{ color: C.faint }}>(no notifications; it stays in your list)</span>
      </label>
      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      <button type="button" disabled={busy} className={`${smallBtn} w-full mt-6`} style={{ borderColor: C.line, color: C.muted }}
        onClick={async () => { if (await send(base, { action: "leave" })) { shell?.toast("You left the channel."); notifyChanged("inbox"); router.push("/passport/inbox?tab=channels", { scroll: false }); } }}>Leave the channel</button>
    </Sheet>
  );
}

/** A thread in a channel: the message, its replies (one level) and its own composer. */
export function ThreadView({ initial }: { initial: ChatRoom }) {
  const [room, setRoom] = useState(initial);
  const [gone, setGone] = useState(false);
  const [reporting, setReporting] = useState<UiPost | null>(null);
  const { send, busy, error } = useSend();
  const channelId = initial.channel_id!;
  const url = `/api/passport/chat/channel/${channelId}?thread=${initial.id}`;
  const load = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    if (res.status === 404) { setGone(true); return; }
    const d = await res.json().catch(() => null);
    if (d?.room) setRoom(d.room);
  }, [url]);
  useRoomPoll(load, undefined, !gone);
  useEffect(() => { notifyChanged("inbox"); }, []);
  const mention = useCallback(async (q: string) => (await fetch(`/api/passport/chat/channel/${channelId}?mention=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null))?.options || [], [channelId]);
  if (gone) return <Gone title="Thread" />;
  const parent = room.parent ? uiPost(room.parent) : null;
  const header = (
    <div>
      <BackLink to={{ href: `/passport/inbox/channels/${channelId}`, label: room.name }} />
      <p className="pp-t-eyebrow mt-2" style={{ color: C.brass }}>Thread in {room.name}{room.locked ? " · closed" : ""}</p>
      {parent && (
        <div className="mt-3 rounded-2xl border px-4 py-3" style={{ borderColor: C.line, background: C.card }}>
          <p className="pp-t-secondary" style={{ color: C.muted }}>{parent.hidden ? "A hidden message" : parent.author}</p>
          <p className="font-body text-[1rem] mt-1 whitespace-pre-wrap" style={{ color: parent.gone ? C.faint : C.text }}>{parent.gone || parent.body}</p>
          {parent.share && <div className="mt-2">{parent.share}</div>}
        </div>
      )}
      <p className="pp-t-secondary mt-3" style={{ color: C.faint }}>{room.posts.length} {room.posts.length === 1 ? "reply" : "replies"}</p>
    </div>
  );
  return (
    <>
      <ChatScreen header={header} posts={room.posts.map((p) => uiPost(p))} line={room.line} canWrite={room.can_write} whyNot={room.why_not}
        placeholder="Reply in this thread" showNames reactions mentionSource={mention} busy={busy} error={error} emptyText="No replies yet."
        onSend={async (text, x) => {
          const out = await send<{ room: ChatRoom }>(`/api/passport/chat/channel/${channelId}`, { action: "send", body: text, parent_id: room.id, mentions: x.mentions });
          if (out) { setRoom(out.room); notifyChanged("inbox"); return true; }
          return false;
        }}
        onReact={async (id, emoji) => { const o = await postJson<{ reactions: ChatPost["reactions"] }>("/api/passport/chat", { action: "react", kind: "chat", post_id: id, emoji }); if (o.ok) setRoom((r) => ({ ...r, posts: r.posts.map((x) => (x.id === id ? { ...x, reactions: o.data.reactions } : x)) })); }}
        onDelete={async (post) => { if (!confirm("Delete this reply?")) return; const o = await postJson("/api/passport/chat", { action: "delete", post_id: post.id }); if (o.ok) void load(); }}
        onReport={(post) => setReporting(post)} onBlock={(post) => void blockWriter(post, () => void load())} />
      {reporting && <ReportMessage post={reporting} onClose={() => setReporting(null)} />}
    </>
  );
}

/** Propose (With approval) or start (On) a channel. Only shown when Passport settings allow it. */
export function ProposeChannel({ mode }: { mode: "approval" | "on" }) {
  const router = useRouter();
  const shell = useShell();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { send, busy, error } = useSend();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const out = await send<{ proposed: boolean; room: ChatRoom | null }>("/api/passport/chat", { action: "propose", name, description });
    if (!out) return;
    notifyChanged("inbox");
    if (out.room) router.replace(`/passport/inbox/channels/${out.room.id}`, { scroll: false });
    else { shell?.toast("Sent to the bar. You'll hear back here."); router.push("/passport/inbox?tab=channels", { scroll: false }); }
  };
  return (
    <form onSubmit={submit} className="pb-16 space-y-5" noValidate>
      <div>
        <BackLink fallback="/passport/inbox?tab=channels" label="Channels" />
        <p className="pp-t-eyebrow mt-2" style={{ color: C.brass }}>{mode === "on" ? "New channel" : "Suggest a channel"}</p>
        <h1 className="font-display text-4xl mt-1" style={{ color: C.text }}>{mode === "on" ? "Start a channel" : "Suggest a channel"}</h1>
        <p className="font-body text-sm mt-2 leading-relaxed" style={{ color: C.muted }}>A channel is a room on one topic that members can join. {mode === "on" ? "It opens at once, marked as started by you." : "The bar reads every idea and tells you here whether it opens."} Up to two a week.</p>
      </div>
      <label className="block"><span className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={CHANNEL_NAME_MAX} className={inputCls} placeholder="Home bartending" /></label>
      <label className="block"><span className="block pp-t-eyebrow mb-1.5" style={{ color: C.muted }}>What is it for? (one line)</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={CHANNEL_DESC_MAX} className={inputCls} placeholder="Tips and tools for making drinks at home" /></label>
      {error && <Notice>{error}</Notice>}
      <button type="submit" disabled={busy || !name.trim() || !description.trim()} className="w-full rounded-lg py-3.5 font-body text-[0.875rem] tracking-[0.22em] uppercase disabled:opacity-50 bg-[#C9A96E] text-[#13170F]">{busy ? "Sending…" : mode === "on" ? "Start the channel" : "Send to the bar"}</button>
      <p className="pp-t-secondary" style={{ color: C.faint }}>Channels are not private: everyone in a channel and the Common Good team can read it.</p>
    </form>
  );
}
