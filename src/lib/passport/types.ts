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
  /** File 12: their own "Suggest things for me" switch (on by default). */
  suggest?: boolean;
  /** File 13: their own "Share order history with my household" switch (on by default). */
  household_history?: boolean;
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
export interface Cocktail extends CocktailCard { ingredients: string; tagline: string; notes: string; bottles?: DrinkBottle[]; home_recipe?: boolean; photo?: string | null; photo_alt?: string; photo_clear?: boolean }
/**
 * "Bottles in this drink" (Nov 25, 2026): from the Bible's own recipe, names and categories only, in recipe order.
 * id is the bottle page; null for a recipe placeholder, which arrives as a plain spirit word ("Bourbon"). Absent when
 * the cocktail has no bottles to list or the bar keeps its bottles secret.
 */
export interface DrinkBottle { id: number | null; name: string; category: string; /** File 17: its small picture, while it opens a page. */ photo?: string | null; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }
export interface ArchivedBottle { id: number; name: string; category: string; producer: string; description: string; status_label: string | null }
/** Toast menus as the Bible's approved list sends them (menu reader). */
export interface MenuPrice { label: string | null; price: number }
export interface MenuItem { name: string; description: string; prices: MenuPrice[]; cocktail_id: number | null; bottle_id: number | null; unavailable: boolean; card?: MenuCard; photo?: string | null; cover?: boolean; producer?: string; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }
/**
 * The matched library cocktail's tagline, ingredients and flavor line, sent with the menu item (no call per cocktail).
 * Only when the Toast item has that cocktail's own name; a variant ("… - Free Spirited") has none and keeps its own
 * Toast description.
 */
export interface MenuCard { tagline: string; ingredients: string; flavor: string }
export interface MenuGroup { name: string; items: MenuItem[] }
export interface ToastMenu { name: string; groups: MenuGroup[] }
export interface MenuInfo { available: boolean; updated_at: string | null }
/**
 * File 14: one Menu tab, in the admin's order: menus[menu], the whole menu (groups null: "one tab" under its own
 * name) or those groups of it (a menu shown as "groups as tabs", whose own name is never a label).
 */
export interface MenuTabDef { label: string; menu: number; groups: number[] | null }
/** File 14: a "By menu" album in the Index (newest first). */
export interface Album { name: string; current: boolean }
export interface Fact { label: string; value: string }
export interface BottleCocktail { id: number; name: string; menu_name: string; menu_status: "current" | "past" }
export interface Bottle extends ArchivedBottle { producer_id: number | null; passport_description?: string; prices: MenuPrice[]; facts: Fact[]; cocktails: BottleCocktail[]; photo?: string | null; photo_alt?: string; photo_clear?: boolean;
  /** File 17: the picture is the brand's logo (no bottle photo yet): drawn on a light panel, never in a collage. */
  photo_logo?: boolean; photo_logo_light?: boolean;
  /** File 15: "Photo: {credit}" in small type, only when the bar typed a credit for its photo. */
  photo_credit?: string;
  /** File 15, Part F: false for a beer, wine or cider not sold whole, so "Request a bottle for home" is hidden. */
  can_request?: boolean }
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
/** File 13: last_ordered is null when only household members' checks count for it (their dates are never shown). */
export interface HistoryItem extends Omit<MyItem, "ref"> { count: number; last_ordered: string | null }
/** The member's own heart and stars on a card. */
export interface Mark { kind: ItemKind; id: number; favorite: boolean; rating: number | null }
export type Marks = Record<string, Mark>;
export const markKey = (kind: ItemKind, id: number) => `${kind}:${id}`;
/** The member's own marks on the page they're looking at. */
/** File 13: ordered_household is true when ordered_count includes household members' checks (sharing on). */
export interface Mine { favorite: boolean; rating: number | null; note: string; ordered_count: number; last_ordered: string | null; ordered_household?: boolean }
export interface PassportList { id: number; name: string; kind: ItemKind; ranked: boolean; count: number; cap: number | null; items?: ListItem[]; covers?: CoverPhoto[] }
/** File 15, Part C: one photo of a collage, from an item this member may open (the Bible chooses them). */
export interface CoverPhoto { kind: ItemKind; id: number; photo: string; name?: string; photo_clear?: boolean }
export interface Pick { kind: ItemKind; id: number; name: string; label: string | null }
export interface BespokeLine { quantity: string; unit: string; name: string; sub_recipe: string }
/** made_by: the first name of the staff member who added it, or null when the member wrote it. */
export interface Bespoke { id: number; name: string; notes: string; lines: BespokeLine[]; made_by: string | null; by_staff: boolean; created_at: string; updated_at: string }
/** File 13: view "household" (Me and my household, the default when it applies) or "me" (Just me); household: whether both views apply. */
export interface History { empty: boolean; cocktails: HistoryItem[]; spirits: HistoryItem[]; view?: "household" | "me"; household?: boolean }
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
  /** File 17: the bottle's small picture, while bottle_id is sent. */
  photo?: string | null; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean;
}
export interface BottleRequests { requests: BottleRequest[]; open_count: number; max_open: number }
// ── File 06: the new shell (Index tab, search, the member's own upcoming reservations) ──────────────────────────
/** A cocktail in the Index or in search. available: on a ticked Toast menu today. spirits: base-spirit keys (Index only). */
export interface IndexCocktail extends CocktailCard { available: boolean; spirits?: string[]; photo?: string | null; menus?: string[]; cover?: boolean; photo_clear?: boolean }
/** A bottle a member may open. available: on the shown spirits list and not out. */
export interface IndexBottle { id: number; name: string; category: string; status_label: string | null; available: boolean; photo?: string | null; producer?: string; on_list?: boolean; cover?: boolean; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }
/** A beer, wine or cider sold on the list (past or present). It has no page of its own. */
/** File 15: id and photo only so its photo can be shown (it still has no page); cover: the admin's "Use as cover". */
export interface IndexDrink { name: string; kind: "Beer" | "Wine" | "Other"; description: string; status_label: string | null; available: boolean; id?: number | null; photo?: string | null; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean; cover?: boolean }
export interface FoundProducer { id: number; name: string; based_in: string }
export interface IndexData { cocktails: IndexCocktail[]; bottles: IndexBottle[]; drinks: IndexDrink[]; base_spirits: BaseSpirit[]; recommendations?: Recommendation[]; enough?: boolean; suggest?: boolean; albums?: Album[] }
// ── File 12: "For you" ────────────────────────────────────────────────────────
/**
 * One suggestion, built by the Bible only from the member's own favorites, ratings, orders, lists and notes (never
 * anyone else's): something being served right now, with one plain reason ("Because you love …").
 */
export interface Recommendation {
  kind: ItemKind; id: number; name: string; reason: string; available: boolean; photo?: string | null; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean;
  flavor?: string; menu_name?: string; menu_status?: "current" | "past"; passport?: "current" | "past" | null; category?: string;
}
/** What "For you" holds: suggest false (switched off in Account), enough false (too little of their own history yet). */
export interface ForYou { recommendations: Recommendation[]; enough: boolean; suggest: boolean }
export interface FindResults { cocktails: IndexCocktail[]; bottles: IndexBottle[]; producers: FoundProducer[] }
/** One of the member's own upcoming reservations: date (YYYY-MM-DD), start time as the bar shows it, party size, status. */
export interface Reservation { date: string; time: string; party_size: number; status: "requested" | "approved" | "guest_confirmed" }
// ── File 07: From the bar (house lists, the two charts, Spirit of the Day, the Welcome Aperitif, messages, What's new) ──
/** One cocktail or bottle on a house list or a chart. id is null (name only) when it can no longer be opened. */
export interface HouseItem { kind: ItemKind; id: number | null; name: string; label: string | null; opens: boolean; note?: string; pour_oz?: number | null; photo?: string | null; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }

// ── File 11: photos. The bar's photo is an opaque code (`photo`) on items a member may open; the picture itself comes
// only through /passport/photo/… for the signed-in member. A member's own photos reach only that member.
export interface MemberPhoto {
  id: string | null; caption: string; at: string; width?: number; height?: number
  removed?: boolean; kind?: ItemKind; item_id?: number | null; item_name?: string; opens?: boolean
}
export interface PhotoLimits { per_item: number; left_here: number; left_today: number; left_total: number; caption_max: number }
export interface PhotosData { photos: MemberPhoto[]; photo_limits: PhotoLimits }
/** Where the bar's photo of an item is shown from (the code changes when the photo does, so a long browser cache is safe). */
export const barPhotoSrc = (kind: ItemKind, id: number, photo: string, size: "thumb" | "full" = "thumb") => `/passport/photo/bar/${kind}/${id}/${size}?v=${encodeURIComponent(photo)}`;
/** A member's own photo (only they get it; never cached anywhere shared). */
export const myPhotoSrc = (token: string, size: "thumb" | "full" = "thumb") => `/passport/photo/mine/${encodeURIComponent(token)}/${size}`;
/** A house list: playlist or ranked; a staff pick carries the team member's first name; a flight carries a price in whole dollars. */
export interface HouseList {
  id: number; title: string; intro: string; kind: ItemKind; ranked: boolean; by: string | null; staff_pick: boolean; price: number | null; count: number;
  past: boolean; ended_on?: string | null; chart?: "top" | "critics" | null; season_name?: string | null; items?: HouseItem[]; covers?: CoverPhoto[];
}
/** Top of the Charts or Critics' Choice: five cocktails in order. Never a number but the cocktails' own page numbers. */
export interface Chart { key: "top" | "critics"; title: string; season_name: string; items: HouseItem[] }
export interface BarMessage { id: number; title: string; body: string; link_kind: "list" | "cocktail" | "bottle" | "events" | null; link_id: number | null; link_label: string | null; posted_at: string | null; comments?: boolean }
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
export interface NotifyPrefs { messages: boolean; requests: boolean; bottles: boolean; friends?: boolean; comments?: boolean; votes?: boolean; chats?: boolean; channels?: boolean; news: boolean; digest: boolean; digest_hour: number }
/** File 13: notifications on this device. public_key is the Bible's PUBLIC web-push key (not a secret); never the private one. */
export interface PushStatus { public_key: string; subscribed: boolean; devices: number }

// ── File 09: friends, direct messages, sharing, Let's go, I'm here and Passport events (the Bible's approved list). ──
// What a member ever sees of another member is a display name. Numbers here name a friendship, a request, a
// conversation, a share, a plan or a block the member is part of; never another member.
export interface SocialSettings { display_name: string; default_name: string; shown_as: string; friend_code: string; share_presence: boolean }
export interface Friend { id: number; name: string; here: boolean; since: string; conversation_id: number | null; unread: boolean }
export interface FriendRequest { id: number; name: string; at: string }
export interface FriendAsk { id: number; typed: string; via: "email" | "phone" | "code" | "household"; at: string }
export interface FriendSuggestion { id: string; name: string }
export interface BlockedPerson { id: number; name: string }
export interface SocialLimits { friends: number; max_friends: number; sent: number; max_sent: number; lookups_left: number; muted: boolean }
export interface FriendsOverview { settings: SocialSettings; friends: Friend[]; incoming: FriendRequest[]; sent: FriendAsk[]; suggested: FriendSuggestion[]; blocked: BlockedPerson[]; limits: SocialLimits }
export type ShareKind = "cocktail" | "bottle" | "house_list" | "list" | "recipe" | "event";
export interface SharedListItem { kind: ItemKind; id: number | null; name: string; opens: boolean }
export interface ShareCard {
  id: number; kind: ShareKind; name: string; note: string; from: "me" | "friend"; from_name: string | null; ref_id: number | null; opens: boolean; saved: boolean; at: string;
  /** File 15, Part G: an event from the public website (its id there), opening its page in Passport. */
  public_event_id?: string;
  /** File 17: a shared cocktail or bottle the member may open carries its small picture (photo_logo: a brand logo). */
  photo?: string | null; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean;
  list?: { kind: ItemKind; ranked: boolean; items: SharedListItem[] };
  recipe?: { name: string; notes: string; lines: BespokeLine[]; made_by: string | null };
}
export interface DmPost {
  id: number; from: "me" | "friend"; body: string; removed: boolean; at: string; share: ShareCard | null;
  /** File 16: the message it answers (a short quote), and reactions from the two of them. */
  reply_to?: { id: number; name: string; text: string } | null; reactions?: { emoji: string; count: number; mine: boolean; names: string[] }[];
}
export interface Conversation {
  id: number; available: boolean; name: string | null; friend_id?: number; unread: boolean; last_at?: string; last_from?: "me" | "friend"; preview?: string;
  here?: boolean; can_write?: boolean; posts?: DmPost[];
}
export type LetsGoTime = "afternoon" | "early" | "evening" | "late";
export type LetsGoAnswer = "in" | "maybe" | "cant";
export interface LetsGo {
  id: number; mine: boolean; day: string; time: LetsGoTime; time_label: string; note: string; from_name: string | null;
  my_answer?: LetsGoAnswer | null; in_count?: number; maybe_count?: number; answers?: { name: string; answer: LetsGoAnswer | null }[];
}
export interface Presence { here: boolean; until: string | null; share_presence: boolean }
export interface MemberNotice { id: number; body: string; at: string; unread: boolean }
export interface EventRsvp { status: "going" | "cant" | "waitlist" | "offered" | "missed"; label: string; guests: number; offer_expires_at: string | null }
export interface PassportEvent {
  id: number; title: string; description: string; date: string; start: string; end: string | null; price_text: string; ticket_url: string | null; rsvp: boolean; guest_limit: number;
  status: "announced" | "full" | "past" | "cancelled"; status_label: string; cancel_note: string; my_rsvp: EventRsvp | null; friends_going: { names: string[]; count: number } | null;
  answered?: "going" | "waitlist" | "cant";
}
export interface EventNotice { kind: "offer" | "cancelled"; id: number; title: string; date: string; until: string | null }
export interface SocialHome { presence: Presence; friends_here: { name: string }[]; letsgo: LetsGo[]; shared: ShareCard[]; has_friends: boolean; event_notices: EventNotice[] }
export interface SocialInbox { conversations: Conversation[]; incoming: FriendRequest[]; notices: MemberNotice[]; comment_replies?: CommentNotice[] }

// ── File 10: comments on the bar's curated content, flight votes and brackets (the Bible's approved list). A member's own
// pick is the only vote ever sent; never a count of votes or voters; percentages only after voting ends, when ticked. ──
export type CommentType = "list" | "message" | "event" | "flight" | "bracket";
export interface PComment {
  id: number; from: "me" | "member" | "bar"; name: string | null; body: string; at: string; edited: boolean; removed: boolean; deleted: boolean;
  can_edit: boolean; edit_until: string | null; replies?: PComment[];
}
export interface CommentThread { locked: boolean; can_write: boolean; why_not: string | null; first_time: boolean; note: string; items: PComment[] }
export interface CommentNotice { id: number; name: string; title: string; link_kind: CommentType; link_id: number; at: string; unread: boolean }
export interface VoteCard { kind: "flight" | "bracket"; id: number; title: string; status: "open" | "closed"; line: string; winner: string | null; done: boolean; covers?: CoverPhoto[] }
export interface FlightOption { id: number; bottle_id: number | null; name: string; category: string; opens: boolean; winner: boolean; pct: number | null }
export interface FlightSlot { id: number; label: string; my_pick: number | null; options: FlightOption[] }
export interface FlightVote { id: number; title: string; intro: string; pour_oz: number | null; status: "open" | "closed"; status_label: string; when: string; slots: FlightSlot[]; done: boolean }
export interface BracketEntry { seed: number; kind: ItemKind; id: number | null; name: string; opens: boolean }
export interface BracketMatchup { id: number | null; a: BracketEntry | null; b: BracketEntry | null; winner: "a" | "b" | null; my_pick: "a" | "b" | null; a_pct: number | null; b_pct: number | null }
export interface BracketRound { round: number; name: string; when: string; state: "upcoming" | "open" | "done"; matchups: BracketMatchup[] }
export interface Bracket {
  id: number; title: string; intro: string; kind: ItemKind; size: number; status: "open" | "paused" | "closed"; status_label: string; when: string;
  current_round: number; rounds: BracketRound[]; winner: BracketEntry | null;
}
export interface VotesData { votes: VoteCard[]; vote_results: VoteCard[]; past_count: number }
