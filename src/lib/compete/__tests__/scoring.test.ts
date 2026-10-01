// Run: npx tsx src/lib/compete/__tests__/scoring.test.ts
import assert from "node:assert/strict";
import { ballotValue, contestantScore, leaders, resolveWinner, superlativeLeaders } from "../scoring";
import type { Tier } from "../types";

const cats = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];
const tiers: Tier[] = [
  { id: "judges", label: "Judges", weight: 50, isJudge: true, count: 3 },
  { id: "vip", label: "VIP", weight: 20, isJudge: false, count: 0 },
  { id: "ga", label: "GA", weight: 30, isJudge: false, count: 0 },
];

let n = 0;
function check(name: string, fn: () => void) {
  fn();
  n++;
  console.log(`  ✓ ${name}`);
}

check("ballot value averages categories and ignores out-of-range", () => {
  assert.equal(ballotValue({ a: 4, b: 2 }, cats), 3);
  assert.equal(ballotValue({ a: 5, b: 9 }, cats), 5);
  assert.equal(ballotValue({}, cats), null);
});

check("tiers are averaged, then weighted by percentage", () => {
  const r = contestantScore(
    [
      { tierId: "judges", scores: { a: 5, b: 5 } }, // 5
      { tierId: "judges", scores: { a: 3, b: 3 } }, // 3 → judges avg 4
      { tierId: "vip", scores: { a: 2, b: 2 } }, // vip avg 2
      { tierId: "ga", scores: { a: 1, b: 1 } },
      { tierId: "ga", scores: { a: 5, b: 5 } }, // ga avg 3
    ],
    tiers,
    cats
  );
  // 0.5*4 + 0.2*2 + 0.3*3 = 3.3
  assert.ok(Math.abs((r.overall ?? 0) - 3.3) < 1e-9);
});

check("a tier with no ballots drops out and the rest re-weight", () => {
  const r = contestantScore([{ tierId: "judges", scores: { a: 4, b: 4 } }, { tierId: "ga", scores: { a: 2, b: 2 } }], tiers, cats);
  // (50*4 + 30*2) / 80 = 3.25
  assert.ok(Math.abs((r.overall ?? 0) - 3.25) < 1e-9);
});

check("a hundred guests can't outvote the judges' share", () => {
  const many = Array.from({ length: 100 }, () => ({ tierId: "ga", scores: { a: 1, b: 1 } }));
  const r = contestantScore([...many, { tierId: "judges", scores: { a: 5, b: 5 } }], tiers, cats);
  // (50*5 + 30*1)/80 = 3.5
  assert.ok(Math.abs((r.overall ?? 0) - 3.5) < 1e-9);
});

check("no ballots → no score", () => {
  assert.equal(contestantScore([], tiers, cats).overall, null);
});

check("leaders reports ties and ignores nulls", () => {
  assert.deepEqual(leaders(new Map([["x", 3], ["y", 4], ["z", null]])), ["y"]);
  assert.deepEqual(leaders(new Map([["x", 4], ["y", 4]])).sort(), ["x", "y"]);
  assert.deepEqual(leaders(new Map([["x", null]])), []);
});

check("superlatives: most picks wins, ties reported", () => {
  assert.deepEqual(superlativeLeaders(["a", "b", "a"]), ["a"]);
  assert.deepEqual(superlativeLeaders(["a", "b"]).sort(), ["a", "b"]);
});

check("host tie-break only counts if it picks one of the tied", () => {
  assert.equal(resolveWinner(["a"]), "a");
  assert.equal(resolveWinner(["a", "b"]), null);
  assert.equal(resolveWinner(["a", "b"], "b"), "b");
  assert.equal(resolveWinner(["a", "b"], "c"), null);
});

console.log(`scoring: ${n} checks passed`);
