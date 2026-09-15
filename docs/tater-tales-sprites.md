# Tater Tales — sprite sheet spec

Every image the game needs, with the grid and the frame-by-frame poses.

**To make the art, use [`tater-tales-prompts.md`](./tater-tales-prompts.md)** —
the finished, copy-paste ChatGPT prompts. This file is the reasoning behind them.

**Look and feel: early-80s arcade** — Donkey Kong, Ice Climbers, Bubble Bobble.
Chunky square pixels, flat bright colours on dark backgrounds, stages built from
repeating blocks with walls up both sides, the score across the top. Elmer climbs
**up** the screen the way Popo climbs the mountain in Ice Climbers.

The v1 character grid
(`~/Documents/ChatGPT/Tater Tales Sprites f/tater-tales-character-grid-v1.png`)
was drawn in a 3D-rendered Sega Saturn style. **Its designs carry over** —
shapes, colours, labels, faces — but everyone is redrawn as pixel sprites in v2.

---

## Part 1 — Rules for everything

### The one habit that keeps everything consistent

**Attach `character-grid.png` to every generation** and start the
prompt with *"Match the attached character grid exactly."* Until v2 exists,
attach v1 and say *"same character designs, redrawn as arcade pixel sprites."*

### Style contract

Paste this at the top of every prompt:

> STYLE IS CRITICAL: 1981–1986 arcade pixel art, exactly like Donkey Kong, Ice
> Climbers and Bubble Bobble. Everything is built from big, clearly visible
> square pixels on a strict grid, as if drawn at tiny size and enlarged with
> nearest-neighbour. Flat solid colours — about 4 to 6 colours per character
> plus a 1-pixel very dark outline. No gradients, no soft shading, no
> anti-aliasing, no blur, no 3D rendering, no painterly texture, no modern
> "HD pixel art" detail. Simple bold shapes that read instantly when tiny. Eyes
> are 2–3 pixels. Bright saturated arcade colours. Straight front or straight
> side views only.

**The size test:** each character is meant to be about **28 pixels tall** in the
game. In the sheets it's drawn big, but it should look like a 28-pixel sprite
blown up — you should be able to count the pixels. If it looks too detailed to
be 28 pixels, it's wrong.

### Colours

| | Colour | Rule |
|---|---|---|
| Sheet background | **`#FF00FF` magenta** | Perfectly flat. No gradient, texture, checkerboard or shadow. |
| Grid lines | **`#00FF00` bright green** | Straight, continuous, thin (about 4 px), plus an outer border. Equal cells. |
| **Banned in sprites** | magenta, hot pink, pink-purple, neon green | They get keyed out and leave holes. |
| Allowed | dark green, bottle green, yellow-green, deep purple, orange-red | Gin, Chartreuse, Malort and the Brandy label are fine. |

Cutscenes are the exception — they're full pictures, not cut-outs, and can use
any colour.

### Things that ruin a cut-out

* **No glows, mist, halos or shadows** on magenta. Anything soft leaves a pink
  fringe.
* **Soda spray, bubbles, dust and sparkles are solid pixel shapes** with an
  outline — like Bubble Bobble's bubbles.
* **No ground under characters** (except the tile sheets).
* **Nothing crosses a green line.** Every pose stays inside its cell with a
  margin.

### No words in the art

Allowed: the name labels on the character grid, the logo, and tiny printed
labels on bottles and shirts ("BOURBON", "COLA").

**All dialogue and captions are drawn by the game** in an arcade pixel font —
"Help me", "You don't belong with this riff raff!", "Thank you", "Good luck",
every cutscene line, and the score bar. Image generators misspell words, and
text in a picture can't be changed. Draw the character *talking* (mouth open,
gesturing) and leave the words to code.

### Animation rules

* **Every animation sheet is the same grid: 6 columns × 4 rows, 1536 × 1024,
  square cells.** One row = one animation, frames read left to right.
* **Animate in place.** Don't move the character across the cell to show them
  flying or jumping — the game moves them. Only the pose changes.
* **Feet on the same line** in every cell of a row, same size in every frame.
  If Elmer grows or drifts between frames, he jitters in game.
* **Draw movement facing RIGHT.** The game mirrors for left.
* **Looping rows:** frame 6 flows back into frame 1.
* **"Bleeds into" rows:** the last frame is nearly identical to the first frame
  of the next row.
* **Don't rotate pixel art.** Arcade games drew each angle separately, because a
  rotated pixel sprite goes jagged and blurry. Where a sprite points in
  different directions (flying, the aim arrow) each angle gets its own cell.

### Sizes in the game

The game screen is **256 pixels wide** — the same as Ice Climbers — and as tall
as the phone needs. Draw at any size; the import shrinks each sprite to these.

| Character | In-game size (pixels) |
|---|---|
| Elmer | 18 × 28 |
| Mixey and all mixer pets | 16 × 12 |
| Allie Cated, Alistaire | 14 × 32 |
| Johnny, Guillermo, Rum, Malort, Chartreuse | 16 × 28–30 |
| Brandy | 18 × 24 |
| **Mr. Tater** | **56 × 72** |

Where characters share a cell, keep these proportions.

---

## Part 2 — The images

| # | File | Grid | Size | Contents |
|---|---|---|---|---|
| 1 | `character-grid.png` | 4 × 4 | 1024 × 1024 | Whole cast, pixel style |
| 2 | `cutscene-01.png` … `cutscene-23.png` | **single** | 1024 × 1536 each | Intro story, one per screen |
| 3 | `title.png` | single | 1024 × 1536 | Title screen scene |
| 4 | `logo-tater-tales.png` | single | 1536 × 1024 | Logo on magenta |
| 5 | `anim-elmer-launch.png` | 6 × 4 | 1536 × 1024 | Rows A B C D |
| 6 | `anim-elmer-fall.png` | 6 × 4 | 1536 × 1024 | Rows E F + Guillermo + Elmer reacts |
| 7 | `anim-tater.png` | 6 × 4 | 1536 × 1024 | Rows G H I J |
| 8 | `anim-thanks-1.png` | 6 × 4 | 1536 × 1024 | Rows K L M N |
| 9 | `anim-thanks-2.png` | 6 × 4 | 1536 × 1024 | Rows O P Q + mixer pets |
| 10 | `anim-finale.png` | 6 × 4 | 1536 × 1024 | Rows R S T U — the rescue (lap 1) |
| 10b | `anim-finale-2.png` | 6 × 4 | 1536 × 1024 | Rows R2 T2 V W — laps 2 and up |
| 11 | `ui.png` | 6 × 2 | 1536 × 1024 | Aim arrow angles, carbonation gauge, icons |
| 12 | `tiles-shelf.png` … `tiles-summit.png` | 3 × 3 each | 1024 × 1024 | Stage blocks, one sheet per zone (9) |

No painted backgrounds — see *Stages*. That's what the reference games do, and
it removes 20 images.

---

### Sheet 1 — Character grid v2

Redraw v1 as arcade pixel sprites, one character per cell, filling most of the
cell, with a small white pixel-font name under each. Same designs as v1, with
these changes:

**1. Every mixer is a fizzy soda can or mini mixer bottle that behaves like an
animal.** "Fizzy drink" first, "pet" second, never a little person.

* The can or stubby bottle **is the body**, lying lengthways like an animal's
  torso, with the pull tab or cap at the head end.
* **Fizz on every one:** bubbles popping from the tab or cap, a bright soda label.
* **Animal, not human:** four short legs, ears, a tail, an animal face. No arms
  or hands, never on two legs.

| Cell | Look |
|---|---|
| Mixey | Red cola can puppy, as in v1. |
| Sodey | Silver-and-white club soda can cat — pointy ears, curled tail, green collar. |
| Cola Pet | Tiny dark-brown glass cola bottle puppy, cap for a nose, red label. Must not look like Mixey. |
| Ginger Pet | Short copper-orange ginger beer can puppy with a spiky ginger-root tuft. |
| Tonic Pet | Slim pale-blue tonic can kitten with a lime-wedge collar charm. |

**2. Koriko is cut.** His cell becomes **Elmer holding Mixey** — Elmer standing,
Mixey tucked under one arm, tab pointing down. Most of the animation uses this
hold.

**Prompt (attach v1):**

> [STYLE CONTRACT]. Redraw this Tater Tales character grid as 1980s arcade pixel
> sprites. Keep the same 4 × 4 layout, flat magenta #FF00FF background, thin
> straight green #00FF00 grid lines, and a small white pixel-font name under each
> character. Keep every character's design, colours, labels and personality from
> the attached image, but as simple chunky sprites about 28 pixels tall
> enlarged to fill each cell. Changes: SODEY — silver-and-white club soda can
> cat with pointed ears, curled tail, green collar, four legs. COLA PET — tiny
> dark-brown glass cola bottle puppy, cap as nose, red label, four legs. GINGER
> PET — short copper-orange ginger beer can puppy with a spiky ginger-root tuft,
> four legs. TONIC PET — slim pale-blue tonic can kitten with a lime-wedge collar
> charm, four legs. All mixers read as fizzy drinks first (tabs or caps, bubbles
> popping out, bright labels) and are animals, not people: four legs, no arms.
> Replace KORIKO with "ELMER + MIXEY": Elmer standing with Mixey tucked under
> one arm, pull tab pointing down.

---

### Stages — how a level is built

Like Ice Climbers, the stage is assembled by the game from small **blocks**, not
painted as a picture:

```
 ┌──────────────────────────────┐
 │ 1UP 004210  HI 050000   L=01 │  ← score bar, drawn by code
 ├───┬──────────────────────┬───┤
 │▓▓▓│                      │▓▓▓│
 │▓7▓│   ▀▀▀▀▀▀      ▀▀▀▀▀▀▀│▓7▓│  ← platforms: rows of blocks
 │▓▓▓│                      │▓▓▓│
 │▓▓▓│        ▀▀▀▀▀▀▀▀      │▓▓▓│
 │▓6▓│  ▀▀▀▀                │▓6▓│  ← walls up both sides, with height signs
 │▓▓▓│            Elmer     │▓▓▓│
 │▓▓▓│  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀│▓▓▓│
 └───┴──────────────────────┴───┘
```

* **Background:** one flat colour per zone (mostly black or very dark), with a
  few small decorations scattered by the game — stars, a distant bottle, a bird.
* **Walls** run up both sides. Elmer bounces off them. The game mirrors the left
  wall for the right.
* **Platforms** are rows of blocks: a left end, middle blocks repeated to any
  length, and a right end.
* **Height signs** on the walls every so often; the game writes the number.
* **Zone changes are a hard cut**, the way Ice Climbers goes straight from brown
  rock to blue ice. No transition art.

### Sheets 12 — Zone tile sheets (9 sheets, 3 × 3 each)

**Every zone uses the same layout**, magenta background:

| | Column 1 | Column 2 | Column 3 |
|---|---|---|---|
| **Row 1** | Platform **left end** | Platform **middle** | Platform **right end** |
| **Row 2** | Platform middle **variant** | **Wall** block | Wall block **variant** |
| **Row 3** | Wall block with a **blank sign** | Decoration A | Decoration B |

* **Platform blocks are 2 wide : 1 tall** (16 × 8 pixels in game). Draw them
  filling the cell's width, in the **top half** of the cell.
* **Middle blocks must tile:** the left edge continues into the right edge, and
  both ends join the middle cleanly.
* **Wall blocks are 3 wide : 2 tall** (24 × 16 pixels) and must tile
  **vertically** — the top edge continues into the bottom edge. The inner (right)
  edge is the face Elmer bounces off.
* **The sign** is a wall block with a small dark plaque, **left blank**.
* **Decorations** are small (up to 32 × 32 pixels) and sit on the background
  colour, so draw them dim enough not to be mistaken for platforms.
* Ice-Climbers-style checker dithering is welcome on walls and rock.

| File | Background colour (code) | Platform | Wall | Decoration A / B |
|---|---|---|---|---|
| `tiles-shelf.png` | black | Dark bourbon-barrel wood plank with brass nail heads | Side of a tall wooden bottle shelf, dusty bottle silhouettes in its cubbies | Cobweb / dim distant bottle |
| `tiles-sky.png` | arcade sky blue | White puffy cloud blocks with a light-blue underside | Tater's wooden shelf upright climbing into the sky, a vine wrapped round it | Small bird / little cloud |
| `tiles-space.png` | black | Orange-red riveted steel girder (a nod to Donkey Kong) | Grey steel scaffold tower with cross-bracing | Star cluster / tiny ringed planet |
| `tiles-moon.png` | black | Grey moon-rock blocks with small craters | Grey cratered cliff face | Planet Earth / little flag |
| `tiles-mars.png` | very dark red-brown | Rust-red rock blocks | Red canyon cliff, dithered | Small rover / dust swirl |
| `tiles-pluto.png` | dark navy | Pale-blue ice bricks, like Ice Climbers | Icy cliff with white snow ledges | Hanging icicles / tiny distant sun |
| `tiles-ship.png` | dark purple-grey | Silver metal panel with a row of yellow lights | Riveted hull with a round porthole | Blinking console / little alien peeking |
| `tiles-heaven.png` | pale gold | White cloud block with gold trim | White marble column with gold bands | Harp / small winged cherub-cloud |
| `tiles-summit.png` | pale gold | **Solid gold bricks** | Pearly-gate pillar | **Tater's display cabinet** full of rare bottles / the pearly gates |

The **space** zone appears five times, so it's drawn once. The bottom of the
game is a full-width floor of shelf blocks, with Guillermo standing on it.

**Prompt:**

> [STYLE CONTRACT]. A tile sheet for a vertical-climbing arcade game, 1024 × 1024,
> 3 × 3 equal cells, flat magenta #FF00FF background, thin straight green
> #00FF00 lines. Zone: [zone]. Row 1: platform left end, platform middle,
> platform right end — each a 2:1 block filling the cell width in the top half,
> middle block tiles seamlessly left-to-right. Row 2: platform middle variant;
> a wall block (3:2) that tiles seamlessly top-to-bottom; a wall block variant.
> Row 3: the wall block with a small blank dark sign; decoration [A];
> decoration [B]. Platform: [platform]. Wall: [wall]. Chunky pixels, like Ice
> Climbers and Donkey Kong. No text.

---

### Cutscenes — full phone screen

**Each cutscene is its own image, 1024 × 1536 portrait**, so it can fill the
phone. A grid would shrink them too small.

They have to look like **the same game as the gameplay** — like the Donkey Kong
intermission where Kong climbs the girders, or Bubble Bobble's story screens.
Same pixel sprites (close-ups show a sprite blown up bigger, still in chunky
pixels), dark or black backgrounds, scenery built from simple blocky shapes.
Not illustrations.

**Making it fit every phone.** Phones are taller than 1024 × 1536, and the exact
shape varies. So:

* **The top 128 and bottom 128 pixels of every cutscene are solid black**, edge
  to edge. The game extends that black to fill any phone, so the scene always
  looks full-screen with nothing cropped.
* **The dialogue goes in the black band at the top**, in the arcade font. Keep
  faces and action below it.
* Nothing important within 48 pixels of the left or right edge.

| # | Scene |
|---|---|
| 1 | Night. Outside a small corner liquor store: brick front, glass door with a hanging CLOSED sign, lit window, stars in a black sky. |
| 2 | Inside the store on a wooden shelf: Elmer, Sodey, Alistaire and Johnny standing together, turned toward each other. |
| 3 | Close-up of Johnny, eyebrows raised, one hand up like giving advice. |
| 4 | Close-up of Elmer, slumped and frustrated, arms thrown out. |
| 5 | Close-up of Alistaire leaning in, pointing at Elmer. |
| 6 | The store door from inside at dawn — a huge potato-shaped silhouette with a baseball cap behind the glass. |
| 7 | Johnny waving the others back; bottles scrambling to their spots on the shelf. |
| 8 | A giant brown potato hand reaching down toward Elmer. Elmer stands stiff like a plain bottle, arms tucked away, eyes shut. |
| 9 | Mr. Tater's home bar: enormous shelves of bottles climbing up through a glass sunroof into the night sky, drawn like a Donkey Kong girder stage. |
| 10 | Mr. Tater holding Elmer up to his face, sneering, one eyebrow raised. |
| 11 | Mr. Tater's silhouette walking out through a lit doorway. |
| 12 | The bottom shelf: Elmer opening his eyes; Guillermo, Mixey and Allie Cated coming to life beside him. |
| 13 | Elmer staring at Allie, pixel hearts floating over his head. Allie glancing away. |
| 14 | Guillermo with a hand on Elmer's shoulder, solemn, gesturing at the shelves above. |
| 15 | Elmer sitting on the edge of the shelf, head down, sad. |
| 16 | Close-up of Allie gazing up at the high shelves, sad, a pixel tear. |
| 17 | Elmer standing tall, fist raised; Mixey barking beside him; Guillermo and Allie watching. |
| 18 | Guillermo alarmed, hand cupped to his ear, looking at the door. |
| 19 | Mr. Tater scooping up Allie in one hand; she reaches back toward Elmer. |
| 20 | Mr. Tater climbing the shelves out of the top of the screen with Allie, like Kong carrying Pauline up the girders. |
| 21 | Elmer looking straight up the towering shelves, fists clenched. |
| 22 | Guillermo presenting Mixey to Elmer like a gift; Mixey wagging, bubbles popping from his tab. |
| 23 | Looking up the shelves: dusty lonely bottles with cobwebs above, Elmer and Mixey small at the bottom. |

**`title.png`** — Elmer and Mixey on the bottom shelf looking up the towering
shelves, Guillermo waving, Tater tiny at the very top holding Allie. Same black
bands; the logo and buttons go over it.

**Prompt:**

> [STYLE CONTRACT]. A full-screen story cutscene for a 1980s arcade game,
> 1024 × 1536 portrait. The top 128 pixels and bottom 128 pixels are solid black
> from edge to edge. Match the attached character grid exactly, drawn as chunky
> pixel sprites; close-ups are the same sprites enlarged, still visibly pixelated.
> Dark background, simple blocky pixel scenery, like a Donkey Kong or Bubble
> Bobble intermission screen. No text, no speech bubbles. Scene: [scene].

### `logo-tater-tales.png`

The words **TATER TALES** in chunky arcade marquee letters, like the red
"HIGH SCORE" in Donkey Kong: blocky pixel letters, a warm gold-to-orange fill in
horizontal bands, a dark outline, a little potato and bourbon bottle tucked
beside the letters. Flat magenta background. **Check the spelling before
saving.**

---

### Sheet 5 — `anim-elmer-launch.png` (rows A–D)

Elmer holds **Mixey like a pet dog**. The soda sprays out of the **pull tab on
Mixey's head end**.

**A — Shake and aim** · loop · Elmer facing the front, head tilted back looking
**up**, holding Mixey in both hands. 1. Mixey held high · 2. moving down ·
3. low · 4. back up · 5. high, Mixey's cheeks puffed · 6. mid, pixel bubbles
popping from the tab.

**B — Crack and blast off** · one-shot · bleeds into C
1. Stops shaking, determined face · 2. flips Mixey upside down under one arm, tab
pointing at the ground · 3. finger on the tab · 4. tab cracks, short burst of
brown soda sprays down, Elmer crouches · 5. big spray, feet leaving the ground ·
6. airborne, stretched upright, spray below — **same as C1**.

**C — Flying, three angles** · each pair is a 2-frame loop (the spray flickers)
* 1–2. Flying **straight up** — free arm punched up like a superhero, spray and
  bubbles below.
* 3–4. Flying **diagonally up-right** — whole body tilted 45°, spray trailing
  down-left.
* 5–6. Flying **right** — body nearly horizontal, spray trailing left.

*The game picks the nearest angle and mirrors for left.*

**D — Land and slide** · one-shot · moving right · bleeds into A
1. First foot touches down, spray sputtering out · 2. knees bent, skidding, dust
puffs behind · 3. leaning back, heels dug in · 4. slowing, wobbling · 5. stopped,
arms out for balance · 6. relieved, Mixey back in both hands — **same as A1**.

---

### Sheet 6 — `anim-elmer-fall.png` (rows E, F + 2)

**E — Falling** · loop · Upright, looking **down**, eyes huge, mouth open, free
arm waving over his head, Mixey clutched with legs flailing, sweat drops.

**F — Thud and get up** · one-shot · bleeds into A
1. Impact, squashed flat, dust burst · 2. face down, pixel stars circling ·
3. pushing up · 4. kneeling, shaking his head · 5. standing, dusting off while
Mixey shakes like a wet dog · 6. Mixey back in both hands — **same as A1**.

**Row 3 — Guillermo, "good luck"** · loop · Facing the front, waving an arm
overhead, then a thumbs up, smiling. Mouth open on frames 3–4.

**Row 4 — Elmer reacts** *(when Tater steals Allie)* · one-shot · 1. looking up
happy · 2. shocked · 3. reaching up · 4. arm drops · 5. fist shaking at the
sky · 6. determined — same as A1.

---

### Sheet 7 — `anim-tater.png` (rows G–J)

Allie always stands at the **far right** of the screen, so **Allie faces left** and
**Tater faces right** toward her. Keep Tater 56 × 72 to Allie's 14 × 32 where
they share a cell.

**G — Allie, "help me"** · Allie alone, facing left, worried. Frames 1–4 loop:
hands clasped, waving one arm, mouth open calling. 5. hears something, freezes ·
6. looking straight up in fright — leads into H.

**H — Tater lands** · **Tater alone** (Allie holds G6). Facing right.
1. falling pose, knees tucked, arms up · 2. legs reaching down · 3. impact,
squashed, dust clouds · 4. rising from crouch · 5. standing tall, fists on hips,
smug · 6. head turned right toward Allie.

**I — Tater grabs Allie** · **both in the cell**, Tater left, Allie right.
1. Tater looms over her · 2. his hand closes around her · 3. lifts her ·
4. clamps her under his arm, legs kicking · 5. sneering, mouth open, finger
wagging · 6. same, mouth closed. *5–6 loop while he talks.*

**J — Tater leaps away** · both in cell, Allie under his arm reaching back
**down-left** toward Elmer. 1. deep crouch · 2. springing · 3. in the air, fist
up · 4–6. rising pose loop, legs trailing, Allie waving. *The game moves him up
off the screen.*

---

### Sheets 8–9 — "Thank you" bottles (rows K–Q)

The **lonely dusty bottles** on Tater's shelves. Same six frames for each,
facing the front:

1. **Dusty idle** — dull greyed-out colours, a cobweb, grey dust on top, sad
   eyes. *(Shown on the platform until Elmer arrives.)*
2. **Notices** — eyes wide, standing up straight.
3. **Joy** — shaking off the dust in grey puffs, full colours back.
4. **Thanks** — bowing or waving, mouth open.
5. **Glowing** — bright, eyes closed happy, yellow pixel sparkles around.
6. **Gone** — a burst of sparkles and bubbles where the bottle was.

| Sheet | Row 1 | Row 2 | Row 3 | Row 4 |
|---|---|---|---|---|
| `anim-thanks-1.png` | **K** Alistaire (gin) | **L** Guillermo (tequila) | **M** Rum | **N** Johnny (Scotch) |
| `anim-thanks-2.png` | **O** Brandy | **P** Malort | **Q** Chartreuse | **Mixer pets** |

**Mixer pets row** (pickups on platforms) · 1–2 Cola Pet, 3–4 Ginger Pet,
5–6 Tonic Pet · two-frame idle each: sitting, then hopping with tail up.

---

### The finale and the loop

The climb has a top. At the top of heaven, Mr. Tater stands on his **golden top
shelf** holding Allie — like Kong at the top of the girders.

1. Elmer lands on the summit. Tater laughs at him *(row R)*.
2. Elmer points Mixey at Tater like a fire hose and cracks the tab *(row S)*.
3. Tater is soaked, slips, drops Allie and tumbles off the back of the cloud
   shaking his fist *(row T)*.
4. Elmer and Allie hold hands and jump off together. The screen races back down
   through every zone *(row U)*.
5. They land by Guillermo. Allie points up: *"Keep going! See if you can reach
   Tater again and take him on!"*
6. **The next lap starts** from the bottom, score carried over, lap counter
   `L=02` — Tater is waiting at the top again, and the climb is harder.

**Allie stays safe at the bottom** from lap 2 on, cheering next to Guillermo
(row W). Tater only snatches her mid-climb (rows G–J) on lap 1. On later laps
he's alone at the summit guarding his cabinet: Elmer still sprays him (S, then
T2), then jumps down alone (V), and Allie cheers him off on the next lap.

**Every lap's summit frees one rare bottle, plus a points bonus.** A different
dusty bottle stands in front of Tater's cabinet each lap. Once Tater is knocked
off, it plays its "thank you" row (frames 2–6) and sparkles away, and the bonus
is added. No new art — it reuses rows K–Q.

| Lap | 2 | 3 | 4 | 5 | 6 | 7 | 8+ |
|---|---|---|---|---|---|---|---|
| Freed | Alistaire (gin) | Johnny (Scotch) | Rum | Brandy | Malort | Chartreuse | repeats from gin |

Guillermo is left out of the summit rotation, because he's standing at the
bottom at the same time. The bonus can grow each lap to match the difficulty.

All of it plays in the game on the real stage. No extra cutscenes.

### Sheet 10 — `anim-finale.png` (rows R–U)

**R — Tater on the summit** · loop · Tater alone, facing **left** toward Elmer,
Allie clamped under his arm. 1–2 hands on hips, belly laughing · 3–4 wagging a
finger, mouth open · 5–6 laughing again.

**S — Elmer sprays Tater** · one-shot · Elmer alone, facing **right**. 1. aiming
Mixey forward like a hose · 2. finger on tab · 3. tab cracks, short burst ·
4. long soda jet to the right edge of the cell, Elmer skidding back · 5. jet
wobbling · 6. sputtering out, Elmer grinning.

**T — Tater gets soaked** · one-shot · Tater (left) holding Allie (right),
facing left, soda hitting him from the left. 1. face full of soda, eyes shut ·
2. dripping, feet slipping · 3. arms fly up — **Allie drops free** and lands at
the far right · 4. windmilling on one foot · 5. falling backward, fist shaking ·
6. only his shoes and a splash of soda at the bottom of the cell. Allie stays
standing on the right in 3–6.

**U — Jump down together** *(lap 1)* · Elmer (left) and Allie (right) **holding hands**,
Mixey under Elmer's arm. 1. crouched, smiling at each other · 2. leaping ·
3–4. falling happily, arms spread, pixel hearts — **3–4 loop** · 5. landed
together · 6. Allie pointing straight up, fist pumped, mouth open.

### Sheet 10b — `anim-finale-2.png` (laps 2 and up)

From lap 2, Allie is safe at the bottom, so Tater is alone at the summit guarding
his display cabinet. Same grid, 6 × 4.

**R2 — Tater alone on the summit** · loop · Row R without Allie: facing left,
1–2 belly laughing · 3–4 wagging a finger, mouth open · 5–6 laughing, arms
crossed.

**T2 — Tater alone gets soaked** · one-shot · Row T without Allie: 1. face full of
soda · 2. slipping · 3. arms flying up · 4. windmilling on one foot ·
5. falling backward, fist shaking · 6. only his shoes and a splash.

**V — Elmer jumps down alone** · 1. crouched, grinning, Mixey under his arm ·
2. leaping · 3–4. falling happily, arm spread wide, **3–4 loop** · 5. landed,
knees bent · 6. standing, thumbs up.

**W — Allie cheering at the bottom** · loop · Allie standing next to where
Guillermo is, facing the front: 1–2 hopping with both arms up · 3–4 pointing up
the shelves, mouth open · 5–6 clapping. Plays while Elmer climbs away on laps 2+.

---

### Sheet 11 — `ui.png`

**6 × 2 of tall cells** (256 × 512), magenta background.

**Row 1 — the aim arrow at six angles.** A chunky red pixel arrow with a gold
outline. In every cell the arrow's **base sits at the bottom centre** of the cell.

| Cell | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Points | straight up | 18° right | 36° right | 54° right | 72° right | 90° (flat right) |

The game mirrors these for the left side, giving **11 positions**, and the arrow
**ticks** from one to the next as it swings — like an arcade golf or bowling
aim. The blast uses the angle shown, so what you see is what you get.

**Row 2:**

| Cell | Contents |
|---|---|
| 1 | **Carbonation gauge — EMPTY.** A tall narrow glass tube, metal caps top and bottom, tick marks up the side. Inside is dark. |
| 2 | **The same gauge — FULL**, pixel-for-pixel the same tube, filled with brown cola and bubbles, lighter at the top. |
| 3 | Foam top — a frothy strip the width of the tube's inside, with a few bubbles above it. |
| 4 | Cola icon — tiny cola can, for the inventory in the score bar. |
| 5 | Ginger beer icon. |
| 6 | Tonic icon. |

The game shows the empty gauge and uncovers the full one up to the current
level, with the foam on top — so the power can stop anywhere, not in steps.
**Cells 1 and 2 must line up exactly** — say so in the prompt.

---

## Part 3 — Decisions

* **Name** — Tater Tales.
* **Art style** — arcade pixel art for everything; v1's designs carry over
  (2026-09-14).
* **Koriko** — cut (2026-09-14).
* **Mixers** — fizzy cans and mini bottles shaped like animals (2026-09-14).
* **Ending** — endless laps. Rescue Allie at the top, jump down together, start
  again (2026-09-14).
* **Cutscenes** — full phone screen, same pixel look as gameplay (2026-09-14).
* **Allie on later laps** — stays safe at the bottom with Guillermo. The
  mid-climb "Tater snatches Allie" scene (rows G–J) happens on **lap 1 only**
  (2026-09-14).
* **Difficulty** — **harder each lap** (2026-09-14). This is tuning in code and
  needs no new art. Suggested levers, one or two more per lap:
  shorter platforms · bigger gaps between them · fewer mixers · more dusty
  bottles · the arrow swings faster · the gauge rises and falls faster.
* **Summit reward on laps 2+** — a different rare bottle freed from Tater's
  cabinet each lap, plus a points bonus (2026-09-14).

## Delivery

Drop images in `~/Documents/ChatGPT/Tater Tales Sprites f/` with the filenames
above, plus a `*-prompts.txt` beside each one as with Behind the Stick. They get
sliced, keyed, snapped to the pixel grid and shrunk to size into
`public/popup/art/tater/` on import.
