import "server-only";
import { setDefaultResultOrder } from "node:dns";
import {
  markKey, type MemberAuth, type Me, type Config, type CocktailCard, type Cocktail, type ArchivedBottle, type MenuGroup, type ToastMenu, type MenuInfo, type Bottle, type Producer, type BaseSpirit, type ItemKind, type FavoriteItem, type RatingItem, type NoteItem, type Mark, type Marks, type Mine, type PassportList, type Bespoke, type History, type BottleRequests,
  type IndexData, type ForYou, type FindResults, type Reservation, type BarHome, type BarLists, type HouseList, type Chart,
  type InboxData, type InboxThread, type MemberRequest, type EventInquiry, type NotifyPrefs,
  type FriendsOverview, type SocialHome, type SocialInbox, type Conversation, type ShareCard, type PassportEvent,
  type BarMessage, type Bracket, type CommentThread, type CommentType, type FlightVote, type VoteCard, type VotesData,
  type ItemKind as PhotoKind, type PhotosData,
} from "./types";

// The shapes themselves live in ./types (no server-only code, so browser components can use them too).
export * from "./types";

/**
 * The website's side of the Passport entrance in the Bible
 * (/api/passport-public). Server to server only: the guest's browser never
 * talks to the Bible. Authenticated with PASSPORT_SYNC_KEY, its own key,
 * separate from the reservations key. The website stores no member data; every
 * screen asks the Bible.
 */

try { setDefaultResultOrder("ipv4first"); } catch { /* older runtimes */ }

const TIMEOUT_MS = 8_000;

export const UNAVAILABLE = "Passport is temporarily unavailable. Please try again in a few minutes.";

export class PassportError extends Error {
  status: number;
  /** True when the Bible says this sign-in is no longer valid (signed out, deactivated, reset). */
  signedOut: boolean;
  constructor(status: number, message: string, signedOut = false) {
    super(message);
    this.name = "PassportError";
    this.status = status;
    this.signedOut = signedOut;
  }
}


function baseUrl(): string {
  return (process.env.BIBLE_API_URL || "https://cgbible.com").replace(/\/+$/, "");
}

export async function passport<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  opts: { body?: Record<string, unknown>; auth?: MemberAuth } = {},
): Promise<T> {
  const key = process.env.PASSPORT_SYNC_KEY;
  if (!key) throw new PassportError(503, UNAVAILABLE);
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/passport-public${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.auth ? { "X-Passport-Session": opts.auth.token, "X-Passport-Member": String(opts.auth.memberId) } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[passport] Bible ${method} ${path} failed: ${(e as Error).name}`);
    throw new PassportError(503, UNAVAILABLE);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const error = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "";
    if (res.status === 401 && error === "signed_out") throw new PassportError(401, "Please sign in again.", true);
    if (res.status === 401 || res.status >= 500) {
      // A wrong or missing key on one side is ours to fix, not the guest's.
      console.error(`[passport] Bible ${method} ${path} → ${res.status}`);
      throw new PassportError(503, UNAVAILABLE);
    }
    throw new PassportError(res.status, error || "Something went wrong. Please try again.");
  }
  return data as T;
}

// ── What the Bible sends (its approved list, server/passport/guestSafe.js) ────


export const getConfig = () => passport<{ config: Config }>("GET", "/config").then((r) => r.config);
export const getMe = (auth: MemberAuth) => passport<Me>("GET", "/me", { auth });

// ── File 03a: the library, Passport cocktails, the spirits archive, Toast menus ──
// Exactly the fields the Bible's approved list sends (server/passport/guestSafe.js).

export const getLibrary = (auth: MemberAuth, q = "", spirit = "") => {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q.slice(0, 100));
  if (spirit) qs.set("spirit", spirit.slice(0, 40));
  const s = qs.toString();
  return passport<{ cocktails: CocktailCard[] }>("GET", `/library${s ? `?${s}` : ""}`, { auth }).then((r) => r.cocktails);
};
export const getCocktail = (auth: MemberAuth, id: number) => passport<{ cocktail: Cocktail }>("GET", `/library/${id}`, { auth }).then((r) => r.cocktail);
export const getPassportCocktails = (auth: MemberAuth) => passport<{ passport_cocktails: Cocktail[] }>("GET", "/passport-cocktails", { auth }).then((r) => r.passport_cocktails);
export const getArchive = (auth: MemberAuth) => passport<{ archive: ArchivedBottle[] }>("GET", "/spirits/archive", { auth }).then((r) => r.archive);
export const getArchivedBottle = (auth: MemberAuth, id: number) => passport<{ bottle: ArchivedBottle }>("GET", `/spirits/archive/${id}`, { auth }).then((r) => r.bottle);
export const getMenus = (auth: MemberAuth) => passport<{ menu_info: MenuInfo; menus: ToastMenu[]; passport_group: MenuGroup | null }>("GET", "/menus", { auth });
export const getSpirits = (auth: MemberAuth) => passport<{ menu_info: MenuInfo; spirits: ToastMenu | null }>("GET", "/spirits", { auth });
// ── File 03b: bottle and producer pages, the base-spirit filter, at-home recipes ──
/** A bottle page: on the spirits list, in the archive, or linked from a cocktail shown in Passport. */
export const getBottle = (auth: MemberAuth, id: number) => passport<{ bottle: Bottle }>("GET", `/spirits/bottle/${id}`, { auth }).then((r) => r.bottle);
export const getProducer = (auth: MemberAuth, id: number) => passport<{ producer: Producer }>("GET", `/producers/${id}`, { auth }).then((r) => r.producer);
export const getBaseSpirits = (auth: MemberAuth) => passport<{ base_spirits: BaseSpirit[] }>("GET", "/library/spirits", { auth }).then((r) => r.base_spirits);
/** The at-home recipe PDF, straight from the Bible for a signed-in member (never a public address). */
export async function getHomeRecipe(auth: MemberAuth, cocktailId: number): Promise<Response | null> {
  const key = process.env.PASSPORT_SYNC_KEY;
  if (!key) return null;
  try {
    return await fetch(`${baseUrl()}/api/passport-public/library/${cocktailId}/home-recipe`, {
      headers: { Authorization: `Bearer ${key}`, "X-Passport-Session": auth.token, "X-Passport-Member": String(auth.memberId) },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}


// ── File 04: the personal layer. Only the signed-in member's own records (the Bible scopes every one by
// the member behind the session; a number here only ever names one of their own records). ──────────────

export const getMarks = (auth: MemberAuth) =>
  passport<{ marks: Mark[] }>("GET", "/personal/marks", { auth }).then((r) => Object.fromEntries(r.marks.map((m) => [markKey(m.kind, m.id), m])) as Marks);
/** Never breaks a page: no hearts and stars is fine. */
export const getMarksSafe = (auth: MemberAuth) => getMarks(auth).catch(() => ({}) as Marks);
export const getMine = (auth: MemberAuth, kind: ItemKind, id: number) => passport<{ mine: Mine }>("GET", `/personal/item/${kind}/${id}`, { auth }).then((r) => r.mine);
export const getFavorites = (auth: MemberAuth) => passport<{ favorites: FavoriteItem[]; ratings: RatingItem[] }>("GET", "/personal/favorites", { auth });
export const getNotes = (auth: MemberAuth) => passport<{ notes: NoteItem[] }>("GET", "/personal/notes", { auth }).then((r) => r.notes);
export const getLists = (auth: MemberAuth) => passport<{ lists: PassportList[] }>("GET", "/lists", { auth }).then((r) => r.lists);
export const getList = (auth: MemberAuth, id: number) => passport<{ list: PassportList }>("GET", `/lists/${id}`, { auth }).then((r) => r.list);
export const getRecipes = (auth: MemberAuth) => passport<{ recipes: Bespoke[]; units: string[] }>("GET", "/bespoke", { auth });
export const getHistory = (auth: MemberAuth) => passport<{ history: History }>("GET", "/history", { auth }).then((r) => r.history);

// ── File 05: bottle requests. Only the signed-in member's own requests (the Bible looks each one up by its number
// AND the member behind the session). Prices are whole cents, never including tax. Never a cost or markup. ──────
export const getBottleRequests = (auth: MemberAuth) => passport<BottleRequests>("GET", "/bottles/requests", { auth });

// ── File 06: the new shell. One call per screen, never one per item. ──────────────────────────────────────────────
/** The Index tab in one answer: every cocktail shown in Passport, every bottle a member may open, beer and wine, the filter. */
export const getIndex = (auth: MemberAuth) => passport<IndexData>("GET", "/index", { auth });
// File 12: "For you" (Home asks for four; the Index's answer already carries up to twelve).
export const getForYou = (auth: MemberAuth, limit = 4) => passport<ForYou>("GET", `/recommendations?limit=${Math.max(1, Math.min(12, Math.floor(limit)))}`, { auth });
/** One search for cocktails, bottles and producers, only things a member may open. */
export const findAll = (auth: MemberAuth, q: string) => passport<FindResults>("GET", `/find?${new URLSearchParams({ q: q.slice(0, 100) }).toString()}`, { auth });
/** The member's own upcoming reservations (Guest Book link by confirmed email). */
export const getReservations = (auth: MemberAuth) => passport<{ reservations: Reservation[] }>("GET", "/reservations", { auth }).then((r) => r.reservations);

// ── File 07: From the bar. Only what the signed-in member may see (the Bible decides audience and status). ──────────
/** Home's From the bar, What's new, Spirit of the Day, Welcome Aperitif and the newest house list, in one call. */
export const getBarHome = (auth: MemberAuth) => passport<BarHome>("GET", "/bar/home", { auth });
/** The Index's "From Common Good": live house lists, the charts showing now, and how many past lists there are. */
export const getBarLists = (auth: MemberAuth) => passport<BarLists>("GET", "/bar/lists", { auth });
export const getPastLists = (auth: MemberAuth) => passport<{ past_lists: HouseList[] }>("GET", "/bar/lists/past", { auth }).then((r) => r.past_lists);
export const getHouseList = (auth: MemberAuth, id: number) => passport<{ house_list: HouseList }>("GET", `/bar/lists/${id}`, { auth }).then((r) => r.house_list);
export const getChart = (auth: MemberAuth, key: string) => passport<{ chart: Chart }>("GET", `/bar/charts/${encodeURIComponent(key)}`, { auth }).then((r) => r.chart);

// ── File 08: the Inbox. Only the signed-in member's own threads, requests and inquiries (the Bible looks each one up by
// its number AND the member behind the session). Staff appear by first name only; nothing staff-only is ever sent. ──
export const getInbox = (auth: MemberAuth) => passport<InboxData>("GET", "/inbox", { auth });
export const getThread = (auth: MemberAuth, id: number) => passport<{ thread: InboxThread }>("GET", `/inbox/threads/${id}`, { auth }).then((r) => r.thread);
export const getMemberRequest = (auth: MemberAuth, id: number) => passport<{ member_request: MemberRequest }>("GET", `/inbox/requests/${id}`, { auth }).then((r) => r.member_request);
export const getInquiry = (auth: MemberAuth, id: number) => passport<{ inquiry: EventInquiry }>("GET", `/inbox/events/${id}`, { auth }).then((r) => r.inquiry);
export const getNotifyPrefs = (auth: MemberAuth) => passport<{ notify_prefs: NotifyPrefs }>("GET", "/notifications", { auth }).then((r) => r.notify_prefs);

// ── File 09: friends, messages, sharing, Let's go, I'm here and Passport events. Only the signed-in member's own (the
// Bible names other members by display name only, and every number names something the member is part of). ──────
export const getFriends = (auth: MemberAuth) => passport<FriendsOverview>("GET", "/friends", { auth });
export const getSocialHome = (auth: MemberAuth) => passport<SocialHome>("GET", "/social/home", { auth });
export const getSocialInbox = (auth: MemberAuth) => passport<SocialInbox>("GET", "/social/inbox", { auth });
export const getConversation = (auth: MemberAuth, id: number) => passport<{ conversation: Conversation }>("GET", `/conversations/${id}`, { auth }).then((r) => r.conversation);
export const getShare = (auth: MemberAuth, id: number) => passport<{ share: ShareCard }>("GET", `/shares/${id}`, { auth }).then((r) => r.share);
export const getPassportEvents = (auth: MemberAuth) => passport<{ events: PassportEvent[] }>("GET", "/events", { auth }).then((r) => r.events);
export const getPassportEvent = (auth: MemberAuth, id: number) => passport<{ event: PassportEvent }>("GET", `/events/${id}`, { auth }).then((r) => r.event);

// ── File 10: comments, flight votes and brackets. Only what the signed-in member may see; their own picks only. ──────
/** Open votes and brackets (Home, the Index), results in their window, and how many are under Past votes. */
export const getVotes = (auth: MemberAuth) => passport<VotesData>("GET", "/votes", { auth });
export const getPastVotes = (auth: MemberAuth) => passport<{ past_votes: VoteCard[] }>("GET", "/votes/past", { auth }).then((r) => r.past_votes);
export const getFlightVote = (auth: MemberAuth, id: number) => passport<{ flight: FlightVote }>("GET", `/votes/flights/${id}`, { auth }).then((r) => r.flight);
export const getBracket = (auth: MemberAuth, id: number) => passport<{ bracket: Bracket }>("GET", `/brackets/${id}`, { auth }).then((r) => r.bracket);
/** One message from the bar on its own page (for its comments). */
export const getBarMessage = (auth: MemberAuth, id: number) => passport<{ bar_message: BarMessage }>("GET", `/bar/messages/${id}`, { auth }).then((r) => r.bar_message);
/** The comments place on one curated item, or null when comments are off there. */
export const getComments = (auth: MemberAuth, type: CommentType, id: number) => passport<{ comments: CommentThread | null }>("GET", `/comments/${type}/${id}`, { auth }).then((r) => r.comments);

// ── File 11: photos. A member's own photos (only theirs: the Bible looks each up by its code AND the member behind the
// session) and the bar's photos (only for items this member may open). Pictures come back as bytes, never JSON. ──────
export const getItemPhotos = (auth: MemberAuth, kind: PhotoKind, id: number) => passport<PhotosData>("GET", `/photos/item/${kind}/${id}`, { auth });
export const getMyPhotos = (auth: MemberAuth) => passport<PhotosData>("GET", "/photos/mine", { auth });
export const deleteMyPhoto = (auth: MemberAuth, token: string) => passport<{ ok: true }>("DELETE", `/photos/mine/${encodeURIComponent(token)}`, { auth });

/** One picture through the Passport connection (a bar photo or the member's own). Null when the Bible can't be reached. */
export async function getPhotoBytes(auth: MemberAuth, path: string): Promise<Response | null> {
  const key = process.env.PASSPORT_SYNC_KEY;
  if (!key) return null;
  try {
    return await fetch(`${baseUrl()}/api/passport-public${path}`, {
      headers: { Authorization: `Bearer ${key}`, "X-Passport-Session": auth.token, "X-Passport-Member": String(auth.memberId) },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

/** Send one photo (already shrunk on the member's phone) to the Bible, which checks it and saves it fresh. */
export async function uploadPhoto(auth: MemberAuth, kind: PhotoKind, id: number, bytes: ArrayBuffer, caption: string): Promise<PhotosData> {
  const key = process.env.PASSPORT_SYNC_KEY;
  if (!key) throw new PassportError(503, UNAVAILABLE);
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/passport-public/photos/item/${kind}/${id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/octet-stream",
        "X-Passport-Session": auth.token, "X-Passport-Member": String(auth.memberId),
        ...(caption ? { "X-Photo-Caption": encodeURIComponent(caption) } : {}),
      },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error(`[passport] Bible photo upload failed: ${(e as Error).name}`);
    throw new PassportError(503, UNAVAILABLE);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const error = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "";
    if (res.status === 401 && error === "signed_out") throw new PassportError(401, "Please sign in again.", true);
    if (res.status === 401 || res.status >= 500) throw new PassportError(503, UNAVAILABLE);
    throw new PassportError(res.status, error || "That photo could not be added. Please try again.");
  }
  return data as PhotosData;
}
