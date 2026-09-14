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
  /** Confirmed their email. Required to be sent a prize. */
  emailVerified: boolean;
  /** Server computed age >= 21 from their date of birth. */
  ageVerified: boolean;
  profile: PopupProfile | null;
}

// ─── Template contract ───────────────────────────────────────────────────────
/**
 * Every pop-up experience receives exactly this. Adding a new interactive
 * format means writing one component against this interface and adding one
 * line to src/components/popup/templates/registry.ts — auth, scheduling and
 * the archive all keep working untouched.
 */
export interface PopupTemplateProps {
  menu: PopupMenu;
  cocktails: PopupCocktail[];
  viewer: PopupViewer | null;
  /**
   * Whether this is the pop-up that's live right now. A game leaderboard stays
   * open to anyone's eyes but freezes the moment the pop-up itself closes.
   */
  isLive: boolean;
  /** Record any interactive event (trivia answer, game score, …). */
  recordInteraction: (
    kind: string,
    payload: unknown,
    cocktailId?: string
  ) => Promise<void>;
  /** True when rendering inside the admin sandbox. */
  isSandbox: boolean;
}
