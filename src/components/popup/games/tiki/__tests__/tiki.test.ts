// Tiki Wars — driving the real rules frame by frame.
import assert from "node:assert";
import { unrenderable } from "../../arcade";
import { QUIPS, QUIP_LIMITS, QuipBag } from "../quips";
import {
  applyEffect, armorCost, blockerChance, bombCost, CONTACT_Z,
  damage, enemySpeed, freshState, gateGoodChance, GRUNTS, GUNS, isGrunt,
  MAX_ARMOR, MAX_HEALTH, MAX_HELPERS, PTS_BLOCKER, PTS_BOSS, PTS_GRUNT,
  PTS_MISS_BLOCKER, PTS_MISS_GRUNT, spawnInterval, update, detonateBomb,
  enemyWalk, waveSize, worldSpeed, gruntHp, blockerHp, FOLLOW_RATE,
  MAX_TRAVERSE, GATE_REACH, GATE_CURE_HITS, cureGateOption, LADDERS,
  rungOf, type State,
} from "../tikiCore";

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const DT = 1 / 60;
const run = (st: State, secs: number) => {
  for (let i = 0; i < Math.round(secs / DT); i++) update(st, DT);
};

/** Deterministic rng so a failure is reproducible. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const fresh = (o = {}) => freshState({ rng: seeded(7), ...o });

// ── The grunt contract ──────────────────────────────────────────────────────

check("a grunt survives one shot and dies to a few", () => {
  const st = fresh();
  assert.ok(gruntHp(1) > 1, "grunts are back to dying in a single shot");
  st.enemies = [{
    id: 1, kind: "lime", z: 0.5, nx: 0, hp: gruntHp(1), maxHp: gruntHp(1), speed: 0,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  st.bullets = [{ z: 0.5, nx: 0, vnx: 0, damage: GUNS.pistol.damage, side: 1 }];
  update(st, DT);
  assert.equal(st.enemies[0].dying, 0, "one bullet still killed it");
  for (let i = 0; i < gruntHp(1); i++) {
    st.enemies[0].z = 0.5;
    st.bullets = [{ z: 0.5, nx: 0, vnx: 0, damage: GUNS.pistol.damage, side: 1 }];
    update(st, DT);
  }
  assert.ok(st.enemies[0].dying > 0, "a grunt would not die to its full health in shots");
});

check("all four fruits share one health value", () => {
  // Variety between grunts is colour, silhouette and speed — never health.
  const hps = new Set(GRUNTS.map(() => gruntHp(3)));
  assert.equal(hps.size, 1);
});

check("a blocker is still clearly tougher than a grunt", () => {
  for (const stage of [1, 10, 30]) {
    assert.ok(blockerHp(stage) > gruntHp(stage),
      `stage ${stage}: a blocker is no tougher than a grunt`);
  }
});

check("a hit staggers the target and shoves it back", () => {
  const st = fresh();
  st.enemies = [{
    id: 1, kind: "sugarcane", z: 0.5, nx: 0, hp: 20, maxHp: 20, speed: 0.2,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  st.bullets = [{ z: 0.5, nx: 0, vnx: 0, damage: 1, side: 1 }];
  update(st, DT);
  const e = st.enemies[0];
  assert.ok(e.stagger > 0, "a hit did not stagger the enemy");
  assert.ok(e.z > 0.5, "a hit did not push the enemy back");
});

check("a staggered enemy barely advances", () => {
  const mk = (stagger: number) => {
    const st = fresh();
    st.gun = "flame";                  // no fresh bullets to re-stagger it
    st.enemies = [{
      id: 1, kind: "sugarcane", z: 0.9, nx: 0.9, hp: 20, maxHp: 20, speed: 0.4,
      burn: 0, flash: 0, stagger, tracks: false, dying: 0,
    }];
    st.playerNx = -0.9;
    run(st, 0.1);
    return st.enemies[0].z;
  };
  assert.ok(mk(0.5) > mk(0), "staggering made no difference to how far it walked");
});

check("grunts are grunts and the blocker is not", () => {
  for (const k of GRUNTS) assert.ok(isGrunt(k));
  assert.ok(!isGrunt("sugarcane"));
  assert.ok(!isGrunt("boss"));
});

check("a blocker takes several shots and scales with the stage", () => {
  assert.ok(blockerHp(1) >= 3);
  assert.ok(blockerHp(10) > blockerHp(1));
  assert.ok(blockerHp(30) > blockerHp(10));
});

// ── Damage and armor ────────────────────────────────────────────────────────

check("armor absorbs a whole hit before health takes any", () => {
  const st = fresh({ armor: 2 });
  damage(st, 40, true);
  assert.equal(st.armor, 1);
  assert.equal(st.health, MAX_HEALTH);
  damage(st, 40, true);
  assert.equal(st.armor, 0);
  assert.equal(st.health, MAX_HEALTH);
  damage(st, 40, true);
  assert.equal(st.health, MAX_HEALTH - 40);
});

check("running out of health ends the run", () => {
  const st = fresh();
  damage(st, MAX_HEALTH, true);
  assert.equal(st.phase, "over");
  assert.equal(st.health, 0);
});

check("invulnerability stops one contact becoming five", () => {
  const st = fresh();
  damage(st, 10);
  const after = st.health;
  damage(st, 10);
  assert.equal(st.health, after, "took a second hit inside the invuln window");
});

check("an enemy that reaches the player deals contact damage", () => {
  const st = fresh();
  st.enemies = [{
    id: 1, kind: "lime", z: CONTACT_Z * 0.5, nx: 0, hp: 1, maxHp: 1, speed: 0,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  st.gun = "flame";           // no bullets, so the hit is unambiguous
  st.playerNx = 0;
  update(st, DT);
  assert.ok(st.health < MAX_HEALTH, "walked into the player with no damage");
});

check("a dodged grunt costs no HEALTH (it costs points instead)", () => {
  const st = fresh();
  st.enemies = [{
    id: 1, kind: "lime", z: 0.1, nx: -0.9, hp: 1, maxHp: 1, speed: 0.4,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  st.gun = "flame";
  st.playerNx = 0.9;
  run(st, 1.2);
  assert.equal(st.health, MAX_HEALTH, "a grunt dodged by a full road still hit");
});

// ── Dodging has a price ─────────────────────────────────────────────────────

check("a grunt that walks past unkilled costs points", () => {
  const st = fresh();
  st.score = 500;
  st.gun = "flame";                    // no bullets, so nothing dies by accident
  st.playerNx = 1;                     // stand well clear: dodge, not contact
  st.enemies = [{
    id: 1, kind: "lime", z: 0.05, nx: -0.9, hp: 1, maxHp: 1, speed: 0.5,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  run(st, 0.6);
  assert.equal(st.score, 500 - PTS_MISS_GRUNT, "dodging a grunt was free");
  assert.equal(st.misses.grunt, 1);
  assert.equal(st.health, MAX_HEALTH, "the dodge should not also have hurt");
});

check("a blocker that gets past costs more than a grunt", () => {
  const st = fresh();
  st.score = 500;
  st.gun = "flame";
  st.playerNx = 1;
  st.enemies = [{
    id: 1, kind: "sugarcane", z: 0.05, nx: -0.9, hp: 9, maxHp: 9, speed: 0.5,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  run(st, 0.6);
  assert.equal(st.score, 500 - PTS_MISS_BLOCKER);
  assert.ok(PTS_MISS_BLOCKER > PTS_MISS_GRUNT);
  assert.equal(st.misses.blocker, 1);
});

check("killing always beats dodging", () => {
  assert.ok(PTS_GRUNT > 0 && PTS_MISS_GRUNT > 0);
  assert.ok(PTS_BLOCKER > 0 && PTS_MISS_BLOCKER > 0);
});

check("an enemy that HITS you is not also charged as a dodge", () => {
  const st = fresh();
  st.score = 500;
  st.gun = "flame";
  st.playerNx = 0;
  st.enemies = [{
    id: 1, kind: "lime", z: 0.04, nx: 0, hp: 1, maxHp: 1, speed: 0.5,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  run(st, 0.6);
  assert.ok(st.health < MAX_HEALTH, "should have taken the hit");
  assert.equal(st.misses.grunt, 0, "took damage AND a dodge penalty");
  assert.equal(st.score, 500, "a hit should not deduct points as well");
});

check("score never goes negative from penalties", () => {
  const st = fresh();
  st.score = 3;
  st.gun = "flame";
  st.playerNx = 1;
  st.enemies = [{
    id: 1, kind: "sugarcane", z: 0.05, nx: -0.9, hp: 9, maxHp: 9, speed: 0.5,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  run(st, 0.6);
  assert.equal(st.score, 0);
});

check("a miss leaves a floating number, because the HUD has no score", () => {
  const st = fresh();
  st.gun = "flame";
  st.playerNx = 1;
  st.enemies = [{
    id: 1, kind: "lime", z: 0.05, nx: -0.9, hp: 1, maxHp: 1, speed: 0.5,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  run(st, 0.15);
  assert.ok(st.pops.length > 0, "penalty was applied with no feedback at all");
  assert.equal(st.pops[0].good, false);
});

// ── The boss cannot be lost ─────────────────────────────────────────────────

check("a boss that touches you is NOT consumed", () => {
  const st = fresh();
  st.gun = "flame";
  st.playerNx = 0;
  st.enemies = [{
    id: 1, kind: "boss", z: 0.04, nx: 0, hp: 40, maxHp: 40, speed: 0.3,
    burn: 0, flash: 0, stagger: 0, tracks: true, dying: 0,
  }];
  st.phase = "boss";
  run(st, 1.0);
  const boss = st.enemies.find((e) => e.kind === "boss");
  assert.ok(boss, "the boss vanished after hitting the player — stage softlocks");
  assert.ok(boss!.hp > 0, "the boss died from touching the player");
});

check("a boss can never walk off the field and strand the stage", () => {
  const st = fresh();
  st.gun = "flame";
  st.playerNx = -1;                    // dodge as hard as possible
  st.enemies = [{
    id: 1, kind: "boss", z: 0.02, nx: 1, hp: 40, maxHp: 40, speed: 0.9,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  st.phase = "boss";
  run(st, 2.0);
  assert.ok(st.enemies.some((e) => e.kind === "boss"), "boss walked past and left the stage unclearable");
  assert.equal(st.misses.blocker + st.misses.grunt, 0, "a boss was charged as a dodge");
});

// ── Guns ────────────────────────────────────────────────────────────────────

check("the shotgun puts three bullets out per shot", () => {
  const st = fresh();
  st.gun = "shotgun";
  st.cooldown = 0;
  update(st, DT);
  assert.equal(st.bullets.length, 3);
});

check("the uzi fires faster than the pistol", () => {
  assert.ok(GUNS.uzi.rate > GUNS.pistol.rate);
});

check("the flamethrower burns, and the burn outlives the stream", () => {
  const st = fresh();
  st.gun = "flame";
  st.playerNx = 0;
  st.enemies = [{
    id: 1, kind: "sugarcane", z: 0.2, nx: 0, hp: 40, maxHp: 40, speed: 0,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  update(st, DT);
  const e = st.enemies[0];
  assert.ok(e.burn > 0, "flame did not set the enemy alight");
  const hpWhileLit = e.hp;
  st.gun = "pistol";                 // stream off; burn should keep ticking
  st.bullets = [];
  update(st, DT * 4);
  assert.ok(st.enemies[0].hp < hpWhileLit, "burn stopped when the stream did");
});

check("the flamethrower cannot reach the horizon", () => {
  const st = fresh();
  st.gun = "flame";
  st.playerNx = 0;
  st.enemies = [{
    id: 1, kind: "sugarcane", z: 0.9, nx: 0, hp: 40, maxHp: 40, speed: 0,
    burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0,
  }];
  update(st, DT);
  assert.equal(st.enemies[0].burn, 0, "flame reached far up the field");
});

check("helpers add bullets but never upgrade past the base pistol", () => {
  const a = fresh();
  a.cooldown = 0;
  update(a, DT);
  const solo = a.bullets.length;

  const b = fresh();
  b.helpers = 4;
  b.cooldown = 0;
  update(b, DT);
  assert.equal(b.bullets.length, solo + 4);
  for (const bullet of b.bullets) assert.equal(bullet.damage, GUNS.pistol.damage);
});

// ── Bombs ───────────────────────────────────────────────────────────────────

check("a bomb clears the near field and leaves the far field alone", () => {
  const st = fresh();
  st.bombs = 1;
  st.enemies = [
    { id: 1, kind: "sugarcane", z: 0.2, nx: 0, hp: 20, maxHp: 20, speed: 0, burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0 },
    { id: 2, kind: "sugarcane", z: 0.9, nx: 0, hp: 20, maxHp: 20, speed: 0, burn: 0, flash: 0, stagger: 0, tracks: false, dying: 0 },
  ];
  assert.ok(detonateBomb(st));
  assert.ok(st.enemies[0].hp <= 0, "near enemy survived the bomb");
  assert.ok(st.enemies[1].hp > 0, "bomb reached the horizon");
  assert.equal(st.bombs, 0);
});

check("a bomb you don't have does nothing", () => {
  const st = fresh();
  st.bombs = 0;
  assert.equal(detonateBomb(st), false);
});

// ── Gates ───────────────────────────────────────────────────────────────────

/** A helpers-ladder option at a named rung. tier 3 is neutral. */
const helperOpt = (tier: number) => ({ family: "helpers" as const, tier, cure: 0 });
const moneyOpt = (tier: number) => ({ family: "money" as const, tier, cure: 0 });

check("the gate you steer into is the one that applies", () => {
  const st = fresh();
  st.gate = { z: 0.05, left: helperOpt(6), right: helperOpt(0), taken: false, flipped: 0 };
  st.playerNx = -0.6;
  run(st, 0.15);                       // let the gate reach the player
  assert.equal(st.helpers, 3, "steering left did not take the left gate");
  assert.equal(st.gatesTaken, 1);
});

check("the gate you steer away from is the one you avoid", () => {
  const st = fresh();
  st.gate = { z: 0.05, left: helperOpt(6), right: helperOpt(0), taken: false, flipped: 0 };
  st.playerNx = 0.6;
  run(st, 0.15);
  assert.equal(st.helpers, 0, "steering right somehow took the left gate");
});

check("a gate only ever fires once", () => {
  const st = fresh();
  st.gate = { z: 0.05, left: moneyOpt(2), right: moneyOpt(2), taken: false, flipped: 0 };
  run(st, 0.9);
  assert.equal(st.money, 5, "a single gate paid out more than once");
});

// ── Gates you can refuse, and gates you can fix ─────────────────────────────

check("hugging the open edge refuses the gate entirely", () => {
  const st = fresh();
  st.gate = { z: 0.05, left: helperOpt(0), right: helperOpt(0), taken: false, flipped: 0 };
  st.playerNx = -1;                    // outside GATE_REACH
  run(st, 0.2);
  assert.equal(st.helpers, 0, "a gate applied from outside its panel");
  assert.equal(st.gatesTaken, 0, "refusing the gate still counted as taking one");
  assert.ok(GATE_REACH < 1, "panels span the whole road again — a gate is compulsory");
});

check("standing inside a panel still takes it", () => {
  const st = fresh();
  st.gate = { z: 0.05, left: helperOpt(6), right: helperOpt(0), taken: false, flipped: 0 };
  st.playerNx = -GATE_REACH + 0.05;
  run(st, 0.2);
  assert.equal(st.helpers, 3, "just inside the panel did not take the gate");
});

check("curing steps ONE rung at a time, not straight to a reward", () => {
  const o = helperOpt(0);              // -3 RUM
  assert.equal(rungOf(o).label, "-3 RUM");
  for (let i = 0; i < GATE_CURE_HITS - 1; i++) {
    assert.equal(cureGateOption(o), false, "stepped up before enough rounds landed");
  }
  assert.equal(cureGateOption(o), true);
  assert.equal(rungOf(o).label, "-2 RUM", "a single cure jumped more than one rung");
});

check("a -3 has to be walked all the way through neutral to pay out", () => {
  const o = helperOpt(0);
  const step = () => { for (let i = 0; i < GATE_CURE_HITS; i++) cureGateOption(o); };
  step(); assert.equal(rungOf(o).label, "-2 RUM");
  step(); assert.equal(rungOf(o).label, "-1 RUM");
  step(); assert.equal(rungOf(o).tone, "neutral", "never passes through harmless");
  assert.equal(rungOf(o).effect, null, "the neutral rung still does something");
  step(); assert.equal(rungOf(o).tone, "good", "could not be walked into a reward");
});

check("the neutral rung applies nothing at all", () => {
  const st = fresh({ money: 40 });
  st.helpers = 2;
  st.gate = { z: 0.05, left: helperOpt(3), right: helperOpt(0), taken: false, flipped: 0 };
  st.playerNx = -0.5;
  st.cooldown = 99;                    // don't let our own fire cure the panel
  run(st, 0.2);
  assert.equal(st.helpers, 2, "the neutral rung changed something");
  assert.equal(st.money, 40);
});

check("a maxed panel absorbs no more rounds", () => {
  const o = helperOpt(6);              // top of the helpers ladder
  assert.equal(cureGateOption(o), false);
  assert.equal(o.cure, 0, "rounds were banked into a panel that cannot improve");
});

check("shooting a panel cures the side the bullet is actually on", () => {
  const st = fresh();
  st.gate = { z: 0.5, left: helperOpt(0), right: helperOpt(0), taken: false, flipped: 0 };
  st.cooldown = 99;
  for (let i = 0; i < GATE_CURE_HITS; i++) {
    st.bullets = [{ z: 0.5, nx: -0.3, vnx: 0, damage: 1, side: 1 }];
    update(st, DT);
    st.gate!.z = 0.5;                  // hold it still for the test
  }
  assert.equal(rungOf(st.gate!.left).label, "-2 RUM", "the left panel did not take the rounds");
  assert.equal(rungOf(st.gate!.right).label, "-3 RUM", "the right panel took rounds it never saw");
});

check("a round through the open edge cures nothing", () => {
  const st = fresh();
  st.gate = { z: 0.5, left: helperOpt(0), right: helperOpt(0), taken: false, flipped: 0 };
  st.cooldown = 99;
  for (let i = 0; i < GATE_CURE_HITS * 2; i++) {
    st.bullets = [{ z: 0.5, nx: -0.95, vnx: 0, damage: 1, side: 1 }];
    update(st, DT);
    st.gate!.z = 0.5;
  }
  assert.equal(rungOf(st.gate!.left).label, "-3 RUM", "a round past the panel still cured it");
});

check("a bullet is not eaten by the gate", () => {
  const st = fresh();
  st.gate = { z: 0.5, left: helperOpt(0), right: helperOpt(0), taken: false, flipped: 0 };
  st.cooldown = 99;                    // no fresh shots muddying the count
  st.bullets = [{ z: 0.5, nx: -0.3, vnx: 0, damage: 1, side: 1 }];
  update(st, DT);
  assert.equal(st.bullets.length, 1, "the gate swallowed the round");
  assert.ok(st.bullets[0].damage > 0, "the round can no longer hurt anything behind the gate");
});

check("one round counts against a panel exactly once", () => {
  const st = fresh();
  st.cooldown = 99;
  st.gate = { z: 0.5, left: helperOpt(0), right: helperOpt(0), taken: false, flipped: 0 };
  st.bullets = [{ z: 0.5, nx: -0.3, vnx: 0, damage: 1, side: 1 }];
  // Hold the round beside the panel for many frames.
  for (let i = 0; i < 12; i++) {
    st.bullets[0].z = 0.5;
    st.gate.z = 0.5;
    update(st, DT);
  }
  assert.equal(st.gate!.left.cure, 1,
    `one round was counted ${st.gate!.left.cure} times`);
});

check("every ladder passes through exactly one neutral rung", () => {
  for (const [family, ladder] of Object.entries(LADDERS)) {
    const neutrals = ladder.filter((r) => r.tone === "neutral");
    assert.equal(neutrals.length, 1, `${family} does not have exactly one neutral rung`);
    const firstGood = ladder.findIndex((r) => r.tone === "good");
    const lastBad = ladder.map((r) => r.tone).lastIndexOf("bad");
    assert.ok(lastBad < firstGood, `${family} is not ordered bad -> neutral -> good`);
  }
});

check("helpers and armor stay inside their caps", () => {
  const st = fresh();
  for (let i = 0; i < 10; i++) applyEffect(st, { kind: "helpers", n: 3 });
  assert.equal(st.helpers, MAX_HELPERS);
  applyEffect(st, { kind: "helpers", n: -99 });
  assert.equal(st.helpers, 0);
  assert.ok(MAX_ARMOR === 10);
});

check("money never goes negative", () => {
  const st = fresh({ money: 3 });
  applyEffect(st, { kind: "money", n: -5 });
  assert.equal(st.money, 0);
});

check("gate offers decay with depth and improve with luck", () => {
  assert.ok(gateGoodChance(1, 0) > gateGoodChance(20, 0), "deep gates are no worse");
  assert.ok(gateGoodChance(10, 100) > gateGoodChance(10, 0), "luck did nothing");
});

// ── The endless curve ───────────────────────────────────────────────────────

check("every difficulty lever keeps scaling past any build", () => {
  assert.ok(spawnInterval(30) < spawnInterval(1), "spawns did not speed up");
  assert.ok(enemySpeed(30) > enemySpeed(1), "enemies did not speed up");
  assert.ok(blockerChance(30) > blockerChance(1), "blockers did not get denser");
  assert.ok(blockerHp(60) > blockerHp(30), "blocker health hit a ceiling");
  assert.ok(enemySpeed(60) > enemySpeed(30), "speed hit a ceiling");
});

// ── Quips ───────────────────────────────────────────────────────────────────

check("every quip can actually be drawn by the cabinet font", () => {
  // drawText substitutes "?" for a missing glyph, so a curly apostrophe ships
  // as "IT?S GOOD TO BE THE KING" with nothing failing anywhere.
  for (const [pool, lines] of Object.entries(QUIPS)) {
    for (const line of lines) {
      const bad = unrenderable(line);
      assert.equal(bad.length, 0,
        `${pool}: ${JSON.stringify(line)} contains unprintable ${JSON.stringify(bad)}`);
    }
  }
});

check("no quip is too long to read in the time it is on screen", () => {
  for (const [pool, lines] of Object.entries(QUIPS)) {
    const limit = QUIP_LIMITS[pool as keyof typeof QUIP_LIMITS];
    for (const line of lines) {
      assert.ok(line.length <= limit,
        `${pool}: ${JSON.stringify(line)} is ${line.length} chars, limit ${limit}`);
    }
  }
});

check("no pool has duplicate lines", () => {
  for (const [pool, raw] of Object.entries(QUIPS)) {
    const lines = raw as readonly string[];
    const dupes = lines.filter((l, i) => lines.indexOf(l) !== i);
    assert.equal(dupes.length, 0, `${pool}: repeated ${JSON.stringify(dupes)}`);
  }
});

check("every pool has enough lines to feel fresh", () => {
  for (const [pool, lines] of Object.entries(QUIPS)) {
    assert.ok(lines.length >= 10, `${pool}: only ${lines.length} lines`);
  }
});

check("the shuffle bag uses every line before repeating one", () => {
  const bag = new QuipBag(seeded(11));
  const n = QUIPS.downgrade.length;
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) seen.add(bag.draw("downgrade"));
  assert.equal(seen.size, n, "a line repeated before the pool was exhausted");
});

check("a bad gate draws from downgrade, a good one from pickup", () => {
  const st = fresh();
  // tier 0 on the helpers ladder is -3 RUM; tier 6 is +3 RUM.
  st.gate = { z: 0.05, left: helperOpt(0), right: helperOpt(6), taken: false, flipped: 0 };
  st.playerNx = -0.5;
  run(st, 0.2);
  assert.equal(st.lastGate, "bad", "a -3 RUM did not report itself as bad");

  const st2 = fresh();
  st2.gate = { z: 0.05, left: helperOpt(6), right: helperOpt(0), taken: false, flipped: 0 };
  st2.playerNx = -0.5;
  run(st2, 0.2);
  assert.equal(st2.lastGate, "good");
});

check("a neutral gate reports neutral, so nothing is said", () => {
  const st = fresh();
  st.gate = { z: 0.05, left: helperOpt(3), right: helperOpt(0), taken: false, flipped: 0 };
  st.playerNx = -0.5;
  st.cooldown = 99;
  run(st, 0.2);
  assert.equal(st.lastGate, "neutral");
});

// ── Steering ────────────────────────────────────────────────────────────────

check("the character is pinned to the thumb, not towed behind it", () => {
  const st = fresh();
  st.playerNx = 0;
  st.targetNx = 0.8;
  // One tenth of a second is about as long as a guest will tolerate.
  run(st, 0.1);
  assert.ok(st.playerNx > 0.7,
    `after 100ms the character was still at ${st.playerNx.toFixed(2)} of a 0.8 target — too drifty`);
  assert.ok(FOLLOW_RATE > 20, "follow rate dropped back into towed territory");
});

check("a full road crossing is quick", () => {
  const st = fresh();
  st.playerNx = -1;
  st.targetNx = 1;
  run(st, 0.35);
  assert.ok(st.playerNx > 0.9,
    `crossing the road took longer than 350ms (reached ${st.playerNx.toFixed(2)})`);
});

check("but a violent flick cannot teleport across the road", () => {
  const st = fresh();
  st.playerNx = -1;
  st.targetNx = 1;
  update(st, DT);
  assert.ok(st.playerNx < 0.2,
    "one frame crossed most of the road — a flick teleports the character");
  // ...and the cap must stay generous, or it becomes the towed feel again.
  assert.ok(MAX_TRAVERSE > 5, "the traverse cap is tight enough to feel like lag");
});

check("releasing the thumb stops the character dead", () => {
  const st = fresh();
  st.playerNx = 0;
  st.targetNx = 1;
  run(st, 0.2);
  const held = st.playerNx;
  st.targetNx = null;
  st.drag = 0;
  run(st, 0.5);
  assert.ok(Math.abs(st.playerNx - held) < 1e-6, "the character coasted after release");
});

check("keyboard steering still works when no thumb is down", () => {
  const st = fresh();
  st.targetNx = null;
  st.drag = 1;
  run(st, 0.3);
  assert.ok(st.playerNx > 0.2, "arrow keys no longer move the character");
});

check("steering never leaves the road", () => {
  const st = fresh();
  st.targetNx = 5;
  run(st, 1);
  assert.ok(st.playerNx <= 1);
  st.targetNx = -5;
  run(st, 1);
  assert.ok(st.playerNx >= -1);
});

// ── Density ─────────────────────────────────────────────────────────────────

check("enemies arrive in waves, not one at a time", () => {
  assert.ok(waveSize(1) >= 2, "stage 1 spawns a single enemy at a time");
  assert.ok(waveSize(12) > waveSize(1), "waves do not grow with depth");
});

check("a wave spreads across the road rather than clumping", () => {
  const st = fresh();
  run(st, 1.05);
  assert.ok(st.enemies.length >= 2, "no wave arrived in the first second");
  const xs = st.enemies.map((e) => e.nx);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.3,
    "the whole wave arrived in one lane and can be dodged with one step");
});

check("the field fills up faster than it used to", () => {
  const st = fresh();
  run(st, 6);
  // The old build trickled one enemy roughly every 1.15s.
  assert.ok(st.enemies.length + st.kills.grunt + st.kills.blocker > 6,
    "six seconds produced barely more than the old one-at-a-time trickle");
});

// ── The world moves at one speed ────────────────────────────────────────────

check("scenery is slower than anything walking at you", () => {
  for (const stage of [1, 5, 20]) {
    assert.ok(worldSpeed(stage) < enemySpeed(stage),
      `stage ${stage}: scenery keeps pace with enemies, so nothing reads as walking`);
  }
});

check("enemy speed is exactly the world plus its own legs", () => {
  for (const stage of [1, 10, 40]) {
    assert.ok(Math.abs(enemySpeed(stage) - (worldSpeed(stage) + enemyWalk(stage))) < 1e-9,
      `stage ${stage}: enemy speed drifted from the world it walks in`);
  }
});

check("the ground scrolls far slower than the old hard-coded rate", () => {
  // The bug: ground ran at 0.42 while enemies closed at ~0.155.
  assert.ok(worldSpeed(1) < 0.2, "ground speed is still outrunning the enemies");
});

// ── Bullets leave a muzzle ──────────────────────────────────────────────────

check("bullets carry the gun they came from", () => {
  const st = fresh();
  st.cooldown = 0;
  update(st, DT);
  assert.ok(st.bullets.length > 0);
  for (const b of st.bullets) assert.ok(b.side === 1 || b.side === -1);
});

check("a single-barrel gun alternates hands", () => {
  const st = fresh();
  const sides = [];
  for (let i = 0; i < 6; i++) {
    st.cooldown = 0;
    st.bullets = [];
    update(st, DT);
    sides.push(st.bullets[0].side);
  }
  assert.ok(new Set(sides).size === 2, "every shot came from the same pistol");
});

check("bullets still aim true regardless of which muzzle fired", () => {
  const st = fresh();
  st.playerNx = 0.4;
  st.cooldown = 0;
  update(st, DT);
  for (const b of st.bullets) {
    assert.ok(Math.abs(b.nx - 0.4) < 1e-9, "the muzzle offset leaked into aim");
  }
});

// ── Stage flow ──────────────────────────────────────────────────────────────

check("a stage runs, sends a boss, and the boss kill is its own beat", () => {
  const st = fresh();
  run(st, 47);
  assert.equal(st.phase, "boss", "no boss after the spawn window closed");
  const boss = st.enemies.find((e) => e.kind === "boss");
  assert.ok(boss, "boss phase with no boss on the field");
  boss!.hp = 0;
  update(st, DT);
  assert.equal(st.phase, "bosskill");
  const before = st.score;
  run(st, 3.2);
  assert.equal(st.phase, "cleared");
  assert.ok(st.score > before, "clearing the stage paid nothing");
});

check("a boss is worth far more than a grunt", () => {
  assert.ok(PTS_BOSS > PTS_GRUNT * 10);
});

// ── Shop economy ────────────────────────────────────────────────────────────

check("shop prices rise as you stock up", () => {
  assert.ok(armorCost(9) > armorCost(0));
  assert.ok(bombCost(2) > bombCost(0));
});

// ── Go Again ────────────────────────────────────────────────────────────────

check("a new run keeps money, armor, luck and score but not health", () => {
  const st = freshState({ money: 40, armor: 5, luck: 30, score: 12_500, stage: 4, rng: seeded(3) });
  assert.equal(st.money, 40);
  assert.equal(st.armor, 5);
  assert.equal(st.luck, 30);
  assert.equal(st.score, 12_500);
  assert.equal(st.stage, 4);
  assert.equal(st.health, MAX_HEALTH, "health should always start full");
  assert.equal(st.gun, "pistol", "guns should never carry into a new run");
  assert.equal(st.helpers, 0, "helpers should never carry into a new run");
});

console.log(`\n${passed} checks passed`);
