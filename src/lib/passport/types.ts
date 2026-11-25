/**
 * The shapes the Bible sends through the Passport connection (its approved list, server/passport/guestSafe.js).
 * Types only, plus one tiny helper: shared by server code and the browser (bible.ts itself is server-only).
 */

/** Who is asking: the Bible checks the session token and that it belongs to this member. */
export type MemberAuth = { token: string; memberId: number };
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
export interface Fact { label: string; value: string }
export interface BottleCocktail { id: number; name: string; menu_name: string; menu_status: "current" | "past" }
export interface Bottle extends ArchivedBottle { producer_id: number | null; passport_description?: string; prices: MenuPrice[]; facts: Fact[]; cocktails: BottleCocktail[] }
export interface ProducerBottle { id: number; name: string; category: string; status_label: string | null }
/** passport_description: the approved Passport text (Part 6), or "" when there is none yet. */
export interface Producer { id: number; name: string; based_in: string; passport_description?: string; bottles: ProducerBottle[] }
export interface BaseSpirit { key: string; label: string; count: number }
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
export type BottleRequestStatus =
  | "submitted" | "quoted" | "accepted" | "ordered" | "ready" | "picked_up" | "declined" | "cancelled" | "quote_declined" | "pickup_declined";
/** A confirmed price only (a price a manager has not confirmed is never sent). */
export interface BottleQuote {
  id: number;
  price_cents: number;
  total_cents: number;
  quantity: number;
  message: string;
  expires_on: string | null;
  expired: boolean;
  state: "waiting" | "accepted" | "declined";
}
export interface BottleRequest {
  id: number;
  kind: "carried" | "other";
  /** The bottle page it opens, only while the member may open it. */
  bottle_id: number | null;
  name: string;
  quantity: number;
  note: string;
  status: BottleRequestStatus;
  status_label: string;
  quote: BottleQuote | null;
  eta: string | null;
  ready_since: string | null;
  message: string;
  message_at: string | null;
  decline_reason: string;
  can_cancel: boolean;
  can_answer: boolean;
  created_at: string;
  updated_at: string;
}
export interface BottleRequests { requests: BottleRequest[]; open_count: number; max_open: number }
// ── File 06: the new shell (Index tab, search, the member's own upcoming reservations) ──────────────────────────
/** A cocktail in the Index or in search. available: on a ticked Toast menu today. spirits: base-spirit keys (Index only). */
export interface IndexCocktail extends CocktailCard { available: boolean; spirits?: string[] }
/** A bottle a member may open. available: on the shown spirits list and not out. */
export interface IndexBottle { id: number; name: string; category: string; status_label: string | null; available: boolean }
/** A beer, wine or cider sold on the list (past or present). It has no page of its own. */
export interface IndexDrink { name: string; kind: "Beer" | "Wine" | "Other"; description: string; status_label: string | null; available: boolean }
export interface FoundProducer { id: number; name: string; based_in: string }
export interface IndexData { cocktails: IndexCocktail[]; bottles: IndexBottle[]; drinks: IndexDrink[]; base_spirits: BaseSpirit[] }
export interface FindResults { cocktails: IndexCocktail[]; bottles: IndexBottle[]; producers: FoundProducer[] }
/** One of the member's own upcoming reservations: date (YYYY-MM-DD), start time as the bar shows it, party size, status. */
export interface Reservation { date: string; time: string; party_size: number; status: "requested" | "approved" | "guest_confirmed" }
// ── File 07: From the bar (house lists, the two charts, Spirit of the Day, the Welcome Aperitif, messages, What's new) ──
/** One cocktail or bottle on a house list or a chart. id is null (name only) when it can no longer be opened. */
export interface HouseItem { kind: ItemKind; id: number | null; name: string; label: string | null; opens: boolean; note?: string; pour_oz?: number | null }
/** A house list: playlist or ranked; a staff pick carries the team member's first name; a flight carries a price in whole dollars. */
export interface HouseList {
  id: number; title: string; intro: string; kind: ItemKind; ranked: boolean; by: string | null; staff_pick: boolean; price: number | null; count: number;
  past: boolean; ended_on?: string | null; chart?: "top" | "critics" | null; season_name?: string | null; items?: HouseItem[];
}
/** Top of the Charts or Critics' Choice: five cocktails in order. Never a number but the cocktails' own page numbers. */
export interface Chart { key: "top" | "critics"; title: string; season_name: string; items: HouseItem[] }
export interface BarMessage { id: number; title: string; body: string; link_kind: "list" | "cocktail" | "bottle" | "events" | null; link_id: number | null; link_label: string | null; posted_at: string | null }
export interface FeedCard { key: string; kind: string; title: string; link_kind: "list" | "chart" | "menu" | string; link_id: number | string | null; at: string }
export interface SpiritOfTheDay { id: number; name: string; category: string; discount_pct: number | null }
export interface WelcomeAperitif { name: string; description: string }
export interface BarHome { messages: BarMessage[]; feed: FeedCard[]; spirit_of_the_day: SpiritOfTheDay | null; welcome_aperitif: WelcomeAperitif | null; newest_list: HouseList | null }
export interface BarLists { house_lists: HouseList[]; charts: Chart[]; past_count: number }
// ── File 08: the Inbox (messages with the bar, general requests, event inquiries). The member's own only. ─────────
/** One message in a conversation. by: a staff member's first name on the bar's messages, else null. */
export interface InboxPost { id: number; from: "member" | "bar"; by: string | null; body: string; at: string; kind: "message" | "question" | "answer" }
/** "Ask about this": the cocktail, bottle or house list attached to a thread. id is null (name only) once it no longer opens. */
export interface InboxRef { kind: "cocktail" | "bottle" | "list"; id: number | null; name: string; opens: boolean }
export interface InboxThread {
  id: number; subject: string; status: "open" | "answered" | "closed"; status_label: string; unread: boolean; ref: InboxRef | null;
  last_at: string | null; last_from: "member" | "bar"; preview: string; count: number; posts?: InboxPost[];
}
export type RequestKind = "cocktail" | "celebration" | "access" | "other";
export interface MemberRequest {
  id: number; kind: RequestKind; kind_label: string; date: string | null; details: string;
  status: "submitted" | "seen" | "in_progress" | "done" | "declined" | "cancelled"; status_label: string; decline_reason: string;
  question: boolean; unread: boolean; posts: InboxPost[]; can_cancel: boolean; can_answer: boolean; created_at: string; updated_at: string;
}
export type EventKind = "private_party" | "tasting" | "buyout" | "other";
export interface EventInquiry {
  id: number; kind: EventKind; kind_label: string; preferred_date: string; backup_date: string | null; time_of_day: string; time_label: string;
  guests: number; budget: string | null; budget_label: string | null; details: string;
  status: "submitted" | "in_conversation" | "proposal_sent" | "confirmed" | "declined" | "cancelled"; status_label: string; decline_reason: string;
  unread: boolean; posts: InboxPost[]; can_cancel: boolean; can_reply: boolean; created_at: string; updated_at: string;
}
export interface InboxLimits {
  open_threads: number; max_open_threads: number; messages_today: number; max_messages_day: number;
  open_requests: number; max_open_requests: number; open_inquiries: number; max_open_inquiries: number;
}
export interface InboxData { threads: InboxThread[]; member_requests: MemberRequest[]; inquiries: EventInquiry[]; limits: InboxLimits }
/** Account → Notifications. news is the member's marketing choice. digest_hour: bar time, 6 to 22. */
export interface NotifyPrefs { messages: boolean; requests: boolean; bottles: boolean; news: boolean; digest: boolean; digest_hour: number }
