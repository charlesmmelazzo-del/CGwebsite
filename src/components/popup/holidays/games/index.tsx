"use client";

// ─── Boards for every game ───────────────────────────────────────────────────
//
// One entry per game in lib/holidays/games. `demo` builds a sample table for
// the picture on the game's detail sheet (used until real art is supplied).

import type { ComponentType } from "react";
import { seeded } from "@/lib/holidays/cards";
import { getGame } from "@/lib/holidays/games";
import type { GameCtx, Seat } from "@/lib/holidays/types";
import { EuchreBoard, IDoubtItBoard, PresidentBoard, RummyBoard } from "./CardBoards";
import { FarkleBoard, FiveDiceBoard, ShutTheBoxBoard, WordGridBoard } from "./DiceBoards";
import { AllFivesBoard, DrawDominoesBoard, Texas42Board, TrainBoard } from "./DominoBoards";
import { FishbowlBoard, MassiveDecksBoard, PassTheWordBoard, TurnBoard, UniqueCluesBoard } from "./PartyBoards";
import type { BoardProps } from "./types";

const DEMO_NAMES = ["You", "Nana", "Uncle Ray", "Jess", "Theo", "Mae"];

function demoSeats(n: number, teams = false): Seat[] {
  return DEMO_NAMES.slice(0, n).map((name, i) => ({ id: `d${i}`, name, ...(teams ? { team: i % 2 } : {}) }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each board owns its view type
type AnyBoard = ComponentType<BoardProps<any>>;

interface BoardEntry {
  Board: AnyBoard;
  /** A sample game in progress, seen from player d0. */
  demo: () => unknown;
}

/** Set up `key` for `n` demo players, apply `moves`, and view it as d0. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function demo(key: string, n: number, teams: boolean, moves: (s: any, ctx: GameCtx) => any = (s) => s) {
  return () => {
    const game = getGame(key)!;
    const ctx: GameCtx = { now: 0, rand: seeded(42), isWord: () => true };
    try {
      return game.view(moves(game.setup(demoSeats(n, teams), ctx), ctx), "d0");
    } catch {
      return game.view(game.setup(demoSeats(n, teams), ctx), "d0");
    }
  };
}

/** Make it d0's turn (most turn-based states keep a `turn` seat index). */
const yourTurn = <T extends { turn: number }>(s: T) => ({ ...s, turn: 0 });

export const BOARDS: Record<string, BoardEntry> = {
  euchre: { Board: EuchreBoard, demo: demo("euchre", 4, true, yourTurn) },
  president: { Board: PresidentBoard, demo: demo("president", 4, false, yourTurn) },
  "i-doubt-it": { Board: IDoubtItBoard, demo: demo("i-doubt-it", 4, false, yourTurn) },
  "classic-rummy": {
    Board: RummyBoard,
    demo: demo("classic-rummy", 3, false, (s) => ({ ...s, turn: 0, phase: "play", melds: [{ id: 1, owner: 1, cards: ["7S", "7H", "7D"] }] })),
  },
  "draw-dominoes": {
    Board: DrawDominoesBoard,
    demo: demo("draw-dominoes", 3, false, (s) => ({ ...s, turn: 0, line: [[2, 5], [5, 5], [5, 1], [1, 6]] })),
  },
  "all-fives": {
    Board: AllFivesBoard,
    demo: demo("all-fives", 3, false, (s) => ({
      ...s,
      turn: 0,
      layout: { line: [], spinner: 5, arms: { W: [{ tile: "0-5", near: 5, far: 0 }], E: [{ tile: "2-5", near: 5, far: 2 }], N: [{ tile: "3-5", near: 5, far: 3 }], S: [] } },
    })),
  },
  "texas-42": {
    Board: Texas42Board,
    demo: demo("texas-42", 4, true, (s) => ({ ...s, phase: "play", trump: 5, high: { seat: 0, bid: { points: 34 } }, turn: 0, trick: [] })),
  },
  "train-dominoes": { Board: TrainBoard, demo: demo("train-dominoes", 4, false) },
  "forbidden-words": {
    Board: TurnBoard,
    demo: demo("forbidden-words", 6, true, (s, ctx) => ({ ...getGame("forbidden-words")!.act({ ...s, giver: "d0", team: 0, referee: "d1" }, "d0", { type: "start" }, ctx), endsAt: null, phase: "live" })),
  },
  "word-relay": {
    Board: TurnBoard,
    demo: demo("word-relay", 6, true, (s, ctx) => ({ ...getGame("word-relay")!.act({ ...s, giver: "d0", team: 0 }, "d0", { type: "start" }, ctx), endsAt: null })),
  },
  fishbowl: { Board: FishbowlBoard, demo: demo("fishbowl", 6, true) },
  "unique-clues": { Board: UniqueCluesBoard, demo: demo("unique-clues", 5, false, (s) => ({ ...s, deadline: 0 })) },
  "massive-decks": { Board: MassiveDecksBoard, demo: demo("massive-decks", 5, false, (s) => ({ ...s, judge: 1, deadline: 0 })) },
  "pass-the-word": {
    Board: PassTheWordBoard,
    demo: demo("pass-the-word", 6, true, (s, ctx) => getGame("pass-the-word")!.act({ ...s, giver: "d0", team: 0 }, "d0", { type: "start" }, ctx)),
  },
  "word-grid": { Board: WordGridBoard, demo: demo("word-grid", 4, false, (s) => ({ ...s, endsAt: 0, phase: "live" })) },
  "five-dice": {
    Board: FiveDiceBoard,
    demo: demo("five-dice", 4, false, (s) => ({ ...s, turn: 0, rolls: 1, dice: [6, 6, 6, 2, 5], held: [true, true, true, false, false] })),
  },
  farkle: { Board: FarkleBoard, demo: demo("farkle", 4, false, (s) => ({ ...s, turn: 0, phase: "choose", dice: [1, 5, 5, 5, 3, 2], turnTotal: 0 })) },
  "shut-the-box": { Board: ShutTheBoxBoard, demo: demo("shut-the-box", 4, false, (s) => ({ ...s, first: 0, open: [1, 2, 4, 5, 6, 9], roll: [4, 3] })) },
};
