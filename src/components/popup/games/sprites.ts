// ─── Character sprites ───────────────────────────────────────────────────────
//
// Hand-placed pixel art in the style of the era: every character carries a hard
// black outline, skin and cloth each get a shadow tone, and silhouettes are
// shaped rather than stacked out of rectangles. That outline is most of what
// separates a Donkey Kong or Punch-Out!! sprite from a flat vector shape.
//
// Characters are built from parts — head, torso, arms — so a pose is a matter
// of where the arms go rather than a whole new character. Variants are done by
// PALETTE SWAP wherever possible, which is exactly how the originals squeezed a
// roster out of a tiny ROM: same pixels, different colours.
//
// Every sprite must be a rectangle of equal-length rows using only declared
// colour keys. __tests__/sprites.test.ts enforces both — hand-authored art is
// easy to typo and a ragged row silently shears the drawing.
//
// Key legend, shared across this file:
//   o outline    s skin       S skin shadow   e eye white
//   h hair       H hair shine m moustache     M mouth
//   v cloth      V cloth hi   w shirt         W shirt shadow
//   r accent     g metal      G metal shadow  b trousers
//   B shoe       c cap        f fill          d dark fill

import type { Sprite } from "./arcade";
import { P } from "./arcade";

// ═══ Bartender ═══════════════════════════════════════════════════════════════
// Head and torso are separate so expression and pose vary independently.
// Head: 20 x 14. Torso: 20 x 12, drawn directly beneath.

const HEAD_TOP = [
  ".....oooooooo.......",
  "....ohhhhhhhho......",
  "...ohhhhhhhhhho.....",
  "...ohHhhhhhhhho.....",
  "...osssssssssso.....",
  "...osssssssssso.....",
];

const HEAD_BOTTOM = [
  "...osssssssssso.....",
  "...osmmmmmmmmso.....",
  "...osmmmmmmmmso.....",
];

const HEAD_CHIN = ["....oSSSSSSSSo......", ".....oooooooo......."];

const EYES = {
  normal: "osoosssoosso",
  closed: "osssssssssso",
  wide_a: "oseessseesso",
  wide_b: "osoesssoesso",
};

const MOUTH = {
  flat: "osssMMMMssso",
  smile: "osMMMMMMMMso",
  frown: "ossMMMMMMsso",
};

const pad = (mid: string) => `...${mid}.....`;

function buildHead(eyeA: string, eyeB: string, mouth: string): Sprite {
  return [
    ...HEAD_TOP,
    pad(eyeA),
    pad(eyeB),
    ...HEAD_BOTTOM,
    pad(mouth),
    ...HEAD_CHIN,
  ];
}

export const BARTENDER_HEADS: Record<string, Sprite> = {
  // Squinting with a broad grin — the drink landed.
  happy: buildHead(EYES.closed, EYES.normal, MOUTH.smile),
  ok: buildHead(EYES.normal, EYES.normal, MOUTH.flat),
  worried: buildHead(EYES.normal, EYES.closed, MOUTH.frown),
  // Whites of the eyes showing. Two rows of pupil so they read as saucers.
  panic: buildHead(EYES.wide_a, EYES.wide_b, MOUTH.frown),
};

/** Torso only — arms are drawn separately so poses don't need a second body. */
export const BARTENDER_TORSO: Sprite = [
  // Collar is solid outline and spans the full shoulder width: nothing beneath
  // may present a bare edge to the background, or the figure reads as a flat
  // cut-out instead of a drawn character.
  "....oooooooooooo....",
  "..oovvvvwwwwvvvvoo..",
  "..ovvvvvwrrwvvvvvo..",
  "..ovvvvvwwwwvvvvvo..",
  "..ovvvvvwwwwvvvvvo..",
  "..ovvvvvwwwwvvvvvo..",
  "..ovvvvvwwwwvvvvvo..",
  "..ovvvvvwwwwvvvvvo..",
  "..ovvvvvwwwwvvvvvo..",
  "..ovvvvvvvvvvvvvvo..",
  "..ovvvvvvvvvvvvvvo..",
  "..oooooooooooooooo..",
];

/** A sleeved arm, 4 x 9. Drawn at whatever angle the pose calls for. */
export const ARM: Sprite = [
  ".oo.",
  "ovvo",
  "ovvo",
  "ovvo",
  "osso",
  "osso",
  "oSso",
  "oSso",
  ".oo.",
];

export const BARTENDER_COLORS: Record<string, string> = {
  o: "#100810",
  s: P.skin,
  S: "#C98A62",
  h: "#3A2010",
  H: "#5A3520",
  m: "#3A2010",
  M: "#8B2020",
  e: P.white,
  v: "#26263A",
  V: "#3A3A55",
  w: P.bone,
  W: "#B0B0A0",
  r: P.red,
};

// ═══ Shaker tin ══════════════════════════════════════════════════════════════

export const TIN: Sprite = [
  "..oooooooo..",
  ".oggggggggo.",
  ".oggggggggo.",
  "..oooooooo..",
  ".oGggggggGo.",
  ".oGggggggGo.",
  ".oGggggggGo.",
  ".oGggggggGo.",
  ".oGggggggGo.",
  ".oGggggggGo.",
  ".oGggggggGo.",
  ".oGggggggGo.",
  "..oggggggo..",
  "..oggggggo..",
  "..oooooooo..",
];

export const TIN_COLORS: Record<string, string> = {
  o: "#100810",
  g: "#D8D8E0",
  G: "#8890A0",
};

// ═══ Bar guest ═══════════════════════════════════════════════════════════════
// 14 x 16, cut off at the bar top.

export const GUEST: Sprite = [
  "....oooooo....",
  "...ohhhhhho...",
  "..osssssssso..",
  "..osssssssso..",
  "..osoosoosso..",
  "..osssssssso..",
  "..ossMMMMsso..",
  "...oSSSSSSo...",
  "..oofffffoo...",
  ".offfffffffo..",
  ".offfffffffo..",
  ".oFfffffffFo..",
  ".offfffffffo..",
  ".offfffffffo..",
  ".ooooooooooo..",
  "..............",
];

/** Angry: brows drop over the eyes and the mouth opens to shout. */
export const GUEST_ANGRY: Sprite = GUEST.map((row, i) =>
  i === 4 ? "..osooosooso.." : i === 6 ? "..osMMMMMMso.." : row
);

export const guestColors = (shirt: string, shirtShadow: string): Record<string, string> => ({
  o: "#100810",
  s: P.skin,
  S: "#C98A62",
  h: "#20180F",
  M: "#8B2020",
  f: shirt,
  F: shirtShadow,
});

// ═══ Top Shelf climber ═══════════════════════════════════════════════════════
// 14 x 18. The thief is the same pixels in different colours — palette swapping
// a single sprite is how the originals got a cast out of almost no memory.

export const CLIMBER: Sprite = [
  "....oooooo....",
  "...occcccco...",
  "..occcccccco..",
  "..osssssssso..",
  "..ossooossso..",
  "..osssssssso..",
  "..osmmmmmsso..",
  "...oSSSSSSo...",
  "..oorrrrrroo..",
  ".osrrrrrrrrso.",
  ".osrrrrrrrrso.",
  ".oSrrrrrrrrSo.",
  "..obbbbbbbbo..",
  "..obbbbbbbbo..",
  "..obbboobbbo..",
  "..obbboobbbo..",
  "..ooBBooBBoo..",
  "..oooo..oooo..",
];

/** Mid-stride: legs swap so walking reads at a glance. */
export const CLIMBER_STEP: Sprite = CLIMBER.map((row, i) =>
  i === 14 || i === 15 ? "..oobbbbbboo.." : i === 16 ? "..oBBooooBBo.." : row
);

export const climberColors = (
  cap: string,
  shirt: string,
  shirtShadow: string,
  trousers: string
): Record<string, string> => ({
  o: "#100810",
  c: cap,
  s: P.skin,
  S: "#C98A62",
  m: "#3A2010",
  r: shirt,
  R: shirtShadow,
  b: trousers,
  B: "#6B4020",
});

/** The bartender chasing him: red cap, blue overalls. */
export const CLIMBER_HERO_COLORS = climberColors(P.red, P.red, "#A01818", "#2038EC");
/** The thief: purple hat, magenta coat — reads instantly as the other guy. */
export const CLIMBER_THIEF_COLORS = climberColors(P.purple, P.magenta, "#A02890", "#3A1A5A");

// ═══ Rolling bottle ══════════════════════════════════════════════════════════
// 10 x 10, outlined so it stays legible against a busy shelf.

export const ROLLING_BOTTLE: Sprite = [
  "..oooooo..",
  ".ollllllo.",
  "ollggggllo",
  "olgggggglo",
  "olgggggglo",
  "olgggggglo",
  "olgggggglo",
  "ollggggllo",
  ".ollllllo.",
  "..oooooo..",
];

export const BOTTLE_COLORS: Record<string, string> = {
  o: "#100810",
  g: P.green,
  l: "#00701F",
};

// ═══ Shelf bottle (scenery) ══════════════════════════════════════════════════

export const SHELF_BOTTLE: Sprite = [
  ".oo.",
  "occo",
  "occo",
  "offo",
  "offo",
  "offo",
  "offo",
  "offo",
  "offo",
  "oFFo",
  "oFFo",
  ".oo.",
];

export const shelfBottleColors = (body: string, shade: string): Record<string, string> => ({
  o: "#100810",
  c: "#909098",
  f: body,
  F: shade,
});
