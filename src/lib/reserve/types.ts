/**
 * Shapes returned by the CG Bible's public reservations API
 * (cgbible.com/api/reservations-public — Bible instruction file 02, section 4).
 * Safe to import from client components: types only.
 */

export interface ReserveRules {
  min_minutes: number;
  max_minutes: number;
  step_minutes: number;
  /** How many days ahead guests can book online. */
  window_open_days: number;
  /** How many hours ahead of the start a booking must be made. */
  window_close_hours: number;
  min_age: number | null;
}

export interface SpaceSummary {
  room_id: number;
  table_id: number | null;
  name: string;
  min_guests: number;
  max_guests: number;
}

export interface BibleConfig {
  rules: ReserveRules;
  party: { min: number | null; max: number | null };
  policies: string[];
  spaces: SpaceSummary[];
}

export type CalendarStatus = "open" | "unavailable" | "event";

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  status: CalendarStatus;
  event: { id: number; website_event_id: string | null; title: string } | null;
}

export interface SlotStart {
  /** Minutes from the business day's midnight; may pass 1440 after midnight. */
  start_min: number;
  start_time: string; // HH:MM
  lengths: number[]; // minutes
}

export interface SpaceSlots extends SpaceSummary {
  room_name: string;
  starts: SlotStart[];
}

export interface MaskedGuest {
  first_initial: string;
  email_hint: string;
  phone_hint: string;
}

export type LookupResult =
  | { match: false }
  | { match: true; masked: MaskedGuest; lookup_token: string };

export interface NewGuest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface CreateRequestBody {
  date: string;
  start_time: string;
  start_min: number;
  minutes: number;
  party_size: number;
  room_id: number;
  table_id: number | null;
  event_id?: number | null;
  occasion_note: string;
  policy_ack: true;
  guest?: NewGuest;
  lookup_token?: string;
}

export type ReservationStatus =
  | "requested"
  | "approved"
  | "guest_confirmed"
  | "denied"
  | "cancelled"
  | "no_show"
  | "completed";

export interface GuestMessage {
  id: number;
  from: "guest" | "Common Good";
  kind: string | null; // 'late' for running-late notices
  body: string;
  created_at: string;
}

export interface ClosedReservation {
  closed: true;
  status: ReservationStatus;
  first_name: string;
}

export interface OpenReservation {
  closed: false;
  status: ReservationStatus;
  first_name: string;
  date: string;
  start_time: string;
  end_time: string;
  start_min: number;
  end_min: number;
  minutes: number;
  party_size: number;
  space: { room_id: number; table_id: number | null; name: string };
  party_range: { min: number; max: number };
  occasion_note: string;
  guest_notes: string;
  event_id: number | null;
  event: { id: number; title: string; website_event_id: string | null } | null;
  messages: GuestMessage[];
  change_request: { id: number; date: string; start_time: string; minutes: number; start_min: number } | null;
  can_confirm: boolean;
  policies: string[];
}

export type GuestReservation = ClosedReservation | OpenReservation;

export interface PartyChangeResult {
  ok: boolean;
  moved_to?: SpaceSummary;
  view?: GuestReservation;
}

/** Error body from a failed call: the Bible's message plus any extras (e.g. party options). */
export interface ReserveErrorBody {
  error: string;
  options?: SpaceSummary[];
}

/** Content the admin edits for the Reserve page (stored on this site, not the Bible). */
export interface ReserveFaq {
  id: string;
  question: string;
  answer: string;
}

export interface ReserveContent {
  title: string;
  intro: string;
  imageUrl?: string;
  imageAlt?: string;
  faq: ReserveFaq[];
}

/** What GET /api/reserve/config returns to the browser. */
export interface ReservePageConfig {
  bible: BibleConfig;
  content: ReserveContent;
  phone: string;
}
