// ─── Pop Up Zone — shared types ──────────────────────────────────────────────

export type PopupStatus = "draft" | "scheduled" | "live" | "archived";

export interface PopupMenu {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;

  /** Key into the template registry. Falls back to "classic" if unknown. */
  templateKey: string;
  /** Free-form settings owned by the template that renders this pop-up. */
  config: Record<string, unknown>;

  status: PopupStatus;
  goLiveAt?: string;
  archivedAt?: string;

  /** How many cocktails a guest may rank. */
  voteRankDepth: number;
  /** Points awarded per rank. voteWeights[0] is a first-place vote. */
  voteWeights: number[];
  votingEnabled: boolean;

  bgColor?: string;
  textColor?: string;
  accentColor?: string;
  coverImageUrl?: string;

  createdAt: string;
  updatedAt: string;
}

export interface PopupCocktail {
  id: string;
  menuId: string;
  name: string;
  tagline?: string;
  /** Short flavor description. */
  description?: string;
  ingredients?: string;
  /** Long-form paragraph shown beneath the tasting notes. */
  story?: string;
  imageUrl?: string;
  /** Which mini game belongs to this cocktail (games registry key). */
  gameKey?: string;
  order: number;
  active: boolean;
  /** Template-specific payload — trivia questions, mini-game config, etc. */
  meta: Record<string, unknown>;
}

// ─── Arcade scores ───────────────────────────────────────────────────────────

export interface GameScoreEntry {
  /** Best score this guest has reached on this game. */
  score: number;
  /** Display name — first name plus last initial, never a full email. */
  name: string;
  /** 1-based position. Ties share a position. */
  position: number;
  /** True for the signed-in viewer's own row. */
  isYou: boolean;
  achievedAt: string;
}

export interface GameBoard {
  gameKey: string;
  entries: GameScoreEntry[];
  /** The viewer's own best, even when it's off the bottom of the board. */
  yourBest: number | null;
  yourPosition: number | null;
  totalPlayers: number;
}

/** Why a play-through's score won't count toward the prize. */
export type ScoreBlockReason = "not_signed_in" | "email_unverified" | "scoring_closed";

export interface PopupProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ageVerified: boolean;
}

/**
 * The signed-in guest, always derived server-side from the session cookie.
 * No API route ever accepts a user id from the client.
 */
export interface PopupViewer {
  userId: string;
  email: string;
  /** Confirmed their email. Required to vote. */
  emailVerified: boolean;
  /** Server computed age >= 21 from their date of birth. Required to vote. */
  ageVerified: boolean;
  profile: PopupProfile | null;
}

/** One cocktail on one guest's ballot. rank 1 = their favorite. */
export interface PopupVote {
  cocktailId: string;
  rank: number;
}

export interface LeaderboardEntry {
  cocktailId: string;
  name: string;
  /** Sum of rank weights across all ballots. */
  points: number;
  /** How many guests made this their #1 — tracked separately from points so
   *  "broadly liked" and "someone's outright favorite" stay distinguishable. */
  firstPlaceVotes: number;
  /** Total ballots mentioning this cocktail at any rank. */
  totalVotes: number;
  /** 1-based leaderboard position. Ties share a position. */
  position: number;
}

/** Why a guest can't vote right now — drives the message the UI shows. */
export type VoteBlockReason =
  | "not_signed_in"
  | "email_unverified"
  | "age_unverified"
  | "voting_closed";

export interface VoteResult {
  ok: boolean;
  error?: string;
  reason?: VoteBlockReason;
  ballot?: PopupVote[];
}

// ─── Template contract ───────────────────────────────────────────────────────
/**
 * Every pop-up experience receives exactly this. Adding a new interactive
 * format means writing one component against this interface and adding one
 * line to src/components/popup/templates/registry.ts — auth, voting,
 * scheduling and the archive all keep working untouched.
 */
export interface PopupTemplateProps {
  menu: PopupMenu;
  cocktails: PopupCocktail[];
  viewer: PopupViewer | null;
  /** True only on the currently live pop-up with voting enabled. */
  votingOpen: boolean;
  /**
   * Whether this is the pop-up that's live right now. Distinct from votingOpen,
   * which also depends on the viewer being signed in and confirmed — a game
   * leaderboard stays open to an anonymous visitor's eyes but freezes the
   * moment the pop-up itself closes.
   */
  isLive: boolean;
  /** Why voting is unavailable, when it is. */
  voteBlockReason: VoteBlockReason | null;
  /** This guest's current ballot. */
  myVotes: PopupVote[];
  results: LeaderboardEntry[];
  /** Submit an ordered list of cocktail ids — index 0 is their favorite. */
  onVote: (rankedCocktailIds: string[]) => Promise<VoteResult>;
  /**
   * The standard one-tap voting behaviour, shared by every template:
   * first pick votes outright, tapping an already-picked cocktail removes it,
   * and a second pick opens the ranking prompt. Templates that want an unusual
   * voting interaction can ignore this and drive `onVote` themselves.
   */
  toggleVote: (cocktailId: string) => void;
  /** True while a vote is being saved. */
  voteBusy: boolean;
  /** Last vote error, if any. */
  voteError: string | null;
  /** Record any interactive event (trivia answer, game score, …). */
  recordInteraction: (
    kind: string,
    payload: unknown,
    cocktailId?: string
  ) => Promise<void>;
  /** True when rendering inside the admin sandbox. */
  isSandbox: boolean;
}
