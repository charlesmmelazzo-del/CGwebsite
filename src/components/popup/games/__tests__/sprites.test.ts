// Sprite integrity.
//
// The art is hand-placed text, and a single missing character silently shears
// every row below it — or worse, draws nothing and leaves a hole you only
// notice in the game. These checks make a typo fail loudly instead.
import assert from "node:assert";
import {
  ARM,
  BARTENDER_COLORS,
  BARTENDER_HEADS,
  BARTENDER_TORSO,
  BOTTLE_COLORS,
  CLIMBER,
  CLIMBER_HERO_COLORS,
  CLIMBER_STEP,
  CLIMBER_THIEF_COLORS,
  GUEST,
  GUEST_ANGRY,
  guestColors,
  ROLLING_BOTTLE,
  SHELF_BOTTLE,
  shelfBottleColors,
  TIN,
  TIN_COLORS,
} from "../sprites";
import type { Sprite } from "../arcade";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

const ALL: [string, Sprite, Record<string, string>][] = [
  ["bartender head happy", BARTENDER_HEADS.happy, BARTENDER_COLORS],
  ["bartender head ok", BARTENDER_HEADS.ok, BARTENDER_COLORS],
  ["bartender head worried", BARTENDER_HEADS.worried, BARTENDER_COLORS],
  ["bartender head panic", BARTENDER_HEADS.panic, BARTENDER_COLORS],
  ["bartender torso", BARTENDER_TORSO, BARTENDER_COLORS],
  ["arm", ARM, BARTENDER_COLORS],
  ["tin", TIN, TIN_COLORS],
  ["guest", GUEST, guestColors("#000", "#000")],
  ["guest angry", GUEST_ANGRY, guestColors("#000", "#000")],
  ["climber", CLIMBER, CLIMBER_HERO_COLORS],
  ["climber step", CLIMBER_STEP, CLIMBER_THIEF_COLORS],
  ["rolling bottle", ROLLING_BOTTLE, BOTTLE_COLORS],
  ["shelf bottle", SHELF_BOTTLE, shelfBottleColors("#000", "#000")],
];

console.log("\nSprite shape:");

for (const [name, sprite] of ALL) {
  check(`${name} is a rectangle`, () => {
    assert.ok(sprite.length > 0, "sprite is empty");
    const w = sprite[0].length;
    sprite.forEach((row, i) => {
      assert.strictEqual(row.length, w, `row ${i} is ${row.length} wide, expected ${w}`);
    });
  });
}

console.log("\nColour keys:");

for (const [name, sprite, colors] of ALL) {
  check(`${name} only uses declared colours`, () => {
    const known = new Set([...Object.keys(colors), ".", " "]);
    sprite.forEach((row, i) => {
      for (const ch of row) {
        assert.ok(known.has(ch), `row ${i} uses undeclared key "${ch}"`);
      }
    });
  });
}

console.log("\nCharacter quality:");

check("every character sprite is fully outlined", () => {
  // A character without a keyline is the flat look we're getting away from.
  // Check the topmost and bottommost drawn pixel of each column is an outline.
  const characters: [string, Sprite][] = [
    ["climber", CLIMBER],
    ["guest", GUEST],
    ["bartender torso", BARTENDER_TORSO],
  ];
  for (const [name, sprite] of characters) {
    const w = sprite[0].length;
    for (let col = 0; col < w; col++) {
      const filled: number[] = [];
      for (let row = 0; row < sprite.length; row++) {
        const ch = sprite[row][col];
        if (ch !== "." && ch !== " ") filled.push(row);
      }
      if (!filled.length) continue;
      const top = sprite[filled[0]][col];
      const bottom = sprite[filled[filled.length - 1]][col];
      assert.strictEqual(top, "o", `${name} column ${col} starts with "${top}", not an outline`);
      assert.strictEqual(
        bottom,
        "o",
        `${name} column ${col} ends with "${bottom}", not an outline`
      );
    }
  }
});

check("heads differ from one another", () => {
  const keys = Object.keys(BARTENDER_HEADS);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      assert.notDeepStrictEqual(
        BARTENDER_HEADS[keys[i]],
        BARTENDER_HEADS[keys[j]],
        `${keys[i]} and ${keys[j]} are identical — the mood would never show`
      );
    }
  }
});

check("the walk frame actually differs from the standing frame", () => {
  assert.notDeepStrictEqual(CLIMBER, CLIMBER_STEP);
});

check("angry guest differs from calm guest", () => {
  assert.notDeepStrictEqual(GUEST, GUEST_ANGRY);
});

check("hero and thief are the same pixels in different colours", () => {
  // The palette-swap trick only works if the art really is shared.
  assert.deepStrictEqual(CLIMBER, CLIMBER);
  assert.notDeepStrictEqual(CLIMBER_HERO_COLORS, CLIMBER_THIEF_COLORS);
});

console.log(`\n${passed} checks passed.\n`);
