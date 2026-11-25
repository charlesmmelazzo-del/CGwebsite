import "server-only";
import { setDefaultResultOrder } from "node:dns";

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

/** Who is asking: the Bible checks the session token and that it belongs to this member. */
export type MemberAuth = { token: string; memberId: number };

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

export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  member_since: string | null;
  marketing_consent: boolean;
  can_invite_household: boolean;
  /** Their number was already on another Passport when they joined: the app asks for a different one. */
  needs_phone: boolean;
}
export interface HouseholdMember { first_name: string; last_name: string; status: "invited" | "active" }
export interface Me { member: Member; household: HouseholdMember[] }
/** Sign-up: off (nobody joins), invite (a valid invitation is needed), open (anyone). */
export type SignupMode = "off" | "invite" | "open";
export interface Config { signup_mode: SignupMode; terms_version: number; terms_text: string }
export interface LinkInfo { kind: "set_password" | "reset"; first_name: string; needs_details: boolean; phone: string }
export interface SignedIn { member: Member; session_token: string; expires_at: string; household_invited?: number }
/** Sign-up answers "check your email", or (a personal invitation sent to that same email) signs in at once. */
export type SignUpResult = { ok: true; check_email: true } | (SignedIn & { signed_in: true })

export const getConfig = () => passport<{ config: Config }>("GET", "/config").then((r) => r.config);
export const getMe = (auth: MemberAuth) => passport<Me>("GET", "/me", { auth });

// ── File 03a: the library, Passport cocktails, the spirits archive, Toast menus ──
// Exactly the fields the Bible's approved list sends (server/passport/guestSafe.js).
export interface CocktailCard { id: number; name: string; flavor: string; menu_name: string; menu_status: "current" | "past"; passport: "current" | "past" | null }
export interface Cocktail extends CocktailCard { ingredients: string; tagline: string; notes: string; bottles?: DrinkBottle[]; home_recipe?: boolean }
/**
 * "Bottles in this drink" (Nov 25, 2026): from the Bible's own recipe, names and categories only, in recipe order.
 * id is the bottle page; null for a recipe placeholder, which arrives as a plain spirit word ("Bourbon"). Absent when
 * the cocktail has no bottles to list or the bar keeps its bottles secret.
 */
export interface DrinkBottle { id: number | null; name: string; category: string }
export interface ArchivedBottle { id: number; name: string; category: string; producer: string; description: string; status_label: string | null }
/** Toast menus as the Bible's approved list sends them (menu reader). */
export interface MenuPrice { label: string | null; price: number }
export interface MenuItem { name: string; description: string; prices: MenuPrice[]; cocktail_id: number | null; bottle_id: number | null; unavailable: boolean; card?: MenuCard }
/**
 * The matched library cocktail's tagline, ingredients and flavor line, sent with the menu item (no call per cocktail).
 * Only when the Toast item has that cocktail's own name; a variant ("… - Free Spirited") has none and keeps its own
 * Toast description.
 */
export interface MenuCard { tagline: string; ingredients: string; flavor: string }
export interface MenuGroup { name: string; items: MenuItem[] }
export interface ToastMenu { name: string; groups: MenuGroup[] }
export interface MenuInfo { available: boolean; updated_at: string | null }

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
export interface Fact { label: string; value: string }
export interface BottleCocktail { id: number; name: string; menu_name: string; menu_status: "current" | "past" }
export interface Bottle extends ArchivedBottle { producer_id: number | null; passport_description?: string; prices: MenuPrice[]; facts: Fact[]; cocktails: BottleCocktail[] }
export interface ProducerBottle { id: number; name: string; category: string; status_label: string | null }
/** passport_description: the approved Passport text (Part 6), or "" when there is none yet. */
export interface Producer { id: number; name: string; based_in: string; passport_description?: string; bottles: ProducerBottle[] }
export interface BaseSpirit { key: string; label: string; count: number }
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
export type ItemKind = "cocktail" | "bottle";
/** An item in the member's records. opens=false: it can no longer be opened, so show its name only (id is null). */
export interface MyItem { ref: number; kind: ItemKind; id: number | null; name: string; label: string | null; opens: boolean }
export interface FavoriteItem extends MyItem { added_at: string }
export interface RatingItem extends MyItem { stars: number; rated_at: string }
export interface NoteItem extends MyItem { body: string; updated_at: string }
export interface ListItem extends MyItem { position: number }
export interface HistoryItem extends Omit<MyItem, "ref"> { count: number; last_ordered: string }
/** The member's own heart and stars on a card. */
export interface Mark { kind: ItemKind; id: number; favorite: boolean; rating: number | null }
export type Marks = Record<string, Mark>;
export const markKey = (kind: ItemKind, id: number) => `${kind}:${id}`;
/** The member's own marks on the page they're looking at. */
export interface Mine { favorite: boolean; rating: number | null; note: string; ordered_count: number; last_ordered: string | null }
export interface PassportList { id: number; name: string; kind: ItemKind; ranked: boolean; count: number; cap: number | null; items?: ListItem[] }
export interface Pick { kind: ItemKind; id: number; name: string; label: string | null }
export interface BespokeLine { quantity: string; unit: string; name: string; sub_recipe: string }
/** made_by: the first name of the staff member who added it, or null when the member wrote it. */
export interface Bespoke { id: number; name: string; notes: string; lines: BespokeLine[]; made_by: string | null; by_staff: boolean; created_at: string; updated_at: string }
export interface History { empty: boolean; cocktails: HistoryItem[]; spirits: HistoryItem[] }

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
