// Tiki Wars — driving the real rules frame by frame.
import assert from "node:assert";
import {
  applyEffect, armorCost, blockerChance, blockerHp, bombCost, CONTACT_Z,
  damage, enemySpeed, freshState, gateGoodChance, GRUNTS, GUNS, isGrunt,
  MAX_ARMOR, MAX_HEALTH, MAX_HELPERS, PTS_BLOCKER, PTS_BOSS, PTS_GRUNT,
  PTS_MISS_BLOCKER, PTS_MISS_GRUNT, spawnInterval, update, detonateBomb,
  type State,
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

check("every grunt dies in exactly one pistol shot", () => {
  for (const kind of GRUNTS) {
    const st = fresh();
    st.enemies = [{
      id: 1, kind, z: 0.5, nx: 0, hp: 1, maxHp: 1, speed: 0,
      burn: 0, flash: 0, tracks: false, dying: 0,
    }];
    st.bullets = [{ z: 0.5, nx: 0, vnx: 0, damage: GUNS.pistol.damage }];
    update(st, DT);
    assert.ok(st.enemies[0].dying > 0, `${kind} survived a single pistol bullet`);
  }
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: true, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    burn: 0, flash: 0, tracks: false, dying: 0,
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
    { id: 1, kind: "sugarcane", z: 0.2, nx: 0, hp: 20, maxHp: 20, speed: 0, burn: 0, flash: 0, tracks: false, dying: 0 },
    { id: 2, kind: "sugarcane", z: 0.9, nx: 0, hp: 20, maxHp: 20, speed: 0, burn: 0, flash: 0, tracks: false, dying: 0 },
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

check("the gate you steer into is the one that applies", () => {
  const st = fresh();
  st.gate = {
    z: 0.05,
    left: { effect: { kind: "helpers", n: 3 }, label: "+3", good: true },
    right: { effect: { kind: "helpers", n: -3 }, label: "-3", good: false },
    taken: false,
  };
  st.playerNx = -0.6;
  run(st, 0.15);                       // let the gate reach the player
  assert.equal(st.helpers, 3, "steering left did not take the left gate");
  assert.equal(st.gatesTaken, 1);
});

check("the gate you steer away from is the one you avoid", () => {
  const st = fresh();
  st.gate = {
    z: 0.05,
    left: { effect: { kind: "helpers", n: 3 }, label: "+3", good: true },
    right: { effect: { kind: "helpers", n: -3 }, label: "-3", good: false },
    taken: false,
  };
  st.playerNx = 0.6;
  run(st, 0.15);
  assert.equal(st.helpers, 0, "steering right somehow took the left gate");
});

check("a gate only ever fires once", () => {
  const st = fresh();
  st.gate = {
    z: 0.05,
    left: { effect: { kind: "money", n: 5 }, label: "+$5", good: true },
    right: { effect: { kind: "money", n: 5 }, label: "+$5", good: true },
    taken: false,
  };
  run(st, 0.9);
  assert.equal(st.money, 5, "a single gate paid out more than once");
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
