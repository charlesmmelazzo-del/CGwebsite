// ─── The Giving Tree — shared types ──────────────────────────────────────────
//
// Organization → Opportunity → Pledge. Field names mirror db/giving-tree.sql
// in camelCase. Dates without a time (deadline, due date, event date) are
// "YYYY-MM-DD" strings in Central time; instants are ISO strings.

export type OppType = "volunteer" | "gift" | "cash";
export type OppStatus = "draft" | "live" | "closed";
export type PledgeStatus = "pledged" | "received" | "delivered" | "released" | "not_received";
export type PledgeHold = "none" | "held_moderation" | "held_amount" | "denied";
export type GuestResponse = "still_on_it" | "more_time";

export const OPP_TYPES: OppType[] = ["volunteer", "gift", "cash"];

export interface Org {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  publicAddress: string | null;
  hideAddress: boolean;
  socialLinks: string[];
  publicContactNote: string | null;
  adminContactName: string | null;
  adminContactEmail: string | null;
  showOnPartners: boolean;
  sortOrder: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  orgId: string;
  type: OppType;
  title: string;
  description: string | null;
  details: string | null;
  status: OppStatus;
  deadline: string | null;
  spots: number;
  treeZone: OppType | null;
  treeX: number | null;
  treeY: number | null;
  sortOrder: number;
  hoursMode: "fixed" | "choose" | null;
  hoursFixed: number | null;
  hoursMin: number | null;
  hoursMax: number | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  requirements: string | null;
  dropoffInstructions: string | null;
  goalAmount: number | null;
  giveUrl: string | null;
  confirmedRaised: number | null;
  confirmedAsOf: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pledge {
  id: string;
  opportunityId: string;
  code: string;
  manageToken: string;
  name: string;
  email: string | null;
  phone: string | null;
  displayMode: "named" | "anonymous";
  displayName: string | null;
  note: string | null;
  showGift: boolean;
  showAmount: boolean;
  hours: number | null;
  amount: number | null;
  status: PledgeStatus;
  hold: PledgeHold;
  hidden: boolean;
  dueDate: string | null;
  reminderAt: string | null;
  reminderSentAt: string | null;
  guestResponse: GuestResponse | null;
  extendedOnce: boolean;
  releasedAt: string | null;
  releaseReason: "guest" | "auto" | "admin" | null;
  overdueFlaggedAt: string | null;
  receivedAt: string | null;
  deliveredAt: string | null;
  ornament: "to_write" | "hung";
  hungAt: string | null;
  source: "web" | "manual";
  consentShare: boolean;
  consentAt: string | null;
  ipHash: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** Last day anything can be pledged or due. YYYY-MM-DD, Central. */
  seasonEnd: string;
  dueWindowDays: number;
  reminderLeadDays: number;
  graceDays: number;
  /** Cash pledges above this are held for review. */
  amountThreshold: number;
  capOpenGift: number;
  capOpenVolunteer: number;
  capCashPerDay: number;
  /** Pledge submissions per IP address per hour. A whole bar shares one Wi-Fi address. */
  ipPerHour: number;
  defaultDropoff: string;
  contactEmail: string;
}

export const DEFAULT_SETTINGS: Settings = {
  seasonEnd: "2026-12-31",
  dueWindowDays: 7,
  reminderLeadDays: 2,
  graceDays: 3,
  amountThreshold: 200,
  capOpenGift: 3,
  capOpenVolunteer: 5,
  capCashPerDay: 5,
  ipPerHour: 10,
  defaultDropoff:
    "Bring your gift to the Giving Tree drop-off box by the bar at Common Good during open hours.",
  contactEmail: "mike@cgcocktails.com",
};

/** How the guest-facing pages are being viewed. */
export type TreeMode =
  /** The Christmas pop-up is live: claims open. Real records only. */
  | "open"
  /** Another pop-up has since gone live: the sky only, no ways to give. */
  | "closed"
  /** Admin sandbox / staging preview: demo and real records, claims open. */
  | "sandbox";

// ─── What the browser receives ───────────────────────────────────────────────
// Never contains an email, phone, real name of an anonymous guest, or an
// organization's admin contact.

export interface PublicOrg {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  socialLinks: string[];
  showOnPartners: boolean;
}

export interface PublicOpportunity {
  id: string;
  orgId: string;
  type: OppType;
  zone: OppType;
  title: string;
  description: string | null;
  details: string | null;
  deadline: string | null;
  spots: number;
  spotsLeft: number;
  /** Position on the tree, 0–100 in each direction. */
  x: number;
  y: number;
  /** Ornament diameter, in the same 0–100 tree units. */
  size: number;
  hoursMode: "fixed" | "choose" | null;
  hoursFixed: number | null;
  hoursMin: number | null;
  hoursMax: number | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  requirements: string | null;
  dropoff: string | null;
  /** Gifts: the due date a pledge made right now would get. */
  dueIfClaimedNow: string | null;
  goalAmount: number | null;
  meterValue: number | null;
  meterLabel: "pledged" | "raised" | null;
  meterAsOf: string | null;
  isDemo: boolean;
}

export interface PublicStar {
  id: string;
  label: string;
  note: string | null;
  /** What they gave, only when the guest allowed it. */
  gave: string | null;
  /** Position in the sky, unit-less; the sky scales to fit. */
  x: number;
  y: number;
  createdAt: string;
}

export interface Counters {
  hours: number;
  dollars: number;
  giftsPromised: number;
  giftsReceived: number;
  neighbors: number;
}

export interface TreeState {
  mode: TreeMode;
  hasDemo: boolean;
  orgs: PublicOrg[];
  opportunities: PublicOpportunity[];
  stars: PublicStar[];
  counters: Counters;
  defaultDropoff: string;
  contactEmail: string;
  seasonEnd: string;
  /** "Today" in Central time, for countdowns. */
  today: string;
}
