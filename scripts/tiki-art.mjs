#!/usr/bin/env node
// ─── Tiki Wars — art import ──────────────────────────────────────────────────
//
// Copies the owner's sprite sheets out of his working folder into
// public/popup/art/tiki/, doing the two things his export cannot:
//
//   1. CUT THE BACKGROUND OUT. His exports are flat RGB with no alpha — the
//      "transparency" checkerboard is baked in as real grey pixels, so dropped
//      in raw every character would render inside a grey checkered box. This
//      flood-fills inward from the border and makes the connected background
//      transparent. It works because the art has a heavy black outline: the
//      fill runs up to the outline and stops, so a white-and-silver bottle
//      keeps its highlights. A flat chroma colour (magenta) is handled too, for
//      future sheets.
//
//   2. STRAIGHTEN THE FRAMES. Within a sheet the character drifts sideways from
//      cell to cell — about 100px across four cells — which reads as a wobble.
//      Each frame is re-centred horizontally on its own pixel centroid.
//      VERTICAL position is left alone: the up-and-down in a walk cycle is the
//      bob, and removing it would make the walk look like a slide.
//
// Usage:  node scripts/tiki-art.mjs [--dry]

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// The whole Tiki Wars folder: Character Assets, Stage Assets, Shop Assets and
// whatever comes next. Rooting on one subfolder meant a new sibling folder was
// invisible until this line was edited.
const ROOT = path.join(os.homedir(), "Desktop", "Game Assets", "Tiki Wars");

/** ROOT and every folder beneath it — he reorganises, and art must not vanish. */
function srcDirs() {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    out.push(d);
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
    }
  };
  walk(ROOT);
  return out;
}
const DEST = path.join(process.cwd(), "public", "popup", "art", "tiki");

/**
 * His filename -> the name the game's sprite manifest looks for.
 *
 * Blockers are prefixed blk- and bosses boss-, which keeps them unambiguous:
 * there is both a cherry SOLDIER and a cherry BLOCKER, and they are different
 * characters with different frame counts.
 */
const MAP = {
  // ── Player: one 8-frame sheet PER WEAPON ──
  // Walk x4, Hit x2, Celebration, Sad. A whole sheet per gun rather than a
  // body plus arm overlays: nothing has to be aligned, and the old body had
  // pistols painted on, so an overlay left him holding two guns at once.
  "Helper Bottle.png": "helper.png",            // same 8-frame layout
  "Player Pistols.png": "player-pistols.png",
  "Player Shotgun.png": "player-shotgun.png",
  "Player Uzis.png": "player-uzi.png",
  "Player Flamethrower.png": "player-flame.png",
  "Player LAser.png": "player-laser.png",       // sic: his spelling
  "Player Turn .png": "player-turn.png",
  "Player Turn Shades.png": "player-turn-shades.png",

  // ── Stage scenery ──
  // One sky, one horizon, one ground texture and a handful of roadside props
  // per stage. The names on the right are what stages.ts asks for, so a whole
  // stage arrives without touching the game.
  "Beach Sky.png": "bg-beach-sky.png",
  "Beach Horizon.png": "bg-beach-horizon.png",
  "Beach Palm Tree.png": "prop-palm.png",
  "Beach Beachgoer 1.png": "prop-beachgoer-1.png",
  "Beach Beachgoer 2.png": "prop-beachgoer-2.png",
  "Beach Sand Textile.png": "tex-sand.png",

  "Desert Sky.png": "bg-desert-sky.png",
  "Desert Skyline.png": "bg-desert-horizon.png",
  "Desert Texture.png": "tex-desert.png",
  "Desert Cactus 1.png": "prop-cactus-1.png",
  "Desert Cactus 2.png": "prop-cactus-2.png",
  "Desert Coyote.png": "prop-coyote.png",

  "Winter SKy.png": "bg-winter-sky.png",      // sic: his capitalisation
  "Winter Horizon.png": "bg-winter-horizon.png",
  "Winter Texture.png": "tex-snow.png",
  "Winter Tree .png": "prop-pine.png",
  "Winter Elf.png": "prop-elf.png",
  "Winter Yeti.png": "prop-yeti.png",

  "Castle Sky.png": "bg-castle-sky.png",
  "Castle Horizon.png": "bg-castle-horizon.png",
  "Castle Texture.png": "tex-castle-ground.png",
  "Castle Battle Fence.png": "prop-battle-fence.png",

  // ── Effects ──
  // Drawn pointing RIGHT; the game fires up the screen, so these are rotated
  // on import rather than at every draw call. See ROTATE_CCW.
  "FX bullet.png": "fx-bullet.png",
  "FX Laser.png": "fx-laser.png",
  "FX Muzzle Flash.png": "fx-muzzle.png",
  "FX hit.png": "fx-impact.png",
  // The flame is the exception: it was drawn standing UP already, so it is the
  // one effect that must not be turned. See ROTATE_CCW.
  "FX Flame.png": "fx-flame.png",

  // ── Icons ──
  // Two arrived with a doubled extension; mapping by exact name means the
  // script tells us about anything unexpected rather than guessing.
  "icon-armor.png.png": "icon-armor.png",
  "icon-pistol.png.png": "icon-pistol.png",
  "icon-black-cat.png": "icon-black-cat.png",
  "icon-bomb.png": "icon-bomb.png",
  "icon-flamethrower.png": "icon-flame.png",
  "icon-money.png": "icon-money.png",
  "icon-poison.png": "icon-poison.png",
  "icon-rum-bottle.png": "icon-rum.png",
  "icon-shotgun.png": "icon-shotgun.png",
  "icon-uzi.png": "icon-uzi.png",
  "Luck Icon.png": "icon-clover.png",
  "Laser Icon.png": "icon-laser.png",

  // ── Intro, ending and marquee ──
  "Tiki Wars Logo.png": "logo-tiki-wars.png",
  "Intro 1.png": "intro-1.png",
  "Intro 2.png": "intro-2.png",
  "Intro 3.png": "intro-3.png",
  "Intro 4.png": "intro-4.png",
  "Ending Blimp.png": "ending-blimp.png",

  // ── Shop ──
  "Shop Booth.png": "shop-booth.png",
  "Shopkeeper-Scotch.png": "shopkeeper-scotch.png",
  "shopkeeper-scotch-happy.png": "shopkeeper-scotch-happy.png",

  // ── Soldiers: 4 frames, walk only ──
  "Lime Soldier Sheet.png": "lime.png",
  "Kiwi Soldier Sheet.png": "kiwi.png",
  "Lemon Solider.png": "lemon.png",             // sic: his spelling
  "Orange Soldier.png": "orange.png",
  "Cherry Soldier.png": "cherry.png",
  "Sugar Cube Soldier.png": "sugarcube.png",

  // ── Blockers: 5 frames, walk x4 + hit ──
  "Sugar Cane Blocker.png": "blk-sugarcane.png",
  "Worm Blocker.png": "blk-worm.png",
  "Mezcal Blocker.png": "blk-mezcal.png",
  "Cinnamon Blocker.png": "blk-cinnamon.png",
  "Coconut Blocker.png": "blk-coconut.png",
  "Grapefruit Blocker.png": "blk-grapefruit.png",
  "Candy Cane Blocker.png": "blk-candycane.png",
  "Milk Blocker.png": "blk-milk.png",
  "Beer Can Blocker.png": "blk-beercan.png",
  "Coconut Cream Blocker.png": "blk-coconutcream.png",
  "Ginger Beer Blocker.png": "blk-gingerbeer.png",
  "Cherry Blocker.png": "blk-cherry.png",
  "Almond Blocker.png": "blk-almond.png",
  "Blender Blocker.png": "blk-blender.png",

  // ── Bosses: 5 frames, walk x2 + attack x2 + hit ──
  "Baby Boss.png": "boss-baby.png",
  "Knight Boss.png": "boss-knight.png",
  "Santa Boss.png": "boss-santa.png",
  "King Boss.png": "boss-king.png",
};

/** Frame count by target name. */
function framesFor(name) {
  if (name.startsWith("blk-") || name.startsWith("boss-")) return 5;
  if (name === "helper.png") return 8;
  if (name === "fx-flame.png") return 6;
  if (name === "fx-muzzle.png" || name === "fx-impact.png") return 4;
  if (name === "fx-bullet.png" || name === "fx-laser.png") return 2;
  if (name.startsWith("player-") && name !== "player-turn.png" && name !== "player-turn-shades.png") return 8;
  if (["lime.png","kiwi.png","lemon.png","orange.png","cherry.png","sugarcube.png"].includes(name)) return 4;
  return 1;
}

/**
 * Sheets whose frames are LABELLED beneath each pose.
 *
 * The player sheets have "WALK 1", "HIT 2" and so on drawn into the image. That
 * is genuinely helpful for reading the sheet, and harmless — every one has the
 * captions in a band below the characters with a clear gap above it, so the
 * band is found and dropped on import rather than shipped into the game.
 */
const LABELLED = (name) =>
  (name.startsWith("player-") || name === "helper.png") && framesFor(name) > 1;

/**
 * Sheets delivered pointing RIGHT that the game draws pointing UP.
 *
 * Rotated once here rather than on every draw: the effects are blitted dozens
 * of times a frame, and a per-draw transform would also break the depth-bucket
 * cache, which keys on a flat blit.
 */
const ROTATE_CCW = {
  "fx-bullet.png": true, "fx-laser.png": true, "fx-muzzle.png": true,
  // The impact burst is radial, so it needs no turning.
};

/**
 * Full-bleed images: no background to cut, nothing to centre or crop.
 *
 * Every SKY and every ground TEXTURE, because both are drawn edge to edge —
 * a sky with its corners eaten shows black triangles, and a texture that has
 * been trimmed to its content no longer tiles. HORIZONS are not in here: they
 * arrive on magenta above the skyline precisely so the sky shows through.
 */
const FULLBLEED = {
  "bg-beach-sky.png": true, "bg-desert-sky.png": true,
  "bg-winter-sky.png": true, "bg-castle-sky.png": true,
  "tex-sand.png": true, "tex-desert.png": true,
  "tex-snow.png": true, "tex-castle-ground.png": true,
  "intro-1.png": true, "intro-2.png": true, "intro-3.png": true,
  "intro-4.png": true, "ending-blimp.png": true,
};



// ─── PNG ─────────────────────────────────────────────────────────────────────

function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (const b of buf) crc = t[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function readPNG(file) {
  const b = fs.readFileSync(file);
  let o = 8, ihdr = null; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString("ascii", o + 4, o + 8);
    const data = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    o += 12 + len;
  }
  if (ihdr.depth !== 8 || ihdr.interlace) throw new Error(`${file}: unsupported PNG`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr, stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, bb = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; }
      cur[x] = v & 0xff;
    }
  }
  // Normalise everything to RGBA so the rest of the tool has one shape to think about.
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const s = i * ch;
    if (ch === 4) { rgba[j] = out[s]; rgba[j+1] = out[s+1]; rgba[j+2] = out[s+2]; rgba[j+3] = out[s+3]; }
    else if (ch === 3) { rgba[j] = out[s]; rgba[j+1] = out[s+1]; rgba[j+2] = out[s+2]; rgba[j+3] = 255; }
    else if (ch === 2) { rgba[j] = rgba[j+1] = rgba[j+2] = out[s]; rgba[j+3] = out[s+1]; }
    else { rgba[j] = rgba[j+1] = rgba[j+2] = out[s]; rgba[j+3] = 255; }
  }
  return { w, h, data: rgba, hadAlpha: ch === 4 || ch === 2 };
}

function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    rgba.copy(raw, o, y * w * 4, (y + 1) * w * 4);
    o += w * 4;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

// ─── Background removal ──────────────────────────────────────────────────────

/**
 * Is this pixel part of the background?
 *
 * Two shapes are accepted. A CHECKERBOARD is light and unsaturated — the two
 * greys the export bakes in. A CHROMA key is a flat saturated colour, which is
 * what future sheets should use (magenta) because it can never be confused with
 * anything in the artwork.
 */
function bgTest(img) {
  // Sample the border to work out which we are dealing with.
  const { w, h, data } = img;
  let mag = 0, grey = 0, n = 0;
  const look = (x, y) => {
    const i = (y * w + x) * 4, r = data[i], g = data[i+1], b = data[i+2];
    n++;
    if (r > 150 && g < 110 && b > 150) mag++;
    else if (Math.max(r,g,b) - Math.min(r,g,b) < 26 && Math.max(r,g,b) > 200) grey++;
  };
  for (let x = 0; x < w; x += 4) { look(x, 0); look(x, h - 1); }
  for (let y = 0; y < h; y += 4) { look(0, y); look(w - 1, y); }

  // Chroma wins on ANY clear magenta presence, not a majority. A backdrop is
  // mostly picture: the beach horizon is half ocean, so magenta was only 56% of
  // its border and a 60% threshold sent it down the checkerboard path — which
  // matched nothing, and the magenta shipped as a bright band across the sky.
  if (mag > grey && mag / n > 0.15) {
    // Looser than "bright magenta": the edge between the key and the artwork is
    // a gradient, and a strict test walks the fill up to the first blended
    // pixel and stops, leaving a magenta rim all the way round. What identifies
    // the key is that GREEN is well below both red and blue — true of the pure
    // colour and of everything part-way blended into it.
    return {
      kind: "chroma",
      is: (r, g, b) => r > 95 && b > 95 && g < r - 45 && g < b - 45,
    };
  }
  return { kind: "checkerboard", is: (r, g, b) =>
    Math.max(r,g,b) - Math.min(r,g,b) < 26 && Math.max(r,g,b) > 196 };
}

/**
 * Flood fill the background from the border inward.
 *
 * Connected-from-the-edge, NOT a global colour match. That distinction is the
 * whole reason this is safe on a white-and-silver bottle: the interior
 * highlights are the same brightness as the checkerboard, but they are walled
 * off by the character's black outline, so the fill never reaches them.
 */
function cutBackground(img) {
  const { w, h, data } = img;
  const test = bgTest(img);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!test.is(data[i], data[i+1], data[i+2])) return;
    seen[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  let cut = 0;
  for (let p = 0; p < w * h; p++) if (seen[p]) { data[p * 4 + 3] = 0; cut++; }
  return { kind: test.kind, cut, total: w * h };
}

// ─── Frame extraction ────────────────────────────────────────────────────────
//
// The single most damaging thing this tool used to do.
//
// It assumed a sheet was a uniform grid: cut it into `frames` equal cells,
// measure each cell's centroid, and slide the cell's pixels so that centroid
// sat in the middle. Every part of that is wrong for the art actually being
// delivered, because THE FRAMES OVERLAP. The Baby boss winds a mace up over the
// frame to his left and swings it through the frame to his right; the hero's
// shotgun barrel pokes past the edge of every cell it is in.
//
// On a uniform cut that produced exactly the artefacts that were on screen:
//
//   * A frame lost whatever hung outside its cell — the boss's raised mace was
//     sliced down the middle, and the hero's barrel tip was cut off.
//   * The severed piece did not disappear. It stayed in the NEIGHBOURING cell,
//     so a walking boss dragged a disembodied chunk of somebody else's mace
//     across the screen beside him.
//   * The centroid used to centre a cell was measured over that mess, so the
//     alignment it computed was wrong as well.
//
// So frames are not cut by arithmetic here. The sheet is separated into blobs
// of touching pixels, the `frames` biggest and best separated of those are
// taken to be the character in each pose, every smaller blob (a spark, a
// detached star, a puff of dust) is given to whichever body it sits nearest,
// and each frame is then copied out PIXEL BY PIXEL — only the pixels belonging
// to that frame's own blobs. Content that overlaps a neighbour comes along;
// the neighbour's content stays behind. Nothing is ever cut.

/**
 * Label every blob of touching opaque pixels.
 *
 * Eight-way connectivity, because a diagonal line of pixels is one line to the
 * eye and this has to agree with the eye. The stack is an explicit array: a
 * character blob runs to tens of thousands of pixels and recursion blows the
 * JS stack well before that.
 */
function blobs(img, minAlpha = 24) {
  const { w, h, data } = img;
  const lab = new Int32Array(w * h).fill(-1);
  const out = [];
  const stack = [];
  for (let seed = 0; seed < w * h; seed++) {
    if (lab[seed] >= 0 || data[seed * 4 + 3] <= minAlpha) continue;
    const id = out.length;
    let minx = w, maxx = -1, miny = h, maxy = -1, count = 0;
    lab[seed] = id;
    stack.push(seed);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p - x) / w;
      count++;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (lab[q] < 0 && data[q * 4 + 3] > minAlpha) { lab[q] = id; stack.push(q); }
        }
      }
    }
    out.push({ id, minx, maxx, miny, maxy, count });
  }
  return { lab, list: out };
}

/**
 * Which blobs make up each frame, left to right.
 *
 * The bodies are picked by size, but with a spacing rule: a blob can only claim
 * a frame of its own if it stands clear of every body already claimed, by a
 * good fraction of the spacing the frames are laid out on. Without that rule a
 * character whose arm is drawn detached from its body would take two frames and
 * push a real pose off the end of the sheet.
 *
 * Everything left over goes to the nearest body, measured as the horizontal GAP
 * between the two blobs rather than between their centres — a long mace handle
 * has its centre nowhere near the fist holding it.
 */
function frameGroups(img, frames) {
  const { w } = img;
  const { lab, list } = blobs(img);
  if (list.length < frames) return null;

  const pitch = w / frames;
  const bySize = [...list].sort((a, b) => b.count - a.count);
  const bodies = [];
  for (const c of bySize) {
    if (bodies.length === frames) break;
    const mid = (c.minx + c.maxx) / 2;
    if (bodies.every((b) => Math.abs(mid - (b.minx + b.maxx) / 2) > pitch * 0.45)) bodies.push(c);
  }
  if (bodies.length < frames) return null;
  bodies.sort((a, b) => a.minx - b.minx);

  const groups = bodies.map((b) => ({ ids: new Set([b.id]), body: b }));
  const gapTo = (c, b) => (c.maxx < b.minx ? b.minx - c.maxx : c.minx > b.maxx ? c.minx - b.maxx : 0);
  for (const c of list) {
    if (bodies.includes(c)) continue;
    let best = 0, bestGap = Infinity;
    for (let i = 0; i < groups.length; i++) {
      const gap = gapTo(c, groups[i].body);
      if (gap < bestGap) { bestGap = gap; best = i; }
    }
    groups[best].ids.add(c.id);
  }

  for (const g of groups) {
    let minx = w, maxx = -1;
    for (const c of list) {
      if (!g.ids.has(c.id)) continue;
      if (c.minx < minx) minx = c.minx;
      if (c.maxx > maxx) maxx = c.maxx;
    }
    g.minx = minx;
    g.maxx = maxx;
    g.anchor = anchorX(img, lab, g.body);
  }
  return { lab, groups };
}

/**
 * The x the frame is registered on: the centre of the character's FEET.
 *
 * Not the centroid of the whole blob, which is what this tool used before. A
 * centroid is dragged around by whatever the pose is holding — the boss with
 * his mace up and out to one side has a centroid a long way from where he is
 * standing, so registering on it made him lurch sideways the moment he wound
 * up. What actually has to hold still between frames is the point he stands on,
 * and that is the bottom of the blob: two boots, or two bare feet, either side
 * of the body's axis.
 */
function anchorX(img, lab, body) {
  const { w, data } = img;
  const band = Math.max(2, Math.round((body.maxy - body.miny + 1) * 0.25));
  let sum = 0, n = 0;
  for (let y = body.maxy - band + 1; y <= body.maxy; y++) {
    for (let x = body.minx; x <= body.maxx; x++) {
      const p = y * w + x;
      if (lab[p] === body.id && data[p * 4 + 3] > 24) { sum += x; n++; }
    }
  }
  if (n >= 30) return sum / n;
  // Nothing to stand on — a pose drawn mid-air. Fall back to the whole blob.
  sum = 0; n = 0;
  for (let y = body.miny; y <= body.maxy; y++) {
    for (let x = body.minx; x <= body.maxx; x++) {
      const p = y * w + x;
      if (lab[p] === body.id) { sum += x; n++; }
    }
  }
  return n ? sum / n : (body.minx + body.maxx) / 2;
}

/**
 * Re-lay a sheet as a real uniform grid, one frame per cell, nothing clipped.
 *
 * The cell has to be wide enough for the WIDEST reach any frame makes from its
 * own anchor, so a cell is often mostly empty — the boss's swing is three times
 * the width of the boss. That costs nothing on screen: the game scales a sprite
 * by the HEIGHT of its cell, so the padding is transparent margin, not a
 * smaller character. It compresses to almost nothing in the PNG as well.
 *
 * Vertical position is left exactly as drawn. The rise and fall through a walk
 * cycle is the bob, and flattening it would turn the walk into a slide.
 */
function relayout(img, frames, pad = 6) {
  const { w, h, data } = img;
  const found = frameGroups(img, frames);
  if (!found) return null;
  const { lab, groups } = found;

  let half = 0;
  for (const g of groups) {
    half = Math.max(half, g.anchor - g.minx, g.maxx - g.anchor);
  }
  const cw = Math.ceil(half + pad) * 2;
  const outW = cw * frames;
  const out = Buffer.alloc(outW * h * 4);

  const shifts = [];
  for (let f = 0; f < frames; f++) {
    const g = groups[f];
    // Whole pixels only: a fractional shift would need resampling, and every
    // frame resampled independently is how a walk cycle starts shimmering.
    const shift = Math.round(f * cw + cw / 2 - g.anchor);
    shifts.push(shift - f * cw);
    for (let y = 0; y < h; y++) {
      for (let x = g.minx; x <= g.maxx; x++) {
        const p = y * w + x;
        // The pixel-by-pixel test that makes overlapping frames separable: a
        // pixel travels with the frame that OWNS it, not with the column it
        // happens to sit in.
        if (lab[p] < 0 || !g.ids.has(lab[p])) continue;
        const dx = x + shift;
        if (dx < f * cw || dx >= (f + 1) * cw) continue;
        const si = p * 4, di = (y * outW + dx) * 4;
        out[di] = data[si]; out[di+1] = data[si+1];
        out[di+2] = data[si+2]; out[di+3] = data[si+3];
      }
    }
  }
  return { w: outW, h, data: out, hadAlpha: true, shifts };
}

// ─── Rotation ────────────────────────────────────────────────────────────────

/**
 * Turn a right-facing sheet 90 degrees counter-clockwise so it faces up.
 *
 * Frames are rotated INDIVIDUALLY and re-laid left to right, so a horizontal
 * strip of n frames stays a horizontal strip of n frames — rotating the whole
 * image would stack them vertically and the grid would no longer describe it.
 */
function rotateCCW(img, frames) {
  const { w, h, data } = img;
  const cw = Math.floor(w / frames);
  const nw = h, nh = cw;                   // each cell's dimensions swap
  const outW = nw * frames;
  const out = Buffer.alloc(outW * nh * 4);

  for (let f = 0; f < frames; f++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < cw; x++) {
        // (x, y) in the cell becomes (y, cw-1-x) once turned left.
        const si = (y * w + f * cw + x) * 4;
        const di = ((cw - 1 - x) * outW + f * nw + y) * 4;
        out[di] = data[si]; out[di+1] = data[si+1];
        out[di+2] = data[si+2]; out[di+3] = data[si+3];
      }
    }
  }
  return { w: outW, h: nh, data: out, hadAlpha: true };
}

// ─── Chroma clean-up ─────────────────────────────────────────────────────────

/**
 * Kill magenta the flood fill could not reach.
 *
 * The fill only removes background CONNECTED to the border, which is the right
 * default — it is what stops a white highlight inside a bottle being eaten. But
 * it leaves any pocket the artwork encloses: between an arm and a body, inside
 * the crook of a weapon, through the gap in a letter. Those pockets are still
 * unmistakably the key colour, so they can be matched outright.
 *
 * Stricter than the fill's test, deliberately. This one ignores connectivity,
 * so it has to be certain — near-magenta artwork like the King's cloak must
 * survive it.
 */
function killStrayChroma(img) {
  const { w, h, data } = img;
  let cut = 0;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    if (data[j + 3] === 0) continue;
    const r = data[j], g = data[j + 1], b = data[j + 2];
    if (r > 155 && b > 155 && g < 105 && Math.abs(r - b) < 70) {
      data[j + 3] = 0;
      cut++;
    }
  }
  return cut;
}

/**
 * Pull the magenta cast out of the pixels that survived at the edge.
 *
 * Even a perfect cut leaves a rim one or two pixels wide where the artwork was
 * blended into the key before anyone thought about transparency. Left alone it
 * becomes a pink halo — and downscaling smears it inward, which is why it was
 * showing up on screen rather than staying a hairline.
 *
 * Only applied to pixels TOUCHING the cut, so genuinely purple artwork further
 * in is never altered. Where green sits below both red and blue, both are
 * brought down to meet it, which is the standard chroma despill.
 */
function despill(img, reach = 2) {
  const { w, h, data } = img;
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] !== 0) continue;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          near[ny * w + nx] = 1;
        }
      }
    }
  }
  let fixed = 0;
  for (let i = 0; i < w * h; i++) {
    if (!near[i]) continue;
    const j = i * 4;
    if (data[j + 3] === 0) continue;
    const r = data[j], g = data[j + 1], b = data[j + 2];
    const cast = Math.min(r, b) - g;
    if (cast > 10) {
      data[j] = Math.max(g, r - cast);
      data[j + 2] = Math.max(g, b - cast);
      fixed++;
    }
  }
  return fixed;
}

// ─── Caption band ────────────────────────────────────────────────────────────

/**
 * Erase a trailing band of content, which on these sheets is the frame labels.
 *
 * Detected structurally rather than by looking for text: the artwork forms one
 * run of non-empty rows, then a gap, then the captions form a second. Anything
 * after the first run is dropped. Colour would be the wrong test here — the
 * captions are white, and so is most of the hero.
 */
function dropCaptions(img) {
  const { w, h, data } = img;
  const rowHas = new Array(h).fill(false);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 2) {
      if (data[(y * w + x) * 4 + 3] > 24) { rowHas[y] = true; break; }
    }
  }
  const runs = []; let s2 = -1;
  for (let y = 0; y <= h; y++) {
    const on = y < h && rowHas[y];
    if (on && s2 < 0) s2 = y;
    else if (!on && s2 >= 0) { runs.push([s2, y - 1]); s2 = -1; }
  }
  if (runs.length < 2) return { img, cut: 0 };
  const from = runs[1][0];
  for (let y = from; y < h; y++) {
    for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = 0;
  }
  return { img, cut: h - from };
}

// ─── Trim ────────────────────────────────────────────────────────────────────

/**
 * Crop the dead margin off a sheet.
 *
 * The game sizes a sprite by the HEIGHT OF ITS CELL, so empty space inside the
 * cell shrinks the character: the hero filled 73% of his cell and the lime only
 * 52%, which is why the first import drew everyone far too small for the sizes
 * in the design doc.
 *
 * Cropping is done ONCE for the whole sheet, not per cell, and that matters:
 *   * VERTICALLY, the union of every frame is used, so the up-and-down bob of a
 *     walk cycle is preserved. Trimming each frame to its own feet would flatten
 *     the walk into a slide.
 *   * HORIZONTALLY, the widest frame sets the cell width and every cell keeps
 *     its centre, so the frames stay registered with each other.
 */
function trim(img, frames, pad = 4) {
  const { w, h, data } = img;
  const cw = Math.floor(w / frames);
  const A = (x, y) => data[(y * w + x) * 4 + 3];

  let top = h, bot = -1, halfW = 0;
  for (let f = 0; f < frames; f++) {
    const x0 = f * cw, mid = x0 + cw / 2;
    for (let y = 0; y < h; y++) {
      for (let x = x0; x < x0 + cw; x++) {
        if (A(x, y) > 24) {
          if (y < top) top = y;
          if (y > bot) bot = y;
          const d = Math.abs(x + 0.5 - mid);
          if (d > halfW) halfW = d;
        }
      }
    }
  }
  if (bot < 0) return img;

  top = Math.max(0, top - pad);
  bot = Math.min(h - 1, bot + pad);
  const newCW = Math.min(cw, Math.ceil((halfW + pad) * 2));
  const newH = bot - top + 1;
  const out = Buffer.alloc(newCW * frames * newH * 4);
  const outW = newCW * frames;

  for (let f = 0; f < frames; f++) {
    const srcMid = f * cw + cw / 2;
    const srcX0 = Math.round(srcMid - newCW / 2);
    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newCW; x++) {
        const sx = srcX0 + x, sy = top + y;
        if (sx < 0 || sx >= w) continue;
        const si = (sy * w + sx) * 4, di = (y * outW + f * newCW + x) * 4;
        out[di] = data[si]; out[di+1] = data[si+1]; out[di+2] = data[si+2]; out[di+3] = data[si+3];
      }
    }
  }
  return { w: outW, h: newH, data: out, hadAlpha: true };
}

// ─── Downscale ───────────────────────────────────────────────────────────────

/**
 * Target height for an imported sheet, in pixels.
 *
 * The biggest thing on screen is the hero at 84 logical px, which is 168 device
 * pixels at PIXEL_SCALE 2. The source art is 1536 tall — nine times more than
 * can ever be shown. Shipping that to a phone at a bar is megabytes of detail
 * the screen physically cannot render, so it is boxed down to roughly 1.7x the
 * largest size it will be drawn at, which is enough headroom for the runtime
 * depth-bucket resampling to stay crisp.
 */
const TARGET_H = 384;

/**
 * Target height per sprite, from the largest size it is ever drawn at.
 *
 * A single figure for everything wastes most of the download: a soldier is
 * drawn at 60 logical px (120 device) and a boss at 170 (340), so giving the
 * soldier the boss's resolution ships several times more detail than the screen
 * can show. Each is boxed to roughly 1.5x its own maximum instead.
 */
function targetHeight(name) {
  if (name.startsWith("boss-")) return 480;          // 226 logical -> 452 device
  if (name.startsWith("blk-")) return 320;           // 140 logical -> 280 device
  if (name.startsWith("player") || name === "helper.png") return 288;
  if (name.startsWith("bg-") || name.startsWith("tex-")) return 512;
  if (name.startsWith("shop")) return 448;
  // Icons read at ~34 logical px; 128 is ample and keeps them tiny.
  if (name.startsWith("icon-")) return 128;
  // The flame is the only effect big enough for detail; the rest are tiny.
  if (name === "fx-flame.png") return 512;
  if (name.startsWith("fx-")) return 192;
  // Story panels are letterboxed to roughly the screen width, so height buys
  // nothing past about twice what they are drawn at.
  if (name.startsWith("intro-") || name === "ending-blimp.png") return 560;
  if (name === "logo-tiki-wars.png") return 320;
  if (name.startsWith("prop-")) return 320;
  return 224;                                         // soldiers: 80 -> 160
}

/**
 * Box-filter downscale, averaging RGB WEIGHTED BY ALPHA.
 *
 * This weighting is the whole trick. Cutting the background leaves those pixels
 * transparent but their RGB still holds the old checkerboard grey. A naive
 * average would pull that grey into every edge and ring each character with a
 * pale halo. Weighting by alpha means fully transparent pixels contribute
 * nothing at all to the colour.
 */
function downscale(img, targetH, maxW = Infinity, frames = 1) {
  const { w, h, data } = img;
  // Backdrops are very wide and short, so height alone never caps them: the
  // beach horizon came out 1774px across for a 540px screen. Whichever limit
  // bites first wins.
  const scale = Math.min(targetH / h, maxW / w, 1);
  if (scale >= 1) return img;
  // The width lands on a WHOLE number of cells. The game finds a frame by
  // dividing the image width by the column count, so a sheet whose width does
  // not divide leaves every cell boundary a fraction of a pixel out — and each
  // frame is then resampled off a fractional source rectangle, which smears a
  // sliver of the next frame into the edge of this one.
  const nh = Math.max(1, Math.round(h * scale));
  const cell = Math.max(1, Math.round((w / frames) * scale));
  const nw = cell * frames;
  const out = Buffer.alloc(nw * nh * 4);

  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor((y * h) / nh), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / nh));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor((x * w) / nw), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / nw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * w + sx) * 4, al = data[i + 3];
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al;
          a += al; n++;
        }
      }
      const di = (y * nw + x) * 4;
      if (a > 0) { out[di] = Math.round(r / a); out[di+1] = Math.round(g / a); out[di+2] = Math.round(b / a); }
      out[di + 3] = Math.round(a / n);
    }
  }
  return { w: nw, h: nh, data: out, hadAlpha: true };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const dry = process.argv.includes("--dry");
fs.mkdirSync(DEST, { recursive: true });

/**
 * A source name with any .png dropped.
 *
 * Several files arrive with NO EXTENSION at all — an export saved straight out
 * of a chat window keeps the title and loses the suffix, so "Castle Sky" and
 * "FX Flame" landed beside "Castle Horizon.png". They are PNGs; only the name
 * is short. Matching on the stem means a missing suffix costs nothing, which
 * matters because the old exact-name lookup skipped them in total silence and
 * the flame and two whole skies simply never reached the game.
 */
function stem(name) {
  return name.replace(/\.png$/i, "");
}

/**
 * Every source file, indexed by name AND by stem.
 *
 * Built once — srcDirs() walks the whole tree, and the old find() walked it
 * again for each of ninety entries.
 */
let index = null;
function sources() {
  if (index) return index;
  index = new Map();
  const files = [];
  for (const d of srcDirs()) {
    for (const f of fs.readdirSync(d)) {
      if (f.startsWith(".")) continue;
      const p = path.join(d, f);
      if (fs.statSync(p).isFile()) files.push([f, p]);
    }
  }
  // Exact names first, stems second, so a real "X.png" is never shadowed by a
  // stray "X" sitting in another folder.
  for (const [f, p] of files) if (!index.has(f)) index.set(f, p);
  for (const [f, p] of files) {
    const st = stem(f);
    if (!index.has(st)) index.set(st, p);
  }
  return index;
}

/** Look for a source file in every folder he uses, extension or not. */
function find(name) {
  return sources().get(name) ?? sources().get(stem(name)) ?? null;
}

// Anything sitting in his folders that this script does not know about is
// almost certainly art that will silently never appear in the game. Compared on
// STEMS, so this reports a genuinely unmapped file rather than every file whose
// extension went missing.
const known = new Set(Object.keys(MAP).map(stem));
const claimed = new Set();
for (const name of Object.keys(MAP)) {
  const p = find(name);
  if (p) claimed.add(p);
}
for (const d of srcDirs()) {
  for (const f of fs.readdirSync(d)) {
    if (f.startsWith(".")) continue;
    const p = path.join(d, f);
    if (!fs.statSync(p).isFile()) continue;
    if (known.has(stem(f)) || claimed.has(p)) continue;
    // Read the signature rather than trusting the name — that is the whole
    // point here, since the names are what cannot be trusted.
    const head = Buffer.alloc(8);
    const fd = fs.openSync(p, "r");
    fs.readSync(fd, head, 0, 8, 0);
    fs.closeSync(fd);
    if (head[0] === 0x89 && head.toString("ascii", 1, 4) === "PNG") {
      console.log(`  UNMAPPED  ${f}  <- in ${path.basename(d)}/, not imported`);
    }
  }
}

let done = 0;
for (const [from, to] of Object.entries(MAP)) {
  const src = find(from);
  if (!src) { console.log(`  skip  ${from}  (not found)`); continue; }

  const img = readPNG(src);
  const full = FULLBLEED[to];
  const cutInfo = full
    ? { kind: "full-bleed", cut: 0 }
    : img.hadAlpha ? { kind: "already had alpha", cut: 0 } : cutBackground(img);
  // Clean up before anything resamples: downscaling averages neighbours, so a
  // rim left here is smeared inward rather than staying a hairline.
  let strays = 0;
  let despilled = 0;
  if (!full) {
    strays = killStrayChroma(img);
    despilled = despill(img);
  }
  let captions = 0;
  if (LABELLED(to)) ({ cut: captions } = dropCaptions(img));

  let rotated = false;
  if (ROTATE_CCW[to]) {
    const r = rotateCCW(img, framesFor(to));
    img.w = r.w; img.h = r.h; img.data = r.data;
    rotated = true;
  }
  let shifts = null;
  // Re-lay the frames BEFORE downscaling, so blobs are separated and registered
  // at full resolution rather than off a picture that has already lost detail.
  const nFrames = framesFor(to);
  if (nFrames > 1 && !full) {
    const laid = relayout(img, nFrames);
    if (laid) {
      img.w = laid.w; img.h = laid.h; img.data = laid.data;
      shifts = laid.shifts;
    } else {
      // Not separable into the expected number of poses. Left exactly as
      // delivered rather than guessed at: a sheet that arrives in some other
      // shape should show up as an obvious problem here, not as a character
      // that is subtly wrong in the game.
      console.log(`  WARNING  ${to}: could not separate ${nFrames} frames — imported uncut`);
    }
  }

  const srcW = img.w, srcH = img.h;
  // Weapon overlays are NOT trimmed: they have to keep the same framing as the
  // body they sit on top of, and cropping them to their own content would slide
  // the arms off the character.
  const trimmed = full ? img : trim(img, nFrames);
  // 1080 = twice the 540px device width the game ever draws into.
  const small = downscale(trimmed, targetHeight(to), to.startsWith("bg-") ? 1080 : Infinity, full ? 1 : nFrames);

  if (!dry) writePNG(path.join(DEST, to), small.w, small.h, small.data);
  done++;
  const bytes = dry ? 0 : fs.statSync(path.join(DEST, to)).size;
  console.log(
    `  ${to.padEnd(24)} ${srcW}x${srcH} -> ${small.w}x${small.h}` +
    (full ? "  [full-bleed]" : "") +
    (captions ? `  captions -${captions}px` : "") +
    (rotated ? "  rotated" : "") +
    (strays ? `  strays -${strays}` : "") +
    (despilled ? `  despill ${despilled}` : "") +
    `  bg:${cutInfo.kind}` +
    (shifts ? `  re-laid [${shifts.join(", ")}]px` : "") +
    (bytes ? `  ${(bytes / 1024).toFixed(0)}KB` : "")
  );
}
console.log(`\n${done} file(s)${dry ? " (dry run — nothing written)" : ` -> ${path.relative(process.cwd(), DEST)}`}`);
