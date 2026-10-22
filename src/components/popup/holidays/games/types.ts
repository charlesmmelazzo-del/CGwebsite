import type { RoomView } from "@/lib/holidays/types";

/** What every game board receives. */
export interface BoardProps<V> {
  view: V;
  /** This phone's player id. */
  you: string;
  players: RoomView["players"];
  /** Send a game action. Resolves to an error message, or null when it landed. */
  send: (action: unknown) => Promise<string | null>;
  /** server clock − phone clock. */
  skew: number;
  /** This phone is the room's host (can make visible score corrections). */
  isHost?: boolean;
  /** Rendered as the picture on the game's detail sheet: nothing is tappable. */
  preview?: boolean;
}
