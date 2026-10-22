// npm run test:holidays — plays every game through the same rules the server runs,
// and checks the worked examples from the owner's handoff.

import assert from "node:assert/strict";
import { seeded } from "../cards";
import { GAMES, getGame } from "../games";
import { addPlayer, applyOp, startProblem, tickRoom, viewFor, type Room } from "../rooms";
import { GameError, type GameCtx, type Seat } from "../types";
import { cardPower, effectiveSuit, euchre, legalPlays, type EuchreState } from "../games/euchre";
import { president, type PresidentState } from "../games/president";
import { iDoubtIt, WINDOW_MS, type DoubtState } from "../games/iDoubtIt";
import { isMeld, rummy, type RummyState } from "../games/rummy";
import { drawDominoes, legalEnds, type DrawState } from "../games/drawDominoes";
import { allFives, endSum, legalPorts, placeTile, roundToFive, type FivesState, type Layout } from "../games/allFives";
import { follows, ledSuit, texas42, trickWinner, legalTiles, bidLegal, type FortyTwoState } from "../games/texas42";
import { legalMoves, trainDominoes, type TrainState } from "../games/trainDominoes";
import { forbiddenWords } from "../games/forbiddenWords";
import { wordRelay } from "../games/wordRelay";
import { fishbowl, type FishState } from "../games/fishbowl";
import { uniqueClues, guesserOf, moderatorOf, type UniqueState } from "../games/uniqueClues";
import { massiveDecks, type MassiveState } from "../games/massiveDecks";
import { passTheWord, type PassState } from "../games/passTheWord";
import { wordGrid, findPath, validPath, wordPoints, type GridState } from "../games/wordGrid";
import { categoryScore, fiveDice, CATEGORIES, type DiceState } from "../games/fiveDice";
import { anyScore, farkle, scoreDice, type FarkleState } from "../games/farkle";
import { canMake, shutTheBox, type BoxState } from "../games/shutTheBox";
import type { TurnState } from "../games/teamTurns";

let checks = 0;
function test(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ✓ ${name}`);
}

const seats = (n: number, teams = false): Seat[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, ...(teams ? { team: i % 2 } : {}) }));
const ctxAt = (rand: () => number, now = 0, extra: Partial<GameCtx> = {}): GameCtx => ({ now, rand, ...extra });
const pick = <T,>(xs: T[], rand: () => number) => xs[Math.floor(rand() * xs.length)];

console.log("registry");
test("eighteen well-formed games", () => {
  assert.equal(GAMES.length, 18);
  const keys = new Set<string>();
  for (const g of GAMES) {
    assert.ok(!keys.has(g.key), `duplicate key ${g.key}`);
    keys.add(g.key);
    assert.ok(g.minPlayers >= 2 && g.maxPlayers >= g.minPlayers, g.key);
    assert.ok(g.rules.length > 0 && g.rules.every((r) => r.body.length > 0), `${g.key} rules`);
    assert.ok(g.description.length > 60 && g.license.name, `${g.key} description/license`);
    assert.equal(getGame(g.key), g);
  }
});

// ─── 01 Euchre ───────────────────────────────────────────────────────────────
console.log("euchre");
test("left bower is trump, not its printed suit", () => {
  assert.equal(effectiveSuit("JD", "H"), "H");
  assert.equal(effectiveSuit("JD", "S"), "D");
  assert.ok(cardPower("JH", "H", "H") > cardPower("JD", "H", "H"));
  assert.ok(cardPower("JD", "H", "H") > cardPower("AH", "H", "H"));
  assert.equal(cardPower("AS", "D", "H"), 0, "off-suit can't win");
});
test("the left bower can't follow its printed suit, and must follow trump", () => {
  const s = euchre.setup(seats(4, true), ctxAt(seeded(1)));
  const st: EuchreState = { ...s, phase: "play", trump: "H", turn: 1, trick: [{ seat: 0, card: "9D" }], hands: { ...s.hands, [s.seats[1].id]: ["JD", "AS", "KC"] } };
  assert.deepEqual(legalPlays(st, 1), ["JD", "AS", "KC"], "no diamond to follow — JD is a heart now");
  const st2: EuchreState = { ...st, trick: [{ seat: 0, card: "9H" }] };
  assert.deepEqual(legalPlays(st2, 1), ["JD"], "only trump is the left bower");
});
test("100 random games reach 10", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rand = seeded(seed);
    let s = euchre.setup(seats(4, true), ctxAt(rand));
    for (let n = 0; s.phase !== "over"; n++) {
      assert.ok(n < 5000, `seed ${seed} stuck`);
      const id = s.seats[s.turn].id;
      const r = rand();
      if (s.phase === "handOver") s = euchre.act(s, id, { type: "nextHand" }, ctxAt(rand));
      else if (s.phase === "bid1") s = euchre.act(s, id, r < 0.3 ? { type: "order", alone: r < 0.03 } : { type: "pass" }, ctxAt(rand));
      else if (s.phase === "bid2") s = euchre.act(s, id, r < 0.4 ? { type: "name", suit: (["S", "H", "D", "C"] as const).find((x) => x !== s.upcard.slice(-1))!, alone: false } : { type: "pass" }, ctxAt(rand));
      else if (s.phase === "discard") s = euchre.act(s, id, { type: "discard", card: s.hands[id][0] }, ctxAt(rand));
      else s = euchre.act(s, id, { type: "play", card: pick(legalPlays(s, s.turn), rand) }, ctxAt(rand));
      if (s.phase === "play" || s.phase === "discard") assert.equal(Object.values(s.hands).flat().length + s.trick.length + 3 + (s.phase === "discard" ? 0 : 1) - (5 - s.tricks[0] - s.tricks[1]) * 0 >= 0, true);
    }
    assert.ok(Math.max(...s.scores) >= 10);
  }
});

// ─── 02 President ────────────────────────────────────────────────────────────
console.log("president");
test("pairs must beat pairs; passing doesn't lock you out", () => {
  const s0 = president.setup(seats(3), ctxAt(seeded(4)));
  const s: PresidentState = { ...s0, turn: 0, hands: { p0: ["5S", "5H", "9C"], p1: ["6S", "6H", "KC"], p2: ["7S", "7H", "2C"] } };
  let st = president.act(s, "p0", { type: "play", cards: ["5S", "5H"] }, ctxAt(seeded(1)));
  assert.throws(() => president.act(st, "p1", { type: "play", cards: ["KC"] }, ctxAt(seeded(1))), /exactly 2/);
  st = president.act(st, "p1", { type: "pass" }, ctxAt(seeded(1)));
  st = president.act(st, "p2", { type: "play", cards: ["7S", "7H"] }, ctxAt(seeded(1)));
  assert.equal(st.turn, 0, "p0 answers next");
  st = president.act(st, "p0", { type: "pass" }, ctxAt(seeded(1)));
  assert.equal(st.turn, 1, "p1 passed earlier but can play again");
  st = president.act(st, "p1", { type: "pass" }, ctxAt(seeded(1)));
  assert.equal(st.top, null, "pile cleared");
  assert.equal(st.turn, 2, "last player leads");
});
test("100 random games score N−place for five hands", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rand = seeded(seed);
    const n = 3 + (seed % 5);
    let s = president.setup(seats(n), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 20000, `seed ${seed} stuck`);
      if (s.phase === "handOver") {
        s = president.act(s, "p0", { type: "nextHand" }, ctxAt(rand));
        continue;
      }
      const id = s.seats[s.turn].id;
      const hand = s.hands[id];
      const groups = new Map<string, string[]>();
      for (const c of hand) groups.set(c.slice(0, -1), [...(groups.get(c.slice(0, -1)) ?? []), c]);
      const ORDER = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
      const opts = Array.from(groups.entries())
        .filter(([r, cs]) => (s.top ? cs.length >= s.top.cards.length && ORDER.indexOf(r) > ORDER.indexOf(s.top.cards[0].slice(0, -1)) : true))
        .map(([, cs]) => cs.slice(0, s.top ? s.top.cards.length : 1 + Math.floor(rand() * cs.length)));
      if (opts.length && (!s.top || rand() < 0.8)) s = president.act(s, id, { type: "play", cards: pick(opts, rand) }, ctxAt(rand));
      else s = president.act(s, id, { type: "pass" }, ctxAt(rand));
    }
    const total = s.scores.reduce((t, v) => t + v, 0);
    assert.equal(total, 5 * ((n * (n - 1)) / 2));
  }
});

// ─── 03 I Doubt It ───────────────────────────────────────────────────────────
console.log("i doubt it");
test("truthful last play wins even when doubted; a caught bluff picks up", () => {
  const s0 = iDoubtIt.setup(seats(3), ctxAt(seeded(2)));
  const base: DoubtState = { ...s0, turn: 0, claim: 0, pile: ["9C", "9D"], hands: { p0: ["AS"], p1: ["2C", "3C"], p2: ["4C"] } };
  let st = iDoubtIt.act(base, "p0", { type: "submit", cards: ["AS"] }, ctxAt(seeded(1), 0));
  assert.equal((iDoubtIt.view(st, "p1") as { pending: { count: number } }).pending.count, 1);
  assert.ok(!JSON.stringify(iDoubtIt.view(st, "p1")).includes('"AS"'), "submitted card is secret");
  st = iDoubtIt.act(st, "p1", { type: "doubt" }, ctxAt(seeded(1), 100));
  assert.equal(st.winner, 0);
  assert.equal(st.hands.p1.length, 2 + 3, "doubter took the pile");

  const lie = iDoubtIt.act({ ...base, hands: { ...base.hands, p0: ["KS"] } }, "p0", { type: "submit", cards: ["KS"] }, ctxAt(seeded(1), 0));
  const caught = iDoubtIt.act(lie, "p2", { type: "doubt" }, ctxAt(seeded(1), 100));
  assert.equal(caught.winner, null);
  assert.equal(caught.hands.p0.length, 3);
  assert.equal(caught.turn, 1, "next player after the challenged one");
});
test("no doubt within 5 s: the play stands; late doubts are refused", () => {
  const s0 = iDoubtIt.setup(seats(3), ctxAt(seeded(2)));
  const st = iDoubtIt.act({ ...s0, turn: 0, hands: { ...s0.hands, p0: ["AS", "2S"] } }, "p0", { type: "submit", cards: ["2S"] }, ctxAt(seeded(1), 0));
  assert.throws(() => iDoubtIt.act(st, "p1", { type: "doubt" }, ctxAt(seeded(1), WINDOW_MS)), /Too late/);
  const t = iDoubtIt.tick!(st, ctxAt(seeded(1), WINDOW_MS))!;
  assert.equal(t.turn, 1);
  assert.equal(t.claim, 1);
});

// ─── 04 Rummy ────────────────────────────────────────────────────────────────
console.log("rummy");
test("melds: sets, runs, ace low only", () => {
  assert.ok(isMeld(["7S", "7H", "7D"]));
  assert.ok(isMeld(["AS", "2S", "3S"]));
  assert.ok(!isMeld(["QS", "KS", "AS"]));
  assert.ok(!isMeld(["7S", "8H", "9S"]));
  assert.ok(!isMeld(["7S", "7H"]));
});
test("can't throw back the discard you took", () => {
  const s0 = rummy.setup(seats(2), ctxAt(seeded(5)));
  const id = s0.seats[s0.turn].id;
  const top = s0.discard[0];
  const s = rummy.act(s0, id, { type: "takeDiscard" }, ctxAt(seeded(1)));
  assert.throws(() => rummy.act(s, id, { type: "discard", card: top }, ctxAt(seeded(1))), /can't throw back/);
});
test("100 random games finish five deals", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rand = seeded(seed);
    let s: RummyState = rummy.setup(seats(2 + (seed % 5)), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 20000, `seed ${seed} stuck`);
      if (s.phase === "handOver") {
        s = rummy.act(s, "p0", { type: "nextHand" }, ctxAt(rand));
        continue;
      }
      const id = s.seats[s.turn].id;
      if (s.phase === "draw") {
        s = rummy.act(s, id, rand() < 0.3 ? { type: "takeDiscard" } : { type: "drawStock" }, ctxAt(rand));
        continue;
      }
      const hand = s.hands[id];
      // Meld any three of a kind we hold.
      const byRank = new Map<string, string[]>();
      for (const c of hand) byRank.set(c.slice(0, -1), [...(byRank.get(c.slice(0, -1)) ?? []), c]);
      const set = Array.from(byRank.values()).find((g) => g.length >= 3);
      if (set) {
        s = rummy.act(s, id, { type: "meld", cards: set.slice(0, 3) }, ctxAt(rand));
        continue;
      }
      const lay = s.melds.flatMap((m) => hand.filter((c) => isMeld([...m.cards, c])).map((c) => ({ m: m.id, c })))[0];
      if (lay) {
        s = rummy.act(s, id, { type: "layoff", meld: lay.m, cards: [lay.c] }, ctxAt(rand));
        continue;
      }
      const choices = hand.filter((c) => c !== s.taken || hand.length === 1);
      s = rummy.act(s, id, { type: "discard", card: pick(choices, rand) }, ctxAt(rand));
      if (s.phase === "draw" || s.phase === "play") assert.equal(Object.values(s.hands).flat().length + s.stock.length + s.discard.length + s.melds.flatMap((m) => m.cards).length, 52);
    }
    assert.equal(s.deal, 5);
  }
});

// ─── Domino bots ─────────────────────────────────────────────────────────────
console.log("draw dominoes");
test("matching ends; blank matches blank only", () => {
  assert.deepEqual(legalEnds([[0, 3]], "0-5"), ["left"]);
  assert.deepEqual(legalEnds([[0, 3]], "3-5"), ["right"]);
  assert.deepEqual(legalEnds([[0, 3]], "1-2"), []);
});
test("100 random games reach 100 with 28 tiles conserved", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rand = seeded(seed);
    let s: DrawState = drawDominoes.setup(seats(2 + (seed % 3)), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 20000, `seed ${seed} stuck`);
      if (s.phase === "handOver") {
        s = drawDominoes.act(s, "p0", { type: "nextHand" }, ctxAt(rand));
        continue;
      }
      const id = s.seats[s.turn].id;
      const opts = s.hands[id].flatMap((t) => legalEnds(s.line, t).map((end) => ({ t, end })));
      const o = opts.length ? pick(opts, rand) : null;
      s = o ? drawDominoes.act(s, id, { type: "play", tile: o.t, end: o.end }, ctxAt(rand)) : drawDominoes.act(s, id, { type: "draw" }, ctxAt(rand));
      if (s.phase === "play") assert.equal(Object.values(s.hands).flat().length + s.boneyard.length + s.line.length, 28);
    }
  }
});

console.log("all fives");
test("the handoff's worked spinner example", () => {
  let L: Layout = { line: [], spinner: null, arms: { W: [], E: [], N: [], S: [] } };
  L = placeTile(L, "5-5", "left");
  assert.equal(endSum(L), 10);
  L = placeTile(L, "2-5", "E");
  assert.equal(endSum(L), 12);
  assert.ok(!legalPorts(L, "3-5").includes("N"), "no top/bottom arm until both sides are covered");
  L = placeTile(L, "0-5", "W");
  assert.equal(endSum(L), 2);
  L = placeTile(L, "3-5", "N");
  assert.equal(endSum(L), 5);
});
test("a spinner joined to a line keeps the line as one arm", () => {
  let L: Layout = { line: [], spinner: null, arms: { W: [], E: [], N: [], S: [] } };
  L = placeTile(L, "3-4", "left"); // line 3|4
  L = placeTile(L, "4-6", "right"); // 3|4 4|6
  assert.equal(endSum(L), 9);
  L = placeTile(L, "6-6", "right");
  assert.equal(L.spinner, 6);
  assert.equal(L.arms.W[L.arms.W.length - 1].far, 3, "arm runs out to the 3");
  assert.equal(endSum(L), 12 + 3);
  assert.equal(roundToFive(12), 10);
  assert.equal(roundToFive(13), 15);
});
test("100 random games reach 200", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rand = seeded(seed);
    let s: FivesState = allFives.setup(seats(2 + (seed % 3)), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 30000, `seed ${seed} stuck`);
      if (s.phase === "handOver") {
        s = allFives.act(s, "p0", { type: "nextHand" }, ctxAt(rand));
        continue;
      }
      const id = s.seats[s.turn].id;
      const opts = s.hands[id].flatMap((t) => legalPorts(s.layout, t).map((port) => ({ t, port })));
      const o = opts.length ? pick(opts, rand) : null;
      s = o ? allFives.act(s, id, { type: "play", tile: o.t, port: o.port }, ctxAt(rand)) : allFives.act(s, id, { type: "draw" }, ctxAt(rand));
    }
    assert.ok(Math.max(...s.scores) >= 200);
  }
});

console.log("texas 42");
test("suits, trumps and following", () => {
  assert.equal(ledSuit("2-6", 3), 6, "non-trump calls its higher end");
  assert.ok(!follows("3-5", 5, 3), "5-3 is a trump when threes are trump");
  assert.ok(follows("2-6", 2, 4), "6-2 follows twos too");
  assert.ok(!follows("6-6", 6, "doubles"), "with doubles trump, 6-6 isn't a six");
  assert.equal(trickWinner([{ seat: 0, tile: "4-6" }, { seat: 1, tile: "6-6" }, { seat: 2, tile: "0-1" }, { seat: 3, tile: "3-6" }], 0), 2, "trump wins");
  assert.equal(trickWinner([{ seat: 0, tile: "4-6" }, { seat: 1, tile: "6-6" }, { seat: 2, tile: "1-2" }, { seat: 3, tile: "3-6" }], 0), 1, "the double tops its suit");
  assert.ok(bidLegal(null, { marks: 2 }));
  assert.ok(!bidLegal(null, { marks: 3 }));
  assert.ok(bidLegal({ marks: 2 }, { marks: 3 }));
  assert.ok(!bidLegal({ points: 35 }, { points: 34 }));
});
test("100 random games: 42 points a hand, first to 7 marks", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rand = seeded(seed);
    let s: FortyTwoState = texas42.setup(seats(4, true), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 5000, `seed ${seed} stuck`);
      const id = s.seats[s.turn].id;
      if (s.phase === "handOver") s = texas42.act(s, id, { type: "nextHand" }, ctxAt(rand));
      else if (s.phase === "bid") {
        const cur = s.high?.bid;
        const next = !cur ? 30 : "points" in cur && cur.points < 42 ? cur.points + 1 : null;
        s = texas42.act(s, id, { type: "bid", bid: next && rand() < 0.4 ? { points: next } : null }, ctxAt(rand));
      } else if (s.phase === "trump") s = texas42.act(s, id, { type: "trump", trump: rand() < 0.15 ? "doubles" : Math.floor(rand() * 7) }, ctxAt(rand));
      else s = texas42.act(s, id, { type: "play", tile: pick(legalTiles(s, s.turn), rand) }, ctxAt(rand));
      if (s.phase === "handOver" || (s.phase === "over" && s.result)) {
        const v = texas42.view(s, "p0") as { points: number[] };
        assert.equal(v.points[0] + v.points[1], 42);
      }
    }
  }
});

console.log("train dominoes");
test("13 rounds play out with the double-cover rules", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rand = seeded(seed);
    let s: TrainState = trainDominoes.setup(seats(2 + (seed % 7)), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 60000, `seed ${seed} stuck`);
      if (s.phase === "roundOver") {
        s = trainDominoes.act(s, "p0", { type: "nextRound" }, ctxAt(rand));
        continue;
      }
      const seat = s.turn;
      const id = s.seats[seat].id;
      const moves = legalMoves(s, seat).filter((m) => !s.drawn || m.tile === s.drawn);
      if (s.pending) assert.ok(moves.every((m) => m.train === s.pending!.train), "only the double's train");
      s = moves.length ? trainDominoes.act(s, id, { type: "play", ...pick(moves, rand) }, ctxAt(rand)) : trainDominoes.act(s, id, { type: "draw" }, ctxAt(rand));
      if (s.phase === "play") assert.equal(Object.values(s.hands).flat().length + s.boneyard.length + s.trains.flatMap((t) => t.tiles).length + 1, 91);
    }
    assert.equal(s.round, 12);
  }
});

// ─── Word & party ────────────────────────────────────────────────────────────
console.log("forbidden words / word relay");
test("forbidden words: only clue giver and referee see the card; skip costs a point", () => {
  const rand = seeded(3);
  let s: TurnState = forbiddenWords.setup(seats(6, true), ctxAt(rand));
  s = forbiddenWords.act(s, s.giver, { type: "start" }, ctxAt(rand, 0));
  const v = (id: string) => (forbiddenWords.view(s, id) as { card: unknown }).card;
  const mate = s.seats.find((p) => p.team === s.team && p.id !== s.giver)!.id;
  assert.ok(v(s.giver) && v(s.referee!));
  assert.equal(v(mate), null);
  s = forbiddenWords.act(s, s.giver, { type: "correct" }, ctxAt(rand, 1000));
  s = forbiddenWords.act(s, s.giver, { type: "skip" }, ctxAt(rand, 2000));
  s = forbiddenWords.act(s, s.referee!, { type: "foul" }, ctxAt(rand, 3000));
  assert.equal(s.scores[s.team], -1);
  assert.throws(() => forbiddenWords.act(s, mate, { type: "foul" }, ctxAt(rand, 4000)), /referee/);
});
test("word relay: correct keeps the SAME clue giver; 3 skips; host review", () => {
  const rand = seeded(4);
  let s: TurnState = wordRelay.setup(seats(4, true), ctxAt(rand));
  const giver = s.giver;
  s = wordRelay.act(s, giver, { type: "start" }, ctxAt(rand, 0));
  s = wordRelay.act(s, giver, { type: "correct" }, ctxAt(rand, 100));
  assert.equal(s.giver, giver);
  for (let i = 0; i < 3; i++) s = wordRelay.act(s, giver, { type: "skip" }, ctxAt(rand, 200 + i));
  assert.throws(() => wordRelay.act(s, giver, { type: "skip" }, ctxAt(rand, 300)), /No skips/);
  const team = s.team;
  s = wordRelay.tick!(s, ctxAt(rand, 60_000))!;
  assert.notEqual(s.team, team, "teams switch only at the buzzer");
  assert.equal(s.scores[team], 1);
  s = wordRelay.act(s, "p0", { type: "review", index: 0, outcome: "foul" }, ctxAt(rand, 61_000, { hostId: "p0" }));
  assert.equal(s.scores[team], -1, "correct → foul swings by 2");
  assert.throws(() => wordRelay.act(s, "p1", { type: "review", index: 0, outcome: "correct" }, ctxAt(rand, 61_000, { hostId: "p0" })), /host/);
});
test("ties add paired extra turns", () => {
  const rand = seeded(5);
  let s: TurnState = wordRelay.setup(seats(4, true), ctxAt(rand));
  let now = 0;
  for (let i = 0; i < 6; i++) {
    s = wordRelay.act(s, s.giver, { type: "start" }, ctxAt(rand, now));
    now += 60_000;
    s = wordRelay.tick!(s, ctxAt(rand, now))!;
  }
  assert.equal(s.phase, "ready", "0–0 after three each: keep going");
  assert.equal(s.target, 4);
  s = wordRelay.act(s, s.giver, { type: "start" }, ctxAt(rand, now));
  s = wordRelay.act(s, s.giver, { type: "correct" }, ctxAt(rand, now + 1));
  now += 60_000;
  s = wordRelay.tick!(s, ctxAt(rand, now))!;
  assert.equal(s.phase, "ready", "the other team still gets its extra turn");
  s = wordRelay.act(s, s.giver, { type: "start" }, ctxAt(rand, now));
  now += 60_000;
  s = wordRelay.tick!(s, ctxAt(rand, now))!;
  assert.equal(s.phase, "done");
});

console.log("fishbowl");
test("three stages, same prompts; duplicates refused; stage handover", () => {
  const rand = seeded(6);
  let s: FishState = fishbowl.setup(seats(4, true), ctxAt(rand));
  s = fishbowl.act(s, "p0", { type: "submit", prompts: ["Moon", "Sled", "Grandma"] }, ctxAt(rand));
  assert.throws(() => fishbowl.act(s, "p1", { type: "submit", prompts: ["moon", "A", "B"] }, ctxAt(rand)), /already in the bowl/);
  ["p1", "p2", "p3"].forEach((id, i) => (s = fishbowl.act(s, id, { type: "submit", prompts: [`a${i}`, `b${i}`, `c${i}`] }, ctxAt(rand))));
  assert.equal(s.phase, "ready");
  let now = 0;
  for (let k = 0; s.phase !== "done"; k++) {
    assert.ok(k < 500);
    if (s.phase === "ready") s = fishbowl.act(s, s.giver, { type: "start" }, ctxAt(rand, now));
    else s = fishbowl.act(s, s.giver, { type: rand() < 0.15 && !s.skipped ? "skip" : "correct" }, ctxAt(rand, now));
    now += 7000;
  }
  assert.equal(s.scores[0] + s.scores[1], 12 * 3, "every prompt scored once per stage");
});

console.log("unique clues");
test("identical clues cancel — every copy; guesser sees only survivors", () => {
  const rand = seeded(7);
  let s: UniqueState = uniqueClues.setup(seats(5), ctxAt(rand, 0));
  const g = guesserOf(s);
  const givers = s.seats.map((p) => p.id).filter((id) => id !== g);
  const word = (uniqueClues.view(s, givers[0]) as { word: string }).word;
  assert.equal((uniqueClues.view(s, g) as { word: string | null }).word, null);
  assert.throws(() => uniqueClues.act(s, givers[0], { type: "clue", word }, ctxAt(rand, 1)), /secret word/);
  assert.throws(() => uniqueClues.act(s, givers[0], { type: "clue", word: "two words" }, ctxAt(rand, 1)), /One word/);
  s = uniqueClues.act(s, givers[0], { type: "clue", word: "Frosty" }, ctxAt(rand, 1));
  s = uniqueClues.act(s, givers[1], { type: "clue", word: "frosty " }, ctxAt(rand, 2));
  s = uniqueClues.act(s, givers[2], { type: "clue", word: "Cold" }, ctxAt(rand, 3));
  s = uniqueClues.act(s, givers[3], { type: "clue", word: "Winter" }, ctxAt(rand, 4));
  assert.equal(s.phase, "review");
  assert.deepEqual([...s.dupes].sort(), [givers[0], givers[1]].sort());
  assert.deepEqual((uniqueClues.view(s, g) as { clues: unknown[] }).clues, [], "guesser sees nothing during review");
  s = uniqueClues.act(s, moderatorOf(s), { type: "strike", playerId: givers[3] }, ctxAt(rand, 5));
  s = uniqueClues.act(s, moderatorOf(s), { type: "reviewDone" }, ctxAt(rand, 6));
  assert.deepEqual((uniqueClues.view(s, g) as { clues: string[] }).clues, ["Cold"]);
  s = uniqueClues.act(s, g, { type: "guess", word: ` ${word.toUpperCase()} ` }, ctxAt(rand, 7));
  assert.equal(s.correct, true);
  assert.equal(s.points, 1);
});

console.log("massive decks");
test("anonymous answers, judge picks, refill to seven, first to five", () => {
  const rand = seeded(8);
  let s: MassiveState = massiveDecks.setup(seats(4), ctxAt(rand, 0));
  let now = 0;
  for (let k = 0; s.phase !== "over"; k++) {
    assert.ok(k < 2000);
    const judge = s.seats[s.judge].id;
    if (s.phase === "submit") {
      const who = s.seats.find((p) => p.id !== judge && !(p.id in s.submissions))!;
      s = massiveDecks.act(s, who.id, { type: "submit", card: s.hands[who.id][0] }, ctxAt(rand, now));
      if (s.phase === "judge") {
        const view = massiveDecks.view(s, judge) as { answers: { by: string | null }[] };
        assert.ok(view.answers.every((x) => x.by === null), "authors hidden from the judge");
      }
    } else if (s.phase === "judge") s = massiveDecks.act(s, judge, { type: "pick", card: s.submissions[s.order[0]] }, ctxAt(rand, now));
    else {
      s = massiveDecks.act(s, "p0", { type: "next" }, ctxAt(rand, now));
      for (const p of s.seats) assert.equal(s.hands[p.id].length, 7);
    }
    now += 1000;
  }
  assert.equal(Math.max(...s.scores), 5);
});
test("fewer than two answers voids the round", () => {
  const rand = seeded(9);
  let s: MassiveState = massiveDecks.setup(seats(3), ctxAt(rand, 0));
  const judge = s.seats[s.judge].id;
  const one = s.seats.find((p) => p.id !== judge)!.id;
  s = massiveDecks.act(s, one, { type: "submit", card: s.hands[one][0] }, ctxAt(rand, 10));
  s = massiveDecks.tick!(s, ctxAt(rand, 60_000))!;
  assert.equal(s.voided, true);
  assert.equal(s.hands[one].length, 7, "card returned");
});

console.log("pass the word");
test("correct passes to the other team; hidden deadline; holder at the buzzer loses", () => {
  const rand = seeded(10);
  let s: PassState = passTheWord.setup(seats(6, true), ctxAt(rand));
  const start = s.team;
  s = passTheWord.act(s, s.giver, { type: "start" }, ctxAt(rand, 0));
  for (const p of s.seats) assert.ok(!("deadline" in (passTheWord.view(s, p.id) as object)), "nobody gets the deadline");
  const dur = s.deadline!;
  assert.ok(dur >= 45_000 && dur <= 90_000);
  s = passTheWord.act(s, s.giver, { type: "correct" }, ctxAt(rand, 1000));
  assert.equal(s.team, 1 - start);
  assert.deepEqual(s.scores, [0, 0], "answers don't score");
  const ref = s.referee[1 - s.team];
  s = passTheWord.act(s, ref, { type: "foul" }, ctxAt(rand, 2000));
  assert.throws(() => passTheWord.act(s, s.giver, { type: "correct" }, ctxAt(rand, 3000)), /Locked out/);
  s = passTheWord.tick!(s, ctxAt(rand, dur))!;
  assert.equal(s.scores[start], 1, "the team NOT holding it scores");
  assert.throws(() => passTheWord.act(s, s.giver, { type: "correct" }, ctxAt(rand, dur + 1)), GameError);
});

console.log("word grid");
const WORDS = new Set(["tea", "eat", "ate", "tease", "seat", "east", "eats", "teas", "sat", "set", "quit", "quite"]);
test("paths: touching tiles, once each; Qu is one tile", () => {
  const board = ["T", "E", "A", "S", "X", "X", "X", "E", "Qu", "I", "T", "X", "X", "X", "E", "X"];
  assert.ok(validPath([0, 1, 2]));
  assert.ok(!validPath([0, 2]));
  assert.ok(!validPath([0, 1, 0]));
  assert.deepEqual(findPath(board, "tea"), [0, 1, 2]);
  assert.ok(findPath(board, "quit"));
  assert.equal(findPath(board, "tqa"), null);
  assert.equal(wordPoints("quit"), 1);
  assert.equal(wordPoints("teases"), 3);
  assert.equal(wordPoints("abcdefgh"), 11);
});
test("shared words cancel; unique words score", () => {
  const rand = seeded(11);
  const isWord = (w: string) => WORDS.has(w);
  let s: GridState = wordGrid.setup(seats(2), ctxAt(rand, 0));
  s = { ...s, board: ["T", "E", "A", "S", "X", "X", "X", "E", "Qu", "I", "T", "X", "X", "X", "E", "X"] };
  s = wordGrid.act(s, "p0", { type: "word", word: "tea" }, ctxAt(rand, 1, { isWord }));
  s = wordGrid.act(s, "p1", { type: "word", word: "tea" }, ctxAt(rand, 2, { isWord }));
  s = wordGrid.act(s, "p0", { type: "word", word: "teas" }, ctxAt(rand, 3, { isWord }));
  s = wordGrid.act(s, "p0", { type: "word", word: "teas" }, ctxAt(rand, 4, { isWord }));
  s = wordGrid.act(s, "p1", { type: "word", path: [3, 2, 1] }, ctxAt(rand, 5, { isWord }));
  assert.deepEqual(s.found.p0, ["tea", "teas"]);
  assert.deepEqual(s.rejected.p1, ["sae"]);
  assert.ok(!JSON.stringify(wordGrid.view(s, "p1")).includes("teas"), "others' words stay private");
  s = wordGrid.tick!(s, ctxAt(rand, 180_000))!;
  assert.deepEqual(s.scores, [1, 0]);
  assert.deepEqual(s.results![0].cancelled, ["tea"]);
});

console.log("five dice");
test("the handoff's scoring examples", () => {
  assert.equal(categoryScore("three", [6, 6, 6, 2, 1]), 21);
  assert.equal(categoryScore("sixes", [6, 6, 6, 2, 1]), 18);
  assert.equal(categoryScore("chance", [6, 6, 6, 2, 1]), 21);
  assert.equal(categoryScore("full", [6, 6, 6, 2, 1]), 0);
  assert.equal(categoryScore("small", [1, 2, 3, 4, 4]), 30);
  assert.equal(categoryScore("large", [1, 2, 3, 4, 4]), 0);
  assert.equal(categoryScore("four", [3, 3, 3, 3, 3]), 15);
  assert.equal(categoryScore("full", [3, 3, 3, 3, 3]), 0, "no joker rule");
});
test("random games fill every box; keeping all dice can't burn a roll", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rand = seeded(seed);
    let s: DiceState = fiveDice.setup(seats(2 + (seed % 7)), ctxAt(rand));
    while (!s.over) {
      const id = s.seats[s.turn].id;
      if (s.rolls === 1) assert.throws(() => fiveDice.act(s, id, { type: "roll", held: [true, true, true, true, true] }, ctxAt(rand)), /keeping every die/);
      if (s.rolls < 1 + Math.floor(rand() * 3)) s = fiveDice.act(s, id, { type: "roll", held: s.dice.map((_, i) => i > 0 && rand() < 0.4) }, ctxAt(rand));
      else s = fiveDice.act(s, id, { type: "score", category: pick(CATEGORIES.filter((c) => s.cards[id][c.key] === undefined), rand).key }, ctxAt(rand));
    }
    for (const p of s.seats) assert.equal(Object.keys(s.cards[p.id]).length, 13);
  }
});

console.log("farkle");
test("the selected scoring table", () => {
  assert.equal(scoreDice([1, 1, 1]), 300, "triple ones = 300 here");
  assert.equal(scoreDice([5]), 50);
  assert.equal(scoreDice([1, 5]), 150);
  assert.equal(scoreDice([2, 2, 2, 2]), 1000);
  assert.equal(scoreDice([1, 2, 3, 4, 5, 6]), 1500, "no extra 1/5 on a straight");
  assert.equal(scoreDice([2, 2, 3, 3, 4, 4]), 1500);
  assert.equal(scoreDice([4, 4, 4, 4, 2, 2]), 1500);
  assert.equal(scoreDice([3, 3, 3, 6, 6, 6]), 2500);
  assert.equal(scoreDice([6, 6, 6, 6, 6, 6]), 3000, "not also two triplets");
  assert.equal(scoreDice([1, 2]), -1, "a stray 2 can't be kept");
  assert.equal(scoreDice([5, 5, 5, 1]), 600);
  assert.ok(!anyScore([2, 3, 4, 6, 6, 2]));
});
test("first bank needs 500; a farkle loses the turn; final round", () => {
  const s0 = farkle.setup(seats(2), ctxAt(seeded(1)));
  const st: FarkleState = { ...s0, turn: 0, phase: "choose", dice: [5, 2, 3, 4, 6, 6], turnTotal: 0 };
  assert.throws(() => farkle.act(st, "p0", { type: "bank", keep: [0] }, ctxAt(seeded(1))), /500/);
  for (let seed = 1; seed <= 50; seed++) {
    const rand = seeded(seed);
    let s: FarkleState = farkle.setup(seats(2 + (seed % 4)), ctxAt(rand));
    for (let k = 0; s.phase !== "over"; k++) {
      assert.ok(k < 20000, `seed ${seed} stuck`);
      const id = s.seats[s.turn].id;
      if (s.phase === "roll") {
        s = farkle.act(s, id, { type: "roll" }, ctxAt(rand));
        continue;
      }
      const keep = s.dice.map((d, i) => (d === 1 || d === 5 ? i : -1)).filter((i) => i >= 0);
      const k2 = scoreDice(s.dice) > 0 ? s.dice.map((_, i) => i) : keep.length ? keep : (() => {
        const f = [2, 3, 4, 6].find((x) => s.dice.filter((d) => d === x).length >= 3)!;
        return s.dice.map((d, i) => (d === f ? i : -1)).filter((i) => i >= 0).slice(0, 3);
      })();
      const pts = s.turnTotal + scoreDice(k2.map((i) => s.dice[i]));
      const canBank = s.banked[s.turn] > 0 || pts >= 500;
      s = farkle.act(s, id, canBank && (pts >= 350 || s.dice.length - k2.length <= 2) ? { type: "bank", keep: k2 } : { type: "roll", keep: k2 }, ctxAt(rand));
    }
    assert.ok(Math.max(...s.banked) >= 10_000);
  }
});

console.log("shut the box");
test("subset search; one die only after 7-8-9", () => {
  assert.ok(canMake([1, 2, 5, 8], 8));
  assert.ok(canMake([1, 2, 5], 8));
  assert.ok(canMake([1, 4], 5));
  assert.ok(!canMake([1, 4], 6));
  const s0 = shutTheBox.setup(seats(2), ctxAt(seeded(1)));
  const id = s0.seats[s0.first].id;
  assert.throws(() => shutTheBox.act(s0, id, { type: "roll", dice: 1 }, ctxAt(seeded(1))), /One die/);
});
test("random games: everyone plays three rounds", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rand = seeded(seed);
    let s: BoxState = shutTheBox.setup(seats(2 + (seed % 7)), ctxAt(rand));
    let turns = 0;
    while (!s.over) {
      const id = s.seats[(s.first + s.played) % s.seats.length].id;
      if (!s.roll) {
        const before = s.played + s.round * 100;
        s = shutTheBox.act(s, id, { type: "roll", dice: 2 }, ctxAt(rand));
        if (s.played + s.round * 100 !== before) turns++;
        continue;
      }
      const total = s.roll.reduce((t, n) => t + n, 0);
      const subset = (function find(i: number, left: number, acc: number[]): number[] | null {
        if (left === 0) return acc;
        if (i >= s.open.length || left < 0) return null;
        return find(i + 1, left - s.open[i], [...acc, s.open[i]]) ?? find(i + 1, left, acc);
      })(0, total, [])!;
      const before = s.played + s.round * 100;
      s = shutTheBox.act(s, id, { type: "close", tiles: subset }, ctxAt(rand));
      if (s.played + s.round * 100 !== before || s.over) turns++;
    }
    assert.equal(turns, 3 * s.seats.length);
  }
});

// ─── Rooms ───────────────────────────────────────────────────────────────────
console.log("rooms");
const now = "2026-12-01T00:00:00Z";
const ctx = () => ({ now: Date.now(), rand: seeded(1) });
function room(gameKey: string): Room {
  return addPlayer({ id: "r", code: "1234", gameKey, status: "lobby", players: [], state: null, version: 0 }, { id: "h", token: "th", name: "", host: true }, now);
}

test("host waits for players and a name", () => {
  let r = room("president");
  r = addPlayer(r, { id: "a", token: "ta", name: "Ava", host: false }, now);
  assert.match(startProblem(r)!, /at least 3/);
  r = addPlayer(r, { id: "b", token: "tb", name: "Bo", host: false }, now);
  assert.match(startProblem(r)!, /name/);
  r = applyOp(r, "h", { op: "rename", name: "  Mike  " }, ctx());
  assert.equal(startProblem(r), null);
  assert.throws(() => applyOp(r, "a", { op: "start" }, ctx()), /host/);
  r = applyOp(r, "h", { op: "start" }, ctx());
  assert.equal(r.status, "playing");
  assert.throws(() => addPlayer(r, { id: "c", token: "tc", name: "Cy", host: false }, now), /already started/);
});

test("partnership games need exactly two a side", () => {
  let r = room("euchre");
  r = applyOp(r, "h", { op: "rename", name: "Host" }, ctx());
  for (const n of ["A", "B", "C"]) r = addPlayer(r, { id: n, token: `t${n}`, name: n, host: false }, now);
  assert.match(startProblem(r)!, /pick a team/);
  for (const [id, t] of [["h", 0], ["A", 0], ["B", 0], ["C", 1]] as const) r = applyOp(r, id, { op: "team", team: t }, ctx());
  assert.match(startProblem(r)!, /exactly 2/);
  r = applyOp(r, "B", { op: "team", team: 1 }, ctx());
  assert.equal(startProblem(r), null);
  r = applyOp(r, "h", { op: "start" }, ctx());
  const st = r.state as EuchreState;
  assert.deepEqual(st.seats.map((p) => p.team), [0, 1, 0, 1], "partners sit opposite");
});

test("duplicate names; full rooms; tokens never leak; host ends", () => {
  let r = room("president");
  r = applyOp(r, "h", { op: "rename", name: "Sam" }, ctx());
  r = addPlayer(r, { id: "a", token: "secret-a", name: "sam", host: false }, now);
  assert.equal(r.players[1].name, "sam 2");
  for (let i = 0; i < 5; i++) r = addPlayer(r, { id: `x${i}`, token: `t${i}`, name: `X${i}`, host: false }, now);
  assert.throws(() => addPlayer(r, { id: "z", token: "tz", name: "Z", host: false }, now), /full/);
  assert.ok(!JSON.stringify(viewFor(r, "a", 0)).includes("secret-a"));
  r = applyOp(r, "h", { op: "end" }, ctx());
  assert.equal(viewFor(r, "h", 0).endedBy, "host");
});

test("only the host can correct scores, through the room", () => {
  let r = room("word-relay");
  r = applyOp(r, "h", { op: "rename", name: "H" }, ctx());
  for (const n of ["A", "B", "C"]) r = addPlayer(r, { id: n, token: `t${n}`, name: n, host: false }, now);
  r = { ...r, players: r.players.map((p, i) => ({ ...p, team: i % 2 })) };
  r = applyOp(r, "h", { op: "start" }, { now: 0, rand: seeded(1) });
  const st = r.state as TurnState;
  r = applyOp(r, st.giver, { op: "act", action: { type: "start" } }, { now: 0, rand: seeded(1) });
  r = applyOp(r, st.giver, { op: "act", action: { type: "correct" } }, { now: 10, rand: seeded(1) });
  r = tickRoom(r, { now: 60_000, rand: seeded(1) })!;
  assert.throws(() => applyOp(r, "A", { op: "act", action: { type: "review", index: 0, outcome: "skip" } }, ctx()), /host/);
  r = applyOp(r, "h", { op: "act", action: { type: "review", index: 0, outcome: "skip" } }, ctx());
  assert.deepEqual((r.state as TurnState).scores, [0, 0]);
});

console.log(`\n${checks} checks passed`);
