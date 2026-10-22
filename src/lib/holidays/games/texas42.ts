// ─── 07 Texas 42 ─────────────────────────────────────────────────────────────
// Handoff preset: 4 players in partnerships, double-six, 7 tiles each; one bid
// each (30–42, or 2 marks, then +1 mark), the declarer names a numeric trump
// or doubles, seven tricks, count tiles (6-4, 5-5 = 10; 5-0, 4-1, 3-2 = 5)
// plus 1 per trick. Marks decide the match: first team to 7.

import { alternateTeams, PARTNERS, randomIndex, TEAM_NAMES } from "../common";
import { ends, isDouble, shuffledSet, sortTiles, type Tile } from "../dominoes";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TARGET_MARKS = 7;
export type Trump = number | "doubles";

/** A bid: 30–42 points, or a number of marks (2+). */
export type Bid = { points: number } | { marks: number };

export interface FortyTwoState {
  seats: Seat[];
  dealer: number;
  hands: Record<string, Tile[]>;
  phase: "bid" | "trump" | "play" | "handOver" | "over";
  turn: number;
  bids: { seat: number; bid: Bid | null }[];
  high: { seat: number; bid: Bid } | null;
  trump: Trump | null;
  trick: { seat: number; tile: Tile }[];
  taken: [Tile[][], Tile[][]];
  lastTrick: { tiles: { seat: number; tile: Tile }[]; winner: number } | null;
  marks: [number, number];
  result: { bidders: number; made: boolean; marks: number; points: number } | null;
  log: string;
}

export type FortyTwoAction = { type: "bid"; bid: Bid | null } | { type: "trump"; trump: Trump } | { type: "play"; tile: Tile } | { type: "nextHand" };

export const COUNT: Record<string, number> = { "4-6": 10, "5-5": 10, "0-5": 5, "1-4": 5, "2-3": 5 };
const team = (seat: number) => seat % 2;

export function bidRank(b: Bid): number {
  return "marks" in b ? 100 + b.marks : b.points;
}

export function bidLegal(high: Bid | null, b: Bid): boolean {
  if ("points" in b) return Number.isInteger(b.points) && b.points >= 30 && b.points <= 42 && (!high || bidRank(b) > bidRank(high));
  if (!Number.isInteger(b.marks) || b.marks < 2) return false;
  if (!high || "points" in high) return b.marks === 2;
  return b.marks === high.marks + 1;
}

export function bidLabel(b: Bid): string {
  return "marks" in b ? `${b.marks} marks` : String(b.points);
}

export function isTrump(t: Tile, trump: Trump): boolean {
  return trump === "doubles" ? isDouble(t) : ends(t).includes(trump);
}

/** The suit a tile calls when it is led. */
export function ledSuit(t: Tile, trump: Trump): Trump {
  if (isTrump(t, trump)) return trump;
  return Math.max(...ends(t));
}

export function follows(t: Tile, led: Trump, trump: Trump): boolean {
  if (led === trump) return isTrump(t, trump);
  if (isTrump(t, trump)) return false;
  return ends(t).includes(led as number);
}

/** Rank of a tile within a suit (higher wins). */
export function rankIn(t: Tile, suit: Trump): number {
  const [a, b] = ends(t);
  if (suit === "doubles") return a; // doubles, 6-6 down to 0-0
  if (a === b) return 100; // the double is highest in its suit
  return a === suit ? b : a;
}

export function trickWinner(trick: { seat: number; tile: Tile }[], trump: Trump): number {
  const led = ledSuit(trick[0].tile, trump);
  const power = (t: Tile) => (isTrump(t, trump) ? 1000 + rankIn(t, trump) : follows(t, led, trump) ? rankIn(t, led) : -1);
  return trick.reduce((best, x) => (power(x.tile) > power(best.tile) ? x : best)).seat;
}

export function legalTiles(s: FortyTwoState, seat: number): Tile[] {
  const hand = s.hands[s.seats[seat].id];
  if (s.phase !== "play" || s.turn !== seat) return [];
  if (!s.trick.length) return hand;
  const led = ledSuit(s.trick[0].tile, s.trump!);
  const ok = hand.filter((t) => follows(t, led, s.trump!));
  return ok.length ? ok : hand;
}

export function trickPoints(tiles: Tile[]): number {
  return 1 + tiles.reduce((t, x) => t + (COUNT[x] ?? 0), 0);
}

function deal(seats: Seat[], dealer: number, rand: () => number) {
  const set = shuffledSet(6, rand);
  const hands: Record<string, Tile[]> = {};
  seats.forEach((p, i) => (hands[p.id] = sortTiles(set.slice(i * 7, i * 7 + 7))));
  return { dealer, hands, phase: "bid" as const, turn: (dealer + 1) % 4, bids: [], high: null, trump: null, trick: [], taken: [[], []] as [Tile[][], Tile[][]], lastTrick: null, result: null };
}

export const texas42: GameDef<FortyTwoState, FortyTwoAction> = {
  key: "texas-42",
  name: "Texas 42",
  tagline: "Bid, call trumps, and take tricks — with dominoes.",
  styles: ["dominoes", "teams"],
  minPlayers: 4,
  maxPlayers: 4,
  time: "45–60 min",
  teams: PARTNERS,
  description:
    "The state game of Texas: a partnership trick-taking game played with dominoes. Bid how many of the 42 points your team will capture, name trumps, then play seven tricks. Certain tiles carry bonus points. Make your bid to win a mark; first team to seven marks wins.",
  rules: [
    { heading: "Teams & the deal", body: ["Four players in two partnerships, partners opposite. All 28 tiles are dealt — 7 each."] },
    {
      heading: "Bidding",
      body: [
        "Starting left of the dealer, each player gets one chance to bid or pass. Bids are 30 to 42 and must beat the last one.",
        "You can also bid 2 marks (a promise to take every trick for double stakes); after that, each bid must be one more mark.",
        "If all four pass, the deal moves on.",
      ],
    },
    {
      heading: "Trumps & tricks",
      body: [
        "The high bidder names trumps — a number (0–6) or doubles — and leads first.",
        "Every tile with the trump number is a trump. The double is highest in its suit; other tiles rank by their other end.",
        "A non-trump tile that's led calls its higher number. Follow suit if you can; otherwise play anything. Highest trump wins, else the highest tile of the suit led.",
      ],
    },
    {
      heading: "Points & marks",
      body: [
        "Each trick is worth 1 point. The 6-4 and 5-5 are worth 10 more; the 5-0, 4-1 and 3-2 are worth 5 more. That's 42 in all.",
        "Bids of 30–41 need that many points. A 42 or a marks bid needs all seven tricks.",
        "Make it and your team wins the mark(s); miss and the other team does. First to 7 marks wins.",
      ],
    },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Marks rules after Pagat (McLeod & Celko) and Richardson Corporate Challenge." },

  setup(seats, ctx) {
    const s = alternateTeams(seats).map((p, i) => ({ ...p, team: i % 2 }));
    return { seats: s, marks: [0, 0], log: "", ...deal(s, randomIndex(4, ctx.rand), ctx.rand) };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    if (a.type === "nextHand") {
      if (s.phase !== "handOver") throw new GameError("The hand is still going.");
      return { ...s, ...deal(s.seats, (s.dealer + 1) % 4, ctx.rand), log: "" };
    }
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");
    const name = s.seats[seat].name;

    if (s.phase === "bid") {
      if (a.type !== "bid") throw new GameError("Bid or pass.");
      if (a.bid && !bidLegal(s.high?.bid ?? null, a.bid)) throw new GameError("That bid isn't allowed.");
      const bids = [...s.bids, { seat, bid: a.bid }];
      const high = a.bid ? { seat, bid: a.bid } : s.high;
      const log = a.bid ? `${name} bid ${bidLabel(a.bid)}.` : `${name} passed.`;
      if (bids.length < 4) return { ...s, bids, high, turn: (seat + 1) % 4, log };
      if (!high) return { ...s, ...deal(s.seats, (s.dealer + 1) % 4, ctx.rand), log: "Everyone passed — new deal." };
      return { ...s, bids, high, phase: "trump", turn: high.seat, log: `${s.seats[high.seat].name} wins the bid at ${bidLabel(high.bid)}.` };
    }

    if (s.phase === "trump") {
      if (a.type !== "trump") throw new GameError("Name trumps.");
      if (!(a.trump === "doubles" || (Number.isInteger(a.trump) && a.trump >= 0 && a.trump <= 6))) throw new GameError("Pick 0–6 or doubles.");
      return { ...s, trump: a.trump, phase: "play", turn: seat, log: `${name} called ${a.trump === "doubles" ? "doubles" : `${a.trump}s`} as trumps.` };
    }

    if (s.phase !== "play" || a.type !== "play") throw new GameError("Play a tile.");
    if (!legalTiles(s, seat).includes(a.tile)) throw new GameError(s.hands[playerId].includes(a.tile) ? "You have to follow suit." : "That tile isn't in your hand.");
    const trick = [...s.trick, { seat, tile: a.tile }];
    const hands = { ...s.hands, [playerId]: s.hands[playerId].filter((t) => t !== a.tile) };
    if (trick.length < 4) return { ...s, hands, trick, turn: (seat + 1) % 4, log: "" };

    const winner = trickWinner(trick, s.trump!);
    const taken: [Tile[][], Tile[][]] = [s.taken[0].slice(), s.taken[1].slice()];
    taken[team(winner)].push(trick.map((t) => t.tile));
    const after: FortyTwoState = { ...s, hands, trick: [], taken, lastTrick: { tiles: trick, winner }, turn: winner, log: `${s.seats[winner].name} took the trick.` };
    if (taken[0].length + taken[1].length < 7) return after;

    const bidders = team(s.high!.seat);
    const points = taken[bidders].reduce((t, tr) => t + trickPoints(tr), 0);
    const bid = s.high!.bid;
    const allSeven = taken[bidders].length === 7;
    const made = "marks" in bid || bid.points === 42 ? allSeven : points >= bid.points;
    const won = "marks" in bid ? bid.marks : 1;
    const marks: [number, number] = [...s.marks];
    marks[made ? bidders : 1 - bidders] += won;
    return { ...after, marks, result: { bidders, made, marks: won, points }, phase: marks.some((m) => m >= TARGET_MARKS) ? "over" : "handOver" };
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    return {
      seats: s.seats.map((p, i) => ({ id: p.id, name: p.name, team: i % 2, tiles: s.hands[p.id].length })),
      you: seat,
      hand: s.hands[playerId] ?? [],
      legal: seat >= 0 ? legalTiles(s, seat) : [],
      phase: s.phase,
      dealer: s.dealer,
      turn: s.turn,
      bids: s.bids,
      high: s.high,
      trump: s.trump,
      trick: s.trick,
      points: s.taken.map((ts) => ts.reduce((t, tr) => t + trickPoints(tr), 0)),
      tricks: s.taken.map((ts) => ts.length),
      lastTrick: s.lastTrick,
      marks: s.marks,
      result: s.result,
      log: s.log,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: `${TEAM_NAMES[s.marks[0] >= TARGET_MARKS ? 0 : 1]} wins!`, turn: [] };
    if (s.phase === "handOver") {
      const r = s.result!;
      return { over: false, message: `${TEAM_NAMES[r.made ? r.bidders : 1 - r.bidders]} +${r.marks} mark${r.marks > 1 ? "s" : ""}`, turn: [] };
    }
    const p = s.seats[s.turn];
    const what = s.phase === "bid" ? "to bid" : s.phase === "trump" ? "to name trumps" : "to play";
    return { over: false, message: `${p.name} ${what}`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return [0, 1].map((t) => ({ label: `${TEAM_NAMES[t]} (marks)`, score: s.marks[t], playerIds: s.seats.filter((_, i) => i % 2 === t).map((p) => p.id) }));
  },
};
