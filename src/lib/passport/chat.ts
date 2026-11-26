/**
 * File 16: Messages (the Inbox becomes a chat app). Plain helpers shared by the website's routes, screens and tests (no
 * server-only code). The Bible decides who may see what; these only stop bad input before it leaves the website, word
 * things for members, and work out the top tabs' badges, the day separators and the quick switcher.
 *
 * What one member sees of another is a display name. Numbers here name a conversation, a group, a channel, a message in
 * a room the member is in, or a seat (a room-mate's place in that one room): never another member.
 */
import type { CoverPhoto } from "./types";

// ── What the Bible sends (its approved list) ─────────────────────────────────
export type ChatKind = "bar" | "friend" | "group";
export interface ChatRow {
  kind: ChatKind; id: number; name: string; subtitle?: string; unread: number; mentions: number; last_at: string | null; preview: string;
  status_label?: string; pinned?: boolean; people?: number;
}
export interface GroupInvite { id: number; name: string; from_name: string | null; people: number; at: string }
export interface ChannelCard {
  id: number; name: string; description: string; covers: CoverPhoto[]; people: number; joined: boolean; started_by: string | null; locked: boolean; bar_only: boolean; pinned: boolean;
  unread?: number; mentions?: number; muted?: boolean; notify?: ChannelNotify; last_at?: string | null; preview?: string;
}
export type ChannelNotify = "all" | "mentions" | "nothing";
export interface ChannelProposal { id: number; name: string; description: string; status: "proposed" | "declined"; status_label: string; decline_reason: string }
export type CanStart = "off" | "approval" | "on";
export interface ChatOverview {
  chats: ChatRow[]; invitations: GroupInvite[]; channels: ChannelCard[]; browse: ChannelCard[]; proposals: ChannelProposal[]; can_start: CanStart;
  unread: { chats: number; channels: number; mentions: number }; limits: { body_max: number; group_max: number; reactions: string[] };
}
export interface ChatQuote { id: number; name: string; text: string }
export interface ChatReaction { emoji: string; count: number; mine: boolean; names: string[] }
export interface ChatShare { kind: "cocktail" | "bottle" | "house_list" | "event"; name: string; ref_id: number | null; opens: boolean; public_event_id?: string }
export interface ChatPost {
  id: number; hidden?: boolean; mine?: boolean; from_bar?: boolean; from_name?: string; body?: string; removed?: "bar" | "author" | null; at: string;
  reply_to?: ChatQuote | null; reactions?: ChatReaction[]; share?: ChatShare | null; pinned?: boolean; mentions_me?: boolean; can_report?: boolean; can_delete?: boolean;
  person?: string; replies?: number; last_reply_at?: string | null; thread_locked?: boolean;
}
export interface ChatPerson { seat: string; name: string; me: boolean; organiser: boolean; invited: boolean }
export interface ChatRoom {
  kind: "group" | "channel" | "thread"; id: number; name: string; channel_id?: number; organiser?: boolean; people?: ChatPerson[] | number; line: string;
  description?: string; covers?: CoverPhoto[]; locked?: boolean; bar_only?: boolean; slow_seconds?: number; notify?: ChannelNotify; muted?: boolean; started_by?: string | null;
  pinned_posts?: ChatPost[]; parent?: ChatPost; posts: ChatPost[]; has_more?: boolean; can_write: boolean; why_not: string;
}
export interface MentionOption { seat: string; name: string }

// ── Limits and words ─────────────────────────────────────────────────────────
export const BODY_MAX = 1000;
export const GROUP_NAME_MAX = 40;
export const GROUP_MAX = 20;
export const CHANNEL_NAME_MAX = 40;
export const CHANNEL_DESC_MAX = 140;
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🥃"] as const;
/** The open conversation asks for news every 5 seconds while it is on screen; the lists every 30. */
export const ROOM_POLL_MS = 5_000;
export const LIST_POLL_MS = 30_000;
export const GROUP_LINE = "Private between the people in this group. If something is reported, our team can review it.";
export const CHANNEL_LINE = "Everyone in this channel and the Common Good team can read this.";
export const NOTIFY_WORDS: Record<ChannelNotify, string> = { all: "All messages", mentions: "Mentions and replies", nothing: "Nothing" };

// ── The top tabs ─────────────────────────────────────────────────────────────
export type MessagesTabId = "chats" | "channels" | "requests" | "bottles" | "friends";
export const MESSAGES_TABS: { id: MessagesTabId; label: string }[] = [
  { id: "chats", label: "Chats" }, { id: "channels", label: "Channels" }, { id: "requests", label: "Requests" }, { id: "bottles", label: "Bottles" }, { id: "friends", label: "Friends" },
];
export const isMessagesTab = (v: unknown): v is MessagesTabId => typeof v === "string" && MESSAGES_TABS.some((t) => t.id === v);
/** The tab to show: the one asked for in the address, else the one used last while the app is open, else Chats. */
export function chosenMessagesTab(asked: string | null | undefined, remembered: string | null | undefined): MessagesTabId {
  if (isMessagesTab(asked)) return asked;
  if (isMessagesTab(remembered)) return remembered;
  return "chats";
}

export interface BadgeInput {
  chat?: Pick<ChatOverview, "unread" | "invitations" | "chats" | "channels"> | null;
  requests?: { unread?: boolean; question?: boolean; status?: string }[];
  inquiries?: { unread?: boolean }[];
  bottles?: { can_answer: boolean; status: string }[];
  friendRequests?: number;
}
/** Each top tab's count of what is waiting (0: no badge). */
export function messagesBadges(x: BadgeInput): Record<MessagesTabId, number> {
  const chats = x.chat ? x.chat.chats.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0) + x.chat.invitations.length : 0;
  const channels = x.chat ? x.chat.channels.filter((c) => !c.muted && ((c.unread || 0) > 0 || (c.mentions || 0) > 0)).length : 0;
  const requests = (x.requests || []).filter((r) => r.unread || r.question).length + (x.inquiries || []).filter((q) => q.unread).length;
  const bottles = (x.bottles || []).filter((b) => b.can_answer || b.status === "ready").length;
  return { chats, channels, requests, bottles, friends: x.friendRequests || 0 };
}
/** The bottom tab's dot: any top tab has something. */
export const messagesLit = (b: Record<MessagesTabId, number>) => Object.values(b).some((n) => n > 0);
/** "9+" for a badge over nine. */
export const badgeText = (n: number) => (n > 9 ? "9+" : String(n));

// ── Where a conversation opens ───────────────────────────────────────────────
export const chatHref = (c: Pick<ChatRow, "kind" | "id">) => (c.kind === "bar" ? `/passport/inbox/messages/${c.id}` : c.kind === "friend" ? `/passport/inbox/friends/${c.id}` : `/passport/inbox/groups/${c.id}`);
export const channelHref = (id: number) => `/passport/inbox/channels/${id}`;
export const threadHref = (channelId: number, postId: number) => `/passport/inbox/channels/${channelId}/threads/${postId}`;

// ── The quick switcher ───────────────────────────────────────────────────────
export interface SwitchItem { key: string; kind: ChatKind | "channel"; name: string; sub: string; unread: number; mentions: number; href: string; at: string | null }
/** Every chat and joined channel, with unread counts, filtered by what the member typed (any word of the name). */
export function switcherItems(o: Pick<ChatOverview, "chats" | "channels"> | null | undefined, filter = ""): SwitchItem[] {
  if (!o) return [];
  const words = filter.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
  const all: SwitchItem[] = [
    ...o.chats.map((c) => ({ key: `${c.kind}:${c.id}`, kind: c.kind, name: c.name, sub: c.kind === "bar" ? c.subtitle || "Message to the bar" : c.kind === "group" ? `Group · ${c.people || 0} people` : "Friend", unread: c.unread, mentions: c.mentions, href: chatHref(c), at: c.last_at })),
    ...o.channels.map((c) => ({ key: `channel:${c.id}`, kind: "channel" as const, name: c.name, sub: "Channel", unread: c.muted ? 0 : c.unread || 0, mentions: c.mentions || 0, href: channelHref(c.id), at: c.last_at || null })),
  ];
  const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const hit = (i: SwitchItem) => !words.length || words.every((w) => plain(`${i.name} ${i.sub}`).includes(w));
  return all.filter(hit).sort((a, b) => Number(b.unread > 0 || b.mentions > 0) - Number(a.unread > 0 || a.mentions > 0) || (b.at || "").localeCompare(a.at || ""));
}

// ── A conversation, as a text-messaging app shows it ─────────────────────────
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
/** "Today", "Yesterday", a weekday within the week, else "Mon, Nov 3" (bar time). */
export function dayLabel(iso: string, now = new Date()): string {
  const d = dayKey(iso);
  const t = dayKey(now.toISOString());
  const y = dayKey(new Date(now.getTime() - 86400000).toISOString());
  if (d === t) return "Today";
  if (d === y) return "Yesterday";
  const diff = (Date.parse(`${t}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 86400000;
  const dt = new Date(`${d}T12:00:00Z`);
  if (diff > 0 && diff < 7) return dt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(dt.getUTCFullYear() !== now.getUTCFullYear() ? { year: "numeric" } : {}), timeZone: "UTC" });
}
/** The time on a message, shown when tapped: "7:42 PM". */
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
export type Line<P> = { kind: "day"; key: string; label: string } | { kind: "hidden"; key: string; count: number } | { kind: "post"; key: string; post: P };
/**
 * Messages in order with a day separator before each new day, and runs of hidden messages (someone blocked either way)
 * collapsed into one "N hidden messages" line.
 */
export function chatLines<P extends { id: number; at: string; hidden?: boolean }>(posts: P[], now = new Date()): Line<P>[] {
  const out: Line<P>[] = [];
  let day = "";
  for (const p of posts) {
    const d = dayKey(p.at);
    if (d !== day) { day = d; out.push({ kind: "day", key: `d${d}`, label: dayLabel(p.at, now) }); }
    if (p.hidden) {
      const last = out[out.length - 1];
      if (last && last.kind === "hidden") last.count++;
      else out.push({ kind: "hidden", key: `h${p.id}`, count: 1 });
      continue;
    }
    out.push({ kind: "post", key: `p${p.id}`, post: p });
  }
  return out;
}
export const hiddenWords = (n: number) => (n === 1 ? "1 hidden message" : `${n} hidden messages`);
/** Older messages arrive in front; newer ones (a poll) replace the tail. Never two of the same message. */
export function mergePosts<P extends { id: number }>(have: P[], incoming: P[], { older = false } = {}): P[] {
  const by = new Map<number, P>();
  for (const p of older ? [...incoming, ...have] : have) by.set(p.id, p);
  if (!older) for (const p of incoming) by.set(p.id, p);
  return Array.from(by.values()).sort((a, b) => a.id - b.id);
}

// ── Where the composer sits ──────────────────────────────────────────────────
/** An inset of the visual viewport larger than this is the on-screen keyboard (not a browser bar settling). */
export const KEYBOARD_MIN = 80;
export const keyboardOpen = (inset: number) => inset > KEYBOARD_MIN;
/**
 * The composer's distance from the bottom of the screen: directly on top of the keyboard when it is open (the tab bar
 * is hidden then), otherwise above the bottom tab bar and the phone's safe area. --pp-tabbar is the tab bar's own height
 * (globals.css; 0 on a wide screen, where the tabs are at the top).
 */
export function composerBottom(inset: number): string {
  return keyboardOpen(inset) ? `${Math.round(inset)}px` : "calc(var(--pp-tabbar) + env(safe-area-inset-bottom))";
}

// ── Mentions ─────────────────────────────────────────────────────────────────
/** The word being typed after an "@" at the caret, or null when the caret is not in one. */
export function mentionQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const m = before.match(/(?:^|\s)@([A-Za-zÀ-ÖØ-öø-ÿ.'-]{0,30})$/);
  return m ? m[1] : null;
}
/** Put "@Name " in place of the "@que" being typed. Returns the new text and where the caret goes. */
export function insertMention(text: string, caret: number, name: string): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return { text, caret };
  const next = `${text.slice(0, at)}@${name} ${text.slice(caret)}`;
  return { text: next, caret: at + name.length + 2 };
}
/** Only the people still named in the text are sent (a mention typed and then deleted is not). */
export const mentionsLeft = (text: string, picked: MentionOption[]) => Array.from(new Set(picked.filter((m) => text.includes(`@${m.name}`)).map((m) => m.seat)));

// ── Input checks before anything reaches the Bible (which checks again) ─────
const str = (v: unknown) => (typeof v === "string" ? v : "");
export const posInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
};
type Built<T> = { body: T } | { error: string };
export const isSeat = (v: unknown): v is string => typeof v === "string" && /^[gc]\d{1,9}$/.test(v);
export const isRoom = (v: unknown): v is "group" | "channel" => v === "group" || v === "channel";
export const isReaction = (v: unknown): boolean => typeof v === "string" && (REACTIONS as readonly string[]).includes(v);
/** A message: { body, reply_to?, parent_id?, mentions?, share? }. Only these fields leave the website. */
export function chatPostBody(b: Record<string, unknown>): Built<{ body: string; reply_to?: number; parent_id?: number; mentions: string[]; share?: { kind: string; id?: number; public?: unknown } }> {
  const body = str(b.body).trim();
  const share = b.share && typeof b.share === "object" ? (b.share as Record<string, unknown>) : null;
  if (!body && !share) return { error: "Write your message first" };
  if (body.length > BODY_MAX) return { error: `Keep your message to ${BODY_MAX.toLocaleString("en-US")} characters` };
  const mentions = (Array.isArray(b.mentions) ? b.mentions : []).filter(isSeat).slice(0, 20);
  const out: { body: string; reply_to?: number; parent_id?: number; mentions: string[]; share?: { kind: string; id?: number; public?: unknown } } = { body, mentions };
  const r = posInt(b.reply_to); if (r) out.reply_to = r;
  const p = posInt(b.parent_id); if (p) out.parent_id = p;
  if (share) {
    const kind = str(share.kind);
    if (!["cocktail", "bottle", "house_list", "event", "public_event"].includes(kind)) return { error: "That can't be shared here" };
    out.share = kind === "public_event" ? { kind, public: share.public } : { kind, id: posInt(share.id) || undefined };
  }
  return { body: out };
}
/** A new group: a name and the friends to invite (friendship numbers). */
export function groupBody(b: Record<string, unknown>): Built<{ name: string; friends: number[] }> {
  const name = str(b.name).replace(/\s+/g, " ").trim();
  if (!name) return { error: "Give the group a name" };
  if (name.length > GROUP_NAME_MAX) return { error: `Keep the name to ${GROUP_NAME_MAX} characters` };
  const friends = Array.from(new Set((Array.isArray(b.friends) ? b.friends : []).map(posInt).filter((n): n is number => !!n)));
  if (!friends.length) return { error: "Add at least one friend" };
  if (friends.length + 1 > GROUP_MAX) return { error: `A group holds up to ${GROUP_MAX} people` };
  return { body: { name, friends } };
}
/** A channel idea: a name and a one-line description. */
export function proposalBody(b: Record<string, unknown>): Built<{ name: string; description: string }> {
  const name = str(b.name).replace(/\s+/g, " ").trim();
  const description = str(b.description).replace(/\s+/g, " ").trim();
  if (!name) return { error: "Name the channel" };
  if (name.length > CHANNEL_NAME_MAX) return { error: `Keep the name to ${CHANNEL_NAME_MAX} characters` };
  if (!description) return { error: "Say in a line what it is for" };
  if (description.length > CHANNEL_DESC_MAX) return { error: `Keep the description to ${CHANNEL_DESC_MAX} characters` };
  return { body: { name, description } };
}
