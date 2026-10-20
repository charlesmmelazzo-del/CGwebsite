// Run: npx tsx src/components/popup/creepypastas/__tests__/tales.test.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { matching, pickTale, pickAny, TIME_CHOICES, SCARE_CHOICES, type TaleCard } from "../tales";

const catalog: TaleCard[] = JSON.parse(readFileSync("public/popup/creepypastas/catalog.json", "utf8"));
let checks = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++; };

ok(catalog.length === 150, "150 tales");
for (const t of catalog) {
  ok(t.host.teaser && t.host.introduction && t.host.bridge && t.host.callback, `${t.id} has host lines`);
  ok(readFileSync(`public/popup/creepypastas/tales/${t.id}.json`, "utf8").includes('"paragraphs"'), `${t.id} text file`);
}

// Every time x scare pairing has something to offer.
for (const time of TIME_CHOICES) for (const s of SCARE_CHOICES) {
  const pool = matching(catalog, time.id, s.id);
  ok(pool.length > 0, `${time.id}/${s.id} has tales (${pool.length})`);
  ok(pool.every((t) => s.levels.includes(t.scare)), `${time.id}/${s.id} respects scare`);
  if (time.id !== "all_the_time") ok(pool.every((t) => t.time === time.id), `${time.id} respects length`);
}
ok(matching(catalog, "all_the_time", "spooky").length === catalog.filter((t) => t.scare === 3).length, "all the time = any length");

// Offering everything in a pool never repeats, then reports exhaustion.
const pool = matching(catalog, "ten_to_twenty", "gentle");
const offered = new Set<string>();
for (let i = 0; i < pool.length; i++) {
  const p = pickTale(catalog, "ten_to_twenty", "gentle", new Set(), offered);
  ok(p.kind === "tale" && !offered.has(p.tale.id), "fresh pick");
  if (p.kind === "tale") offered.add(p.tale.id);
}
ok(pickTale(catalog, "ten_to_twenty", "gentle", new Set(), offered).kind === "allOffered", "all offered");
ok(pickTale(catalog, "ten_to_twenty", "gentle", new Set(pool.map((t) => t.id)), new Set()).kind === "allHeard", "all heard");
ok(pickTale([], "five_to_ten", "gentle", new Set(), new Set()).kind === "none", "none");
// Finished tales are skipped while unfinished ones remain.
const fin = new Set(pool.slice(1).map((t) => t.id));
const only = pickTale(catalog, "ten_to_twenty", "gentle", fin, new Set());
ok(only.kind === "tale" && only.tale.id === pool[0].id, "skips finished");
ok(pickAny(catalog, "ten_to_twenty", "gentle") !== null, "pickAny");

console.log(`tales: ${checks} checks passed`);
