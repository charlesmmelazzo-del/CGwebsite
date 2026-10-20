// ─── Cocktail Competitions — shared types ────────────────────────────────────
//
// Safe to import from client components: nothing here touches the database.

export type CompStatus = "draft" | "published" | "live" | "finished";
export type SubmissionStatus = "invited" | "submitted" | "changes_requested" | "approved";

/**
 * One question on the contestant form. `role` marks the fields the guest
 * screens rely on (a bartender's name and bar, a cocktail's name) — the admin
 * can relabel those but not delete them.
 */
export type FieldDef = {
  id: string;
  label: string;
  hint?: string;
  type: "text" | "textarea";
  role?: "name" | "bar";
};

export type ScoreCategory = { id: string; label: string };
export type Superlative = { id: string; label: string };

/**
 * An attendee tier. `weight` is the percentage of each contestant's overall
 * score decided by this tier's average. `isJudge` puts the tier on the judges'
 * ballot timing and in the judges' reveal.
 */
export type Tier = {
  id: string;
  label: string;
  weight: number;
  isJudge: boolean;
  count: number;
};

export type Recipe = {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  ingredients: string;
  method: string;
};

export type SponsorProduct = {
  id: string;
  name: string;
  category?: string;
  origin?: string;
  abv?: string;
  howMade?: string;
  tastingNotes?: string;
  photoUrl?: string;
};

export type SponsorProfile = {
  brandName?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  tagline?: string;
  story?: string;
  photos?: string[];
  products?: SponsorProduct[];
  links?: {
    website?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    whereToBuy?: string;
  };
};

export type SponsorContact = { name?: string; email?: string; phone?: string };
export type ContestantContact = { email?: string; phone?: string };

/** Free-form answers keyed by FieldDef id, plus the optional photo. */
export type Answers = Record<string, string> & { photoUrl?: string };

export type CompEvent = {
  id: string;
  slug: string;
  name: string;
  featuredSpirit: string;
  eventDate: string | null;
  startTime: string;
  arrivalTime: string;
  location: string;
  contactEmail: string;
  intro: string;
  accentColor: string;
  status: CompStatus;
  isDemo: boolean;
  /** Shown on the public Events page. Off = works by link only. */
  listed: boolean;
  contestantDeadline: string | null;
  partnerDeadline: string | null;
  rulesText: string;
  bartenderFields: FieldDef[];
  cocktailFields: FieldDef[];
  scoreCategories: ScoreCategory[];
  superlatives: Superlative[];
  tiers: Tier[];
  recipes: Recipe[];
  bigScreen: boolean;
  hostToken: string;
  liveState: LiveState;
  liveVersion: number;
};

export type Sponsor = {
  id: string;
  eventId: string;
  token: string;
  sort: number;
  isPrimary: boolean;
  label: string;
  status: SubmissionStatus;
  adminNote: string;
  contact: SponsorContact;
  profile: SponsorProfile;
  reopened: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
};

export type Contestant = {
  id: string;
  eventId: string;
  token: string;
  sort: number;
  label: string;
  status: SubmissionStatus;
  adminNote: string;
  contact: ContestantContact;
  bartender: Answers;
  cocktail: Answers;
  agreedAt: string | null;
  reopened: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
};

export type CompCode = {
  id: string;
  code: string;
  tierId: string;
  name: string;
  claimed: boolean;
  claimedAt: string | null;
};

// ─── Live state (driven by the host) ─────────────────────────────────────────

export type LivePhase = "lobby" | "contestant" | "superlatives" | "reveal" | "finished";
export type LiveStep = "bartender" | "cocktail" | "voting";

export type JudgeCard = { name: string; scores: Record<string, number> };

export type RevealedWinner = {
  /** "overall" or a superlative id */
  key: string;
  label: string;
  contestantId: string;
};

export type LiveState = {
  phase: LivePhase;
  contestantId?: string;
  step?: LiveStep;
  judgeVoting?: boolean;
  guestVoting?: boolean;
  /** Snapshot taken when the host reveals the judges — public by design. */
  judgeReveal?: { contestantId: string; judges: JudgeCard[] } | null;
  /** Contestants whose voting the host has closed. */
  closed?: string[];
  superlativesOpen?: boolean;
  /** Winners the host has revealed so far, in reveal order. */
  revealed?: RevealedWinner[];
  /** Host's picks for tied results, keyed like RevealedWinner.key. Never sent to guests. */
  tieBreaks?: Record<string, string>;
};

export const EMPTY_LIVE_STATE: LiveState = { phase: "lobby", closed: [], revealed: [] };

/** What guests, the big screen and the polling endpoint get — never tie breaks. */
export function publicLiveState(s: LiveState): LiveState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tieBreaks, ...rest } = s;
  return rest;
}

// ─── Guest-facing shapes (only approved content) ────────────────────────────

export type PublicSponsor = { id: string; isPrimary: boolean; profile: SponsorProfile };

export type PublicContestant = {
  id: string;
  sort: number;
  bartender: Answers;
  cocktail: Answers;
};

export type PublicEvent = {
  id: string;
  slug: string;
  name: string;
  featuredSpirit: string;
  eventDate: string | null;
  startTime: string;
  location: string;
  intro: string;
  accentColor: string;
  status: CompStatus;
  bartenderFields: FieldDef[];
  cocktailFields: FieldDef[];
  scoreCategories: ScoreCategory[];
  superlatives: Superlative[];
  recipes: Recipe[];
  bigScreen: boolean;
  sponsors: PublicSponsor[];
  contestants: PublicContestant[];
  commonGoodLogo: string;
};

export type Viewer = {
  codeId: string;
  code: string;
  tierId: string;
  tierLabel: string;
  isJudge: boolean;
  name: string;
};
