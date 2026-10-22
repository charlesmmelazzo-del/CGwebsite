// npm run test:holidays — the bar-wide "Play with strangers" games and the name filter.

import assert from "node:assert/strict";
import { seeded } from "../cards";
import { isOffensiveName } from "../nameFilter";
import { dayKey, initState, pubAct, pubJoin, pubLeave, pubTick, pubTouch, pubView, STALE_MS, type PubState } from "../public/engine";
import { BREAK_MS, ROUND_MS, wordGridPublic, type WGRound } from "../public/wordGridPublic";
import { massivePublic, MIN_PLAYERS, RESULT_MS, type MDRound } from "../public/massivePublic";
import type { GameCtx } from "../types";

let checks = 0;
function test(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ✓ ${name}`);
}

const rand = seeded(7);
const isWord = (w: string) => ["tea", "eat", "ate", "teas", "seat", "east", "sat", "set"].includes(w);
// 2026-12-05 20:00 Chicago (02:00 UTC next day).
const T0 = Date.UTC(2026, 11, 6, 2, 0, 0);
const at = (now: number): GameCtx => ({ now, rand, isWord });
let n = 0;
const join = <G,>(def: Parameters<typeof pubJoin>[0], s: PubState<G>, name: string, now: number, token: string | null = null) =>
  pubJoin(def, s, { token, newId: `id${++n}`, newToken: `tok${n}`, name }, at(now)) as { state: PubState<G>; player: { id: string; token: string; status: string } };
/** Keep players "here" by polling. */
const touchAll = <G,>(s: PubState<G>, now: number): PubState<G> => s.players.reduce((st, p) => pubTouch(st, p.id, now) ?? st, s);

console.log("name filter");
test("blocks slurs, swearing and graphic words, including disguised spellings", () => {
  for (const bad of ["fuck", "F.U.C.K", "fuuuuck", "sh1t", "Big Ass", "@ss", "b1tch", "Mr Dickhead", "p0rn", "n1gga", "KKK", "sexy beast", "Dumbass"]) assert.ok(isOffensiveName(bad), bad);
});
test("doesn't block innocent names that contain those letters", () => {
  for (const ok of ["Mike", "Cassidy", "Cocktail Queen", "Hitchcock", "Dickens", "Nigel", "Sussex", "Therapist", "Analise", "Raccoon", "Nazir", "Fukuda", "David Lynch", "Basement Bob", "Night Owl", "Scunthorpe"]) assert.ok(!isOffensiveName(ok), ok);
});
test("offensive names are refused when joining", () => {
  const s = initState(wordGridPublic, at(T0)) as PubState<WGRound>;
  assert.throws(() => join(wordGridPublic, s, "sh!thead", T0), /different name/);
});

console.log("day boundary");
test("the bar's day runs 4 a.m. to 4 a.m. Chicago time", () => {
  assert.equal(dayKey(T0), "2026-12-05");
  assert.equal(dayKey(Date.UTC(2026, 11, 6, 9, 59)), "2026-12-05", "3:59 a.m. still counts as the night before");
  assert.equal(dayKey(Date.UTC(2026, 11, 6, 10, 0)), "2026-12-06");
});

console.log("word grid (bar-wide)");
test("solo: the first player starts a round straight away", () => {
  const s = initState(wordGridPublic, at(T0)) as PubState<WGRound>;
  const { state, player } = join(wordGridPublic, s, "Ava", T0);
  assert.equal(state.game.phase, "live");
  assert.equal(player.status, "active");
});
test("join mid-round: wait for the next one; round points add up; shared words cancel", () => {
  let s = initState(wordGridPublic, at(T0)) as PubState<WGRound>;
  const a = join(wordGridPublic, s, "Ava", T0);
  s = a.state;
  s = { ...s, game: { ...s.game, board: ["T", "E", "A", "S", "X", "X", "X", "E", "Qu", "I", "T", "X", "X", "X", "E", "X"] } };
  const b = join(wordGridPublic, s, "Bo", T0 + 1000);
  s = b.state;
  assert.equal(b.player.status, "queued");
  assert.throws(() => pubAct(wordGridPublic, s, b.player.id, { type: "word", word: "tea" }, at(T0 + 2000)), /next round/);
  s = pubAct(wordGridPublic, s, a.player.id, { type: "word", word: "teas" }, at(T0 + 3000));
  s = touchAll(s, T0 + 60_000);
  s = pubTick(wordGridPublic, s, at(T0 + ROUND_MS))!;
  assert.equal(s.game.phase, "results");
  assert.equal(s.players.find((p) => p.id === a.player.id)!.score, 1);
  s = touchAll(s, T0 + ROUND_MS + 1000);
  s = pubTick(wordGridPublic, s, at(T0 + ROUND_MS + BREAK_MS))!;
  assert.equal(s.game.phase, "live");
  assert.ok(s.game.participants.includes(b.player.id), "Bo is in now");
  const t1 = T0 + ROUND_MS + BREAK_MS;
  s = { ...s, game: { ...s.game, board: ["T", "E", "A", "S", "X", "X", "X", "E", "Qu", "I", "T", "X", "X", "X", "E", "X"] } };
  s = pubAct(wordGridPublic, s, a.player.id, { type: "word", word: "tea" }, at(t1 + 1));
  s = pubAct(wordGridPublic, s, b.player.id, { type: "word", word: "tea" }, at(t1 + 2));
  s = touchAll(s, t1 + 60_000);
  s = pubTick(wordGridPublic, s, at(t1 + ROUND_MS))!;
  const last = s.game.last!;
  assert.deepEqual(last.results.find((r) => r.id === a.player.id)!.cancelled, ["tea"]);
});
test("everyone gone: the clock stops until someone joins", () => {
  let s = join(wordGridPublic, initState(wordGridPublic, at(T0)) as PubState<WGRound>, "Ava", T0).state;
  s = pubTick(wordGridPublic, s, at(T0 + STALE_MS + 1))!;
  assert.equal(s.game.phase, "idle");
});

console.log("massive decks (bar-wide)");
function table(count: number) {
  let s = initState(massivePublic, at(T0)) as PubState<MDRound>;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const j = join(massivePublic, s, `P${i}`, T0 + i);
    s = j.state;
    ids.push(j.player.id);
  }
  return { s, ids };
}
test(`waits for ${MIN_PLAYERS} players, then deals everyone in`, () => {
  const three = table(3);
  assert.equal(three.s.game.phase, "waiting");
  assert.equal((pubView(massivePublic, three.s, three.ids[0], at(T0 + 10)).game as { needed: number }).needed, 1);
  const four = table(4);
  assert.equal(four.s.game.phase, "submit");
  for (const id of four.ids) assert.equal(four.s.game.hands[id].length, 7);
});
test("join mid-round: wait for the next round", () => {
  const { s } = table(4);
  const late = join(massivePublic, s, "Late", T0 + 100);
  assert.equal(late.player.status, "queued");
  assert.throws(() => pubAct(massivePublic, late.state, late.player.id, { type: "submit", card: 0 }, at(T0 + 200)), /next round/);
});
test("nobody stalls it: missing cards and missing judges are auto-played", () => {
  let { s } = table(4);
  const judge = s.game.judge!;
  const players = s.game.participants.filter((id) => id !== judge);
  s = pubAct(massivePublic, s, players[0], { type: "submit", card: s.game.hands[players[0]][0] }, at(T0 + 1000));
  s = touchAll(s, T0 + 20_000);
  s = pubTick(massivePublic, s, at(s.game.deadline))!;
  assert.equal(s.game.phase, "judge");
  assert.equal(Object.keys(s.game.submissions).length, 3, "two cards were played for the stragglers");
  assert.equal(s.players.find((p) => p.id === players[1])!.missed, 1);
  const t = s.game.deadline;
  s = touchAll(s, t - 1000);
  s = pubTick(massivePublic, s, at(t))!;
  assert.equal(s.game.phase, "result");
  assert.ok(s.game.autoJudged);
  assert.equal(s.players.reduce((sum, p) => sum + p.score, 0), 1, "the chosen card still scores");
});
test("two auto-played turns in a row removes a player; acting resets the count", () => {
  const t0 = table(5);
  let { s } = t0;
  const { ids } = t0;
  let now = T0;
  const idle = ids.find((id) => id !== s.game.judge)!;
  for (let round = 0; round < 3; round++) {
    // Everyone else plays; the idle player only polls.
    for (const id of s.game.participants) {
      if (id === idle || id === s.game.judge || id in s.game.submissions) continue;
      s = pubAct(massivePublic, s, id, { type: "submit", card: s.game.hands[id][0] }, at(now + 10));
    }
    now = s.game.deadline;
    s = touchAll(s, now - 1000);
    s = pubTick(massivePublic, s, at(now)) ?? s;
    if (s.game.phase === "judge") {
      s = pubAct(massivePublic, s, s.game.judge!, { type: "pick", card: s.game.submissions[s.game.order[0]].card }, at(now + 10));
    }
    now = s.game.deadline;
    s = touchAll(s, now - 1000);
    s = pubTick(massivePublic, s, at(now + RESULT_MS)) ?? s;
    now += RESULT_MS;
  }
  const p = s.players.find((x) => x.id === idle)!;
  assert.equal(p.status, "gone");
  assert.equal(p.removed, "idle");
  assert.ok(!s.game.participants.includes(idle));
});
test("players who close the page are removed at the next round", () => {
  const t0 = table(5);
  let { s } = t0;
  const { ids } = t0;
  const gone = ids[0];
  let now = T0;
  // Step through deadlines; everyone except one keeps polling.
  for (let i = 0; i < 8 && s.players.find((p) => p.id === gone)!.status !== "gone"; i++) {
    now = Math.max(now, s.game.deadline) + 1;
    s = { ...s, players: s.players.map((p) => (p.id === gone ? p : { ...p, seenAt: now })) };
    s = pubTick(massivePublic, s, at(now)) ?? s;
  }
  assert.equal(s.players.find((p) => p.id === gone)!.status, "gone");
  assert.ok(s.game.phase === "submit", "the game carries on with the rest");
});
test("falling below four goes back to waiting; leaving is allowed any time", () => {
  const t0 = table(4);
  let { s } = t0;
  const { ids } = t0;
  s = pubLeave(massivePublic, s, ids[3], at(T0 + 100));
  for (const id of s.game.participants) {
    if (id === s.game.judge || id === ids[3] || id in s.game.submissions) continue;
    s = pubAct(massivePublic, s, id, { type: "submit", card: s.game.hands[id][0] }, at(T0 + 200));
  }
  assert.equal(s.game.phase, "judge", "doesn't wait for the player who left");
  s = pubAct(massivePublic, s, s.game.judge!, { type: "pick", card: s.game.submissions[s.game.order[0]].card }, at(T0 + 300));
  s = touchAll(s, T0 + 5000);
  s = pubTick(massivePublic, s, at(s.game.deadline))!;
  assert.equal(s.game.phase, "waiting");
});

console.log("daily winners");
test("the day's leader is saved and everyone starts fresh", () => {
  const t0 = table(4);
  let { s } = t0;
  const { ids } = t0;
  s = { ...s, players: s.players.map((p, i) => ({ ...p, score: [3, 7, 7, 1][i] })) };
  const tomorrow = Date.UTC(2026, 11, 6, 11, 0);
  s = pubTick(massivePublic, s, at(tomorrow))!;
  assert.equal(s.day, "2026-12-06");
  assert.equal(s.history[0].day, "2026-12-05");
  assert.deepEqual(s.history[0].winners.map((w) => w.score), [7, 7], "ties share the day");
  assert.ok(s.players.every((p) => p.score === 0));
  void ids;
});
test("coming back with your token keeps today's score", () => {
  let s = initState(wordGridPublic, at(T0)) as PubState<WGRound>;
  const a = join(wordGridPublic, s, "Ava", T0);
  s = { ...a.state, players: a.state.players.map((p) => ({ ...p, score: 5 })) };
  s = pubLeave(wordGridPublic, s, a.player.id, at(T0 + 10));
  const back = join(wordGridPublic, s, "Ava", T0 + 20, a.player.token);
  assert.equal(back.player.id, a.player.id);
  assert.equal(back.state.players.find((p) => p.id === a.player.id)!.score, 5);
});

console.log(`\n${checks} checks passed`);
