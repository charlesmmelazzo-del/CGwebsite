# Tiki Wars — design spec

A lane-runner shooter for the High Scores pop-up arcade, alongside Behind the
Stick and Top Shelf. Endless, with meta-progression that survives a game over —
the one game in the cabinet meant to be played more than once.

Unlike the other two, this one runs at a **higher resolution, full-bleed, in a
90s-console sprite style** (Metal Slug rather than Donkey Kong) and does not
share their 224x288 buffer or their cabinet chrome.

Status: **design agreed, not yet built.** v1 scope is at the bottom.

---

## Vocabulary

Used consistently in this doc and in the code. The owner's original notes used
"round" for both of the first two; they are different things.

| Term | Meaning |
|---|---|
| **Run** | One play-through, start to game over. Produces one leaderboard score. |
| **Stage** | One themed level inside a run (Beach, Desert…). A run contains many. |
| **Shop** | Between stages, inside a run. |
| **Go Again** | Starting a fresh run after a game over, keeping progression and score. |

---

## Presentation

Tiki Wars does **not** share the other two games' 224x288 buffer or their cabinet
chrome. It is higher resolution, full-bleed, and 90s-console in style.

### Resolution

| | |
|---|---|
| Logical width | **270 px, fixed** |
| Logical height | **derived from the viewport, clamped 480-620** |
| Reference height | **540** (design and art-budget against this) |
| Backing buffer | 2x logical, smoothing off |

Width is fixed so that every gameplay distance, hitbox and lane position is
written once and means the same thing on every device. Height flexes because
phones are not one shape: a 9:16 phone and a 9:20.5 phone both fill the screen,
and the difference goes into **sky**. The horizon sits a fixed distance above the
player, so the play field itself never changes size — only how much air is above
it.

Practically, for art: **backgrounds need generous sky and must tile or stretch
vertically.** Nothing gameplay-critical goes in the top third.

This is roughly 2.4x the linear resolution of the other two games — about six
times the pixels — which is the room the sprite style needs.

### Full-bleed

The game fills the viewport. No cabinet frame, no controller panel below the
canvas. `GameShell` currently wraps every game in cabinet chrome, so this needs
a **full-bleed flag** on the game metadata that lets Tiki Wars opt out. Behind
the Stick and Top Shelf are unaffected.

---

## Controls

**Auto-fire. Drag to move.**

The player walks toward the horizon and shoots automatically. The guest's only
input is horizontal position: **drag a thumb anywhere on the screen.** Position
*is* the decision - it aims, it dodges, and it picks a gate. Arrow keys on
desktop.

Drag tracks relative movement, not absolute position, so a thumb can be lifted
and re-planted anywhere without the character teleporting.

### Suppressing browser interference

A drag surface on a mobile web page fights the browser for the gesture. All of
the following are required on the canvas and its container - `controls.tsx`
already documents most of these as hard-won:

```
touch-action: none;                    /* no scroll/zoom stealing the drag   */
user-select: none;                     /* no text selection on a long drag   */
-webkit-user-select: none;
-webkit-touch-callout: none;           /* no iOS copy/paste bubble on hold   */
-webkit-tap-highlight-color: transparent;
overscroll-behavior: none;             /* no pull-to-refresh mid-run         */
```

plus `preventDefault()` on `touchmove`, pointer capture on the drag, and
`contextmenu` suppressed. Anything less produces a grey flash, a selection
highlight, or a page that scrolls out from under the player.

### The bomb

One control beyond the drag, drawn **in the canvas at the bottom-left corner**
with a quantity badge, hit-tested. Bottom-left because most guests will drag with
their right thumb.

Not a tap-to-bomb gesture: a guest re-plants their thumb constantly during a run,
and every re-plant would burn a bomb.

---

## The play field

270 x 540 logical (reference), portrait.

```
 y=0    +------------------------+
        | HEALTH ####            |  HUD - health + armor ONLY
        | ARMOR  ####            |
        |                        |
        |  sky / sun / clouds    |  parallax; absorbs extra device height
 y~180  | --- horizon ---------  |  enemies spawn here, ~8px tall
        |                        |
        |    ground plane        |  perspective, scrolling texture
        |   (road narrows        |
        |    toward horizon)     |
 y~430  |        [player]        |  fixed y, ~84px tall
        |  [BOMB x2]             |  in-canvas, bottom-left
 y=540  +------------------------+
```

### HUD

**Health and armor. Nothing else.**

No stage number, no money, no luck, no score. Money and luck are shown in the
shop between stages, where they are actually actionable. The run itself stays
clean - the guest is watching the field, not reading statistics.

### One speed for the world

The player walks forward at `worldSpeed`. **Everything that isn't alive
approaches at exactly that rate** — the ground, the palms, all scenery. An enemy
closes at `worldSpeed + its own walk`, which is what makes it read as walking
rather than sliding along on the sand.

This was wrong in the first build and it was very visible: the ground scrolled
at a hard-coded `0.42`, the palms at `0.16`, and enemies closed at `0.155`.
Three unrelated speeds, with the sand tearing past nearly three times faster
than the things standing on it. If a new kind of scenery is added, it takes
`worldSpeed` too.

### Firing

Bullets are drawn **after** the hero, never before. A bullet spawns at `z=0.02`,
which projects to a point *inside* his 84px sprite — drawn first, every shot was
hidden behind him until it was well up the field.

Three things make the gun read as firing, and all three are needed:

* **Muzzle flash** at the gun while `firing` is up. This is what anchors the
  shooting to the character; without it the hero looks like a bystander while
  bullets appear in the middle distance on their own.
* **Tracers, not dots.** A round covers more ground between frames than a dot is
  wide, so a dot strobes and a streak reads as a line of fire.
* **A slower bullet.** Fast enough to feel instant, slow enough to be seen
  leaving the barrel.

The muzzle offset is **visual only** — the bullet's `nx` is what the rules
hit-test, so the gun always shoots exactly where it points.

### Depth model

Every actor carries a depth `z`, from `1.0` at the horizon to `0.0` at the
player. Screen position and scale both come from a real **perspective divide**,
not a hand-rolled curve:

```
d       = NEAR + z * (FAR - NEAR)        // camera distance; NEAR 1, FAR 5
toward  = (1/NEAR - 1/d) / (1/NEAR - 1/FAR)
screenY = PLAYER_Y + (HORIZON_Y - PLAYER_Y) * toward
scale   = NEAR / d
```

This was originally an eased polynomial, and that turned out to be a real
mistake worth recording: squaring `z` crushes the NEAR field, so the last third
of an enemy's approach occupied about thirty pixels. Enemies hung in the
distance and then effectively teleported through the exact band where the guest
has to decide whether to shoot or dodge. The reciprocal divide distributes the
field the way an eye does — close things large and well separated, distant
things bunching at the horizon — and the near-field decision window becomes
readable.

`scale` and `screenY` must always share the same curve, or sprites visibly
skate and sink as they approach.

The playable width also narrows with depth, so an enemy's x is stored as a
normalised `-1 .. +1` across the road and projected each frame. That keeps
"directly in front of me" true at every distance.

**Sprites are pre-scaled into discrete depth buckets**, not resampled per frame.
Same reasoning as `ingredientImages.ts`: resampling a 1024px source down to 20px
sixty times a second, for twenty enemies, is enormous waste for a picture that
never changes - and with smoothing off it produces dropped-row mush. Each sprite
is resampled once per bucket into an offscreen canvas with smoothing ON, then
blitted 1:1 with smoothing off.

---

## Combat

### Enemy tiers

| Tier | Behaviour | Shots to kill | Can be dodged? |
|---|---|---|---|
| **1 — Grunt** | Walks a straight line toward the player. | 1 | Yes |
| **2 — Blocker** | Walks toward the player, tracks slightly. | Several, scaling | No — must be killed |
| **Boss** | Stage finale. Attacks on a pattern. | Many, scaling | No |

Contact with any enemy costs health (armor first, if any). Tier 1 exists to be
mowed down and to punish bad positioning; tier 2 exists to make raw firepower
insufficient and force lane commitment.

**A boss is never consumed by contact.** It hits you, falls back, and comes
again. Killing it is the only way past — it is the stage's exit condition, so
removing it from the field for any other reason strands the run with nothing
left to kill.

### Dodging has a price

An enemy that walks past unkilled **deducts points**: half its kill value —
**5** for a grunt, **25** for a blocker. A boss is exempt, since it cannot be
dodged past at all.

Without this, dodging is strictly free: side-step everything, never fire, and
survive indefinitely at no cost, which is exactly how the game first played.
The penalty turns position into a trade rather than an escape. You can still
duck what you cannot kill — it is simply never the cheap option.

Half the kill value rather than the full amount, deliberately. At depth the wave
outgrows any gun, so a symmetric penalty would make surviving a deep stage
net-negative and punish the guest for getting good.

Score is floored at zero; penalties can never push a run negative.

**The deduction has to be visible.** The HUD carries health and armor and
nothing else, so a silent subtraction would be invisible — a guest could bleed
points all run and never be told. A floating number rises from wherever the
enemy got through, and that is the only feedback there is.

### Grunt variants

The grunt is a citrus soldier, and it comes as **lime, lemon, orange and kiwi**.
They appear mixed together in the same wave, on every stage.

**All four share one health value** — a couple of hits, rising slowly with
depth. Variety between them is colour, silhouette and speed, never health, so a
lemon never secretly takes longer than a lime. Speed may vary (the kiwi is the
quick one) because speed is visible on the approach and health is not.

They used to die in exactly one shot, on the reasoning that the guest needs an
unconditional read of "shoot through it" or "dodge round it". That read matters,
but one-shot enemies cost the shooting all of its weight — an enemy that simply
stops existing gives no feedback, and firing felt like sweeping rather than
fighting. **The read is now carried by feedback rather than by health:**

* every hit **flashes** the target white
* every hit **staggers** it, stalling its walk for a moment
* every hit **shoves it back** up the field

so "this is dying" is legible without counting shots. Health bars are drawn on
**blockers and bosses only** — a bar over every grunt on a crowded screen reads
as noise.

### Steering

Touch steering is **positional, not directional**. The thumb's distance from
where it went down *places* the character; it does not accelerate it. One full
travel — about 38% of the screen width — covers more than half the road.

Feeding the drag into a velocity integrator, which is what the first build did,
made the character feel towed: you moved your thumb and it caught up a moment
later. In a game where picking a lane is worth health, that lag is unusable. The
character now reaches 99% of the thumb's target within 100ms, and stops dead on
release rather than coasting.

Keyboard steering stays velocity-based, since a key has no position.

### Wildcard blockers

A pool of tier-2 blockers that are **not tied to any stage** — any of them can
turn up anywhere, at any point in a run.

This is what keeps the endless tail alive. The stage-native blockers are
predictable by design; once a guest has seen the beach three times they know
exactly what the sugar cane does. Wildcards mean the composition of a wave is
never fully known, and the deeper the run goes the more of the wave is drawn
from the wildcard pool rather than the stage's own roster.

They obey every normal blocker rule — must be killed, scaling health, contact
damage. The pool:

| Wildcard | Flavour |
|---|---|
| Angry milk carton | Wrench |
| Angry beer can | Length of pipe |
| Angry coconut cream can | Can opener |
| Angry ginger beer bottle | Samurai sword |
| Angry pomegranate | Piece of lumber |
| Angry almond | Giant spoon |
| Angry blender | Boxing gloves |

The blender is the heaviest of them and works well as an occasional elite —
tougher than the rest of the pool and worth more points.

The pool is a plain list, so new wildcards can be added later with nothing more
than a sprite and a line of metadata.

### Guns

All three last **the current stage only** — a gate pickup dies at the stage end,
and a shop purchase buys you the *next* stage. Taking damage does not strip a
gun. Helpers always keep the base pistol regardless of what the player is
holding.

| Gun | Behaviour |
|---|---|
| **Pistol** | Base. Single bullet, straight, base tempo. |
| **Shotgun** | Three bullets in a spray. |
| **Uzi** | Single bullet, straight, much faster tempo. |
| **Flamethrower** | Shortest range, widest spread, high damage. Sets enemies alight - they keep burning and taking damage after the stream leaves them, so a sweep across a crowd kills things that walked out of range. The close-range panic button: devastating if they reach you, useless at distance. |

### Helpers

Rum-bottle companions that flank the player, move with them, and fire the base
pistol. Killed by contact with any enemy that reaches them. **Reset to zero at
the end of every stage.**

---

## Gates

Periodically a pair (later, more) of panels sweeps down the field. The player
steers through one. One side is a bonus, one a negative — until deep stages,
where both may be negative and the choice becomes damage control.

**Bonuses:** `+1/+2/+3 Helper` · `Shotgun` · `Uzi` · `Flamethrower` ·
`Bomb` (clears the field) · `Money +$5`

**Negatives:** `-1/-2/-3 Helper` · `Pistol` (downgrade) · `Money -$5` ·
`Poison` (health) · `Black Cat` (-10% luck)

Money is the only gate outcome that outlives the run. That tension — take the
power you need now, or bank toward a permanent upgrade — is the core decision of
the game and should stay sharp at every difficulty.

Gates and tier-2 blockers should not share screen time. A gate gets its own
moment.

---

## Economy

### Stats

| Stat | Range | Notes |
|---|---|---|
| **Health** | bar | Refills at the start of every stage. |
| **Armor** | 0–10 slots | Absorbs damage before health. Does **not** refill — must be re-bought. |
| **Luck** | 0–100%, in 10% steps | Raises the frequency and strength of good gate offers. |
| **Money** | $ | Earned at gates and from kills. |

### Shop (between stages)

Fronted by the **shopkeeper — a Scotch bottle** leaning in the window of a tiki
market booth, who has something to say about every purchase (see Quips). Money
and luck are displayed here, since this is the only place they're actionable.

| Item | Cost | Effect |
|---|---|---|
| Four-leaf clover | Rises with current luck | +10% luck. **Max one per shop visit.** |
| Armor | Rises as slots fill | +1 slot, up to 10. |
| Bomb | Rises with quantity held | +1 bomb. **Max 3 held.** |
| Gun | Fixed per gun | One random gun offered each visit; applies to the next stage only. |

Clover cost falls again if luck drops (Black Cat), so a cat is a real setback
but not a permanent one.

---

## Persistence

**Money, Armor and Luck survive a game over.** Health, guns and helpers do not.

This is the first stateful thing in the arcade — the other two games are pure
client-side, with one number posted at the end. Tiki Wars needs a per-guest save
file: a new table, read on boot and written after each run.

Persistence is **sign-in only**, which matches where the pop-up is heading
anyway (see Access, below).

### Go Again (new game plus)

A game over is not the end of the session. The player is offered **GO AGAIN**,
which starts a fresh run keeping money, armor, luck — and their score, which
**keeps accumulating**. The leaderboard number is a running total across every
run a guest plays at this pop-up, not the best single run.

Two consequences worth knowing:

* **The existing score table needs no change.** Each run inserts a row carrying
  the new cumulative total; the board already takes the best row per guest,
  which is now simply the most recent one. `MAX_SCORE` is 10,000,000 — high, but
  a dedicated guest across a whole pop-up could approach it, so the cap should
  clamp rather than reject.
* **Difficulty must carry over too.** If Go Again restarted at stage 1, a maxed
  guest would farm trivial early stages for free points forever — grinding, not
  playing. So a new run starts at a **difficulty floor of half your deepest
  stage**: still a ramp, never a free lunch.

### Save file

```
popup_tiki_progress
  user_id      uuid     — the guest
  menu_id      uuid     — per pop-up, so a new pop-up is a fresh start
  money        integer
  armor        integer  — 0..10
  luck         integer  — 0..100, multiples of 10
  best_stage   integer  — deepest stage reached; sets the Go Again difficulty floor
  total_score  integer  — cumulative across every run at this pop-up
  runs         integer  — how many times they've gone again
  updated_at   timestamptz
  primary key (user_id, menu_id)
```

Scoped per pop-up on purpose: carrying a maxed character between pop-ups would
make a later leaderboard unwinnable for a new guest.

---

## Scoring

One number to the existing `popup_game_scores` table, plus a `detail` blob for
the owner to sanity-check a winner.

```
score = Σ kills × tier weight
      + Σ stage-clear bonus (grows with stage depth)
```

Tier weights, first pass: grunt **10**, blocker **50**, boss **500**.
Stage clear: `100 × stage`.

Score **accumulates across runs** — see Go Again above. A game over banks the
total; it never resets while the guest is at this pop-up.

Because dodging deducts points, a run can legitimately end **lower** than it
started. The save file therefore cannot clamp the total upward: doing so would
silently refund every penalty. It is guarded by the run counter instead — a
write is only accepted from a client that has played at least as many runs as
the server has recorded, which rejects a stale save without rejecting an
honestly lower score.

**Money is deliberately not scored.** It already converts into power; counting
it as well would double-dip and make "always take the money" strictly correct,
which kills the gate decision.

`detail` records: stage reached, kills by type, money earned and spent, gates
taken, guns held, final luck and armor, and how the run ended. Existing
`MAX_SCORE` is 10,000,000 — comfortably clear of a great endless run.

---

## Difficulty — the endless curve

The game is endless by design; runs are not capped. The risk is therefore not
length but **stalemate**: a returning guest with 100% luck and 10 armor who
cannot die, gets bored at stage 40, and posts an unbeatable score without ever
reaching an ending. Every lever below must scale past any possible build.

| Lever | Direction |
|---|---|
| Wave size | Rises. Enemies arrive in clusters spread across the road, not one at a time — a faster trickle of singles reads as a queue and is side-stepped one by one. |
| Enemy count and speed | Rise continuously, no ceiling. |
| Blocker density | Rises — firepower stops being sufficient, position becomes binding. |
| Gate quality | Decays. Deep stages offer weaker bonuses and harsher negatives; eventually both sides are negative. |
| Health and armor economy | Top-ups grow scarce relative to incoming damage. |
| Shop prices | Rise with stage depth on top of quantity scaling. |

Target: a maxed-out guest dies around stage 20–30 having had a great run; a
typical guest around stage 6–10. Tune against the real thing, not this table.

---

## Story and stages

First pass through a run plays in **fixed order** — that's the narrative. After
the castle, stages randomise and the curve above takes over.

**Intro** — 3–4 static comic panels, tap to advance, skippable. Not animation:
a fraction of the art, and it reads better on a phone.

1. Two rum bottles holding hands, kissing.
2. An evil crowned pineapple, frowning jealously.
3. The pineapple hanging out of a helicopter with the female bottle — "SAVE ME!"
4. The male rum bottle, furious.

**Stages**

| Stage | Scenery | Grunt | Blockers | Boss |
|---|---|---|---|---|
| **Beach** | Sand, palms, ocean horizon, sun, beachgoers | Lime soldier | Giant sugar cane | Baby pineapple with a club |
| **Desert** | Cacti, mountains, setting sun, coyote | Lime soldier | Sombrero tequila worm; mustachioed mezcal bottle with a sword | Pineapple in knight's armour |
| **Winter** | Snowy pines, snow-capped mountains | Lime soldier | Cinnamon stick with hammer; coconut with lightsaber; grapefruit with a bat; zombie candy cane | Pineapple dressed as Santa, with a whip |
| **Castle** | Battle fences, evil castle, scary moon, night | Lime soldier | Pineapple knights; the three earlier bosses as regular blockers | **King Pineapple**, holding your rum bottle hostage |

**After the castle** — the King escapes in a blimp: *"You think you can catch me
that easily?"* Then the endless randomised tail begins.

---

## Quips (barks)

The hero and the shopkeeper talk. Comic speech bubbles, **drawn in code** from
pools of one-liners, randomly injected — so the pools can grow to hundreds of
lines without a single new sprite, and a regular who plays twenty runs keeps
hearing new material.

Three triggers, each with its own pool and its own staging.

### 1. Powerup pickup — non-blocking

The hero turns to camera (`player-turn.png`), a small bubble pops, he turns
back. **The game does not pause.**

This is the one that can go wrong. In a runner, a balloon over the road at the
wrong moment gets someone killed and feels cheap. So:

* Bubble is **small and anchored to the side**, never over the centre lane or
  the horizon where enemies are read.
* **~1.2 seconds**, then gone.
* **Rate-limited** — at most one bark per ~8 seconds, so a fast run of gates
  doesn't turn into a wall of chatter.
* **Suppressed entirely** when a blocker or boss is inside the danger band. Being
  interrupted is worse than missing a joke.

### 2. Shop purchase — blocking, and free to be

The shopkeeper Scotch bottle swaps to his grinning pose and a bubble pops over
the booth. The shop is already a pause; nothing is at risk. Bubble stays until
dismissed or ~2.5s.

### 3. Boss defeat — the money shot

The opposite of the pickup bark: this one **stops the game and takes its time.**

1. Boss death animation plays out, field clears.
2. Hero spins to camera in the hero pose.
3. Sunglasses drop in from above onto his face — cut to
   `player-turn-shades.png`.
4. Bubble pops with the one-liner. Held ~2.5s.
5. Back to the walk cycle, stage complete.

Boss kills are rare and earned. This is the beat guests will show each other at
the bar.

### Pools

Plain string lists in `src/components/popup/games/tiki/quips.ts`:

```ts
export const QUIPS = {
  pickup: [ /* ... */ ],
  shop:   [ /* ... */ ],
  boss:   [ /* ... */ ],
};
```

* **Anti-repeat**: draws shuffle through the whole pool before any line repeats,
  rather than picking at random each time. Random picking will visibly repeat
  within a handful of draws and make a large pool feel small.
* **Length cap**: bubbles are readable at a glance or they are not read at all.
  Keep pickup lines **under ~40 characters** (they get 1.2 seconds); shop and
  boss lines can run to ~70.
* Pools can be extended at any time by editing that one file — no other change
  needed.

---

## Access

The owner's direction: **all games move behind a login.** Guests who aren't
signed in can see the page and watch demo mode, but are prompted to sign in
before playing. Reasons: email capture drives repeat business, and it's the
foundation for a planned system where a ticket printed with a cocktail order
carries a code worth a number of plays.

Two notes:

* This is a **change to all three games**, not a Tiki Wars feature. Today anyone
  can play anonymously and only *saving* requires an account. Best done as one
  pass over `GameShell` / `StartScreen` after Tiki Wars is built, rather than
  threaded through this work.
* The ticket-code play-credit system is **future work**. Nothing here should
  assume unlimited plays in a way that would be awkward to walk back.

---

## Demo mode

Required, like every game in the cabinet — it plays itself in the carousel and
is now also what an un-signed-in guest watches.

Straightforward for a lane runner: steer toward the better gate, kill blockers
early, dodge what's left. The bot lives inside the game next to the rules it
plays against, never calls `onGameOver`, hides its controls, and loops.

---

## v1 scope — the beach

Each pass below is playable and shippable on its own. v1 is where we find out if
it's fun; nothing past it is worth building until that's answered.

**v1 — The Beach.** Full-bleed 270-wide renderer, drag-to-move, auto-fire, depth
rendering. Lime soldiers, sugar cane blockers, baby pineapple boss. Gates
offering helpers, guns (incl. flamethrower), bombs and money. Health and armor
HUD. Money, armor and score persisting via the save file, with Go Again. A
two-line shop (armor, bomb). One stage on a loop with the difficulty curve
applied. Demo mode.

**v2 — The world.** Desert, Winter, Castle, their enemies and bosses. Fixed
story order then the randomised tail. Luck and clovers. The full four-line shop.
The blimp ending.

**v3 — Polish.** Intro panels. Curve tuning against real play. Endless-tail
balance.

---

## Art

The owner is drawing/generating all sprites. **The full asset list with sizes and
per-sprite descriptions lives in [`tiki-wars-sprites.md`](./tiki-wars-sprites.md).**
This section is the style contract those assets are drawn against.

### Style

90s console sprite work — Metal Slug, not Donkey Kong. Heavy black outline, flat
saturated fills, cel-shaded highlights, exaggerated cartoon proportions and
attitude. This deliberately departs from the string-art look of the other two
games; Tiki Wars is the showpiece.

The hero render of the rum bottle is the **reference sheet**. Every other
character matches its line weight, outline colour, shading style and eye style.

### The two views

The camera looks down the field from behind the player. That means the cast is
drawn in **two different orientations** and they are not interchangeable:

| View | Who | Used for |
|---|---|---|
| **Back view** — seen from behind, walking away, weapons forward | Player, helpers | In-game sprites |
| **Front view** — facing camera, walking toward it | All enemies and bosses | In-game sprites |
| **Three-quarter hero pose** | Player, King Pineapple, the couple | Logo, attract screen, intro panels, shop — **never in-game** |

The existing hero render is a three-quarter pose. It is excellent key art and
should be used everywhere out-of-game, but the in-game player needs its own back
view.

### Rules

* **PNG, transparent background.** The hero render currently has a white
  background; every asset needs true alpha.
* **Generate large — 1024px on the long edge** — and the code downsamples into
  its depth buckets. Matches the existing ingredient and bartender art (1254px).
  Never draw small and scale up.
* **Design for the on-screen size, not the source size.** The sprite doc lists a
  max on-screen height for every asset. The heavy black outline in the hero
  render is exactly what makes that survive; keep it everywhere.
* **Silhouette test.** Fill the sprite solid black. If you can't tell what it is,
  it won't read at 60px on a phone at a bar.
* Bullets, muzzle flash, flame, fire-on-enemy, explosions, gate panels, HUD and
  all text are **drawn in code**. Not needed as art.

### Trademark

The hero render carries a real spirits brand's wordmark, label layout and
barcode. This game ships on a public site as part of a commercial promotion,
which makes that a live trademark exposure rather than a theoretical one.

**Recommendation: keep the silhouette, palette and attitude; replace the label
with an original one.** The overproof green-and-yellow look is a style and is
fine to evoke. The wordmark, the specific label composition and the barcode are
what carry risk. Same for any other real brand that shows up in the cast —
tequila, mezcal and cinnamon characters should all be generic.

---

## Open

* **Cocktail pairing** — the other two games hang off a drink on the menu. Using
  a placeholder until the pop-up's cocktails are chosen.
