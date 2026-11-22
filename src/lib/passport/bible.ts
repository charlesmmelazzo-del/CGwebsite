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
  method: "GET" | "POST" | "PUT",
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
export interface Cocktail extends CocktailCard { ingredients: string; tagline: string; notes: string; ingredient_items?: IngredientItem[]; home_recipe?: boolean }
/** File 03b: one word of the published ingredient list; bottle_id only for a link the bar approved. */
export interface IngredientItem { text: string; bottle_id: number | null }
export interface ArchivedBottle { id: number; name: string; category: string; producer: string; description: string; status_label: string | null }
/** Toast menus as the Bible's approved list sends them (menu reader). */
export interface MenuPrice { label: string | null; price: number }
export interface MenuItem { name: string; description: string; prices: MenuPrice[]; cocktail_id: number | null; bottle_id: number | null; unavailable: boolean }
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
export interface Bottle extends ArchivedBottle { producer_id: number | null; prices: MenuPrice[]; facts: Fact[]; cocktails: BottleCocktail[] }
export interface ProducerBottle { id: number; name: string; category: string; status_label: string | null }
export interface Producer { id: number; name: string; based_in: string; bottles: ProducerBottle[] }
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

