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

**Health, armor and score.**

Health and armor sit top left, score top right, zero-padded like any cabinet.
Nothing else: no stage number, no money, no luck. Money and luck are shown in
the shop between stages, where they are the only things a guest can act on.

The score is the run's cumulative total, which carries across Go Again, so it
can grow long — hence right-aligned, growing leftward into empty sky rather
than pushing anything else around. It is keylined in black because it sits over
bright sky at the start of a stage and dark sea near the horizon, and one flat
colour is unreadable against one or the other.

### Where the camera sits

The player stands close to the **bottom edge**, not partway up. Sitting him
higher left a dead strip of sand beneath him and, worse, meant everything
reached its largest while still well inside the frame — the fight always
happened at arm's length. Low and large, an enemy keeps growing right up to the
moment it arrives.

`FIELD_DEPTH_PX` grew with it so the horizon stayed put and the extra room
became playing field rather than sky, and `ROAD_HALF_NEAR` shrank because a
114px-tall hero is about 66 wide and would otherwise hang off the screen edge at
full lock.

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

### The hero's art

**One 8-frame sheet per weapon** — walk x4, hit x2, celebration, sad — rather
than a body with arm overlays. The overlay approach was tried and abandoned: the
body had pistols painted into it, so a shotgun overlay put him on screen holding
both. A sheet per gun means nothing has to be aligned and the gun he is holding
and the pose he is pulling are the same lookup.

The celebration and sad poses are driven by the gate tone, so the face matches
the quip pool — he grins with a `pickup` line and sulks with a `downgrade` one.
The boss kill keeps its own turn-to-camera pose with the sunglasses.

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
* **A cold colour.** Rounds were warm yellow, which is almost exactly the hue
  and value of the sand they fly over, and they simply disappeared. Cyan is the
  one hue nothing else on the beach uses.
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

**Four bosses, and a run meets all of them.** Baby, Knight, Santa and King
guard successive stages and then cycle, rather than the beach boss repeating
forever. Each has its own attack frames, which play when it closes inside
`BOSS_ATTACK_Z`. Once the real stages exist the boss becomes a property of the
stage instead.

**A boss never leaves the screen.** It is 176 logical px across on a 270px
screen — nearly two-thirds of it — so following the guest out to the kerb hung a
third of the boss off the side of the display. Tracking is capped per tier,
sized to each sprite. To stop that making the kerb a safe spot, a boss also
**reaches much further** on contact than an ordinary body does: capping how far
the one enemy that MUST be killed can follow you would otherwise turn it into
one that can be ignored.

**A boss can never be pinned.** It takes only 15% of the normal knockback and
is merely slowed by a stagger rather than stopped. Sharing the ordinary values
meant an uzi shoved it back up the field at 0.156 z/s while it only walked
forward at 0.087 — it was being pushed BACKWARDS faster than it could advance,
so sustained fire held it at the horizon indefinitely and the fight became a
stationary target with a lot of health. Heavy fire should slow a boss; it should
never stop one.

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

### Fewer, tougher

Enemies are deliberately meaty and deliberately not numerous. A swarm of
one-shot enemies gives the gun nothing to do — you can neither see a burst
landing nor feel anything drop. Pouring rounds into something until it gives way
is what the gun is there for, so a stage-one soldier is over half a second of
sustained pistol fire and a blocker several times that.

The base numbers are tuned for someone who is **struggling**. Anyone who is not
gets more enemies from the pressure loop above, which is the right way round:
the floor is generous and the ceiling is earned.

### Road width vs travel

**They are different numbers, deliberately.** `ROAD_HALF_NEAR` is how much room
the wave has to spread across; `PLAYER_NX_LIMIT` is how far the guest may lean
into it, and it stops short of the kerb so a 64px-wide hero stays fully on
screen at full lock.

They used to be one number, which meant the road could only ever be as wide as a
sprite could travel without hanging off the edge — so the whole field got
cramped purely because the hero grew. Separating them widened the road by about
15% with no clipping anywhere.

Everything that sits near the edge has its own limit, sized to its own sprite:

| | Limit | Why |
|---|---|---|
| Hero | 0.81 | ~64px wide, and must clear the screen edge at full lock |
| Soldier spawns | 0.86 | Narrow sprites, so they can use more of the road |
| Blocker spawns | 0.74 | ~84px across — a shared limit would hang a shoulder off |
| Helpers | 0.86 | Flank the hero, so they sit further out than he does |

One number for all of them either lets the widest sprite overhang or needlessly
keeps the narrowest away from the kerb.

### Where a wave lands

Wave slots are the **centres of n equal lanes**, not the endpoints of the road.

Endpoints were a real bug: `i / (n - 1)` gives exactly -1 and +1, so every wave
of two spawned hard against both kerbs with the entire middle of the road empty.
Cell centres put a pair a third of the way out and a single enemy straight down
the middle. Waves also span only about 78% of the road, because the outer lane
is where the guest sits to refuse a gate.

Blockers each carry a small personal **aim offset**. They steer at the player,
and every one of them steering at the exact same point converged them onto a
single x — they arrived in single file and threw away the spread they were
spawned with. Offsets keep them closing as a group that still occupies width.

### Soldier variants

Six of them — **lime, kiwi, lemon, orange, cherry and sugar cube** — mixed
together in the same wave, on every stage.

**All six share one health value** — a couple of hits, rising slowly with
depth. Variety between them is colour, silhouette and speed, never health, so a
cherry never secretly takes longer than a lime. Speed may vary (the kiwi is the
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
later. In a game where picking a lane is worth health, that lag is unusable.

Two separate knobs control how this feels, and they are easy to confuse:

* **`DRAG_RANGE` is the gain** — how much road one thumb travel covers. This is
  what makes the character feel fast or slow, and lowering it costs nothing.
* **`FOLLOW_RATE` is the responsiveness.** Lowering this to slow the character
  down just brings back the drift.

There is also a **traverse cap** so a violent flick cannot teleport the
character edge to edge in one frame. It must stay generous — set too low it
becomes the dominant constraint rather than an edge case, which is the towed
feel wearing a different hat.

Keyboard steering stays velocity-based, since a key has no position.

### The blocker pool

**Fourteen blockers, and for now every one of them can appear on any stage.**

The design has stage-native blockers (sugar cane on the beach, cinnamon in the
winter) with a wildcard pool on top. Only the beach exists yet, so confining
each blocker to its unbuilt stage would leave thirteen of the fourteen drawn and
never seen. Treating the whole roster as wildcards uses every one of them today
and gives the waves real variety; the stage weighting returns when the stages
themselves do.

This is what keeps the endless tail alive. The stage-native blockers are
predictable by design; once a guest has seen the beach three times they know
exactly what the sugar cane does. Wildcards mean the composition of a wave is
never fully known, and the deeper the run goes the more of the wave is drawn
from the wildcard pool rather than the stage's own roster.

They obey every normal blocker rule — must be killed, scaling health, contact
damage. The pool:

| Blocker | Weapon | Home stage |
|---|---|---|
| Sugar cane | Machete | Beach |
| Tequila worm | Sombrero, bandolier | Desert |
| Mezcal bottle | Sabre | Desert |
| Cinnamon stick | Mallet | Winter |
| Coconut | Energy sword | Winter |
| Grapefruit | Baseball bat | Winter |
| Candy cane | Undead lurch | Winter |
| Milk carton | Wrench | wildcard |
| Beer can | Length of pipe | wildcard |
| Coconut cream can | Can opener | wildcard |
| Ginger beer bottle | Katana | wildcard |
| Cherry | — | wildcard |
| Almond | Giant spoon | wildcard |
| **Blender** | **Boxing gloves** | **wildcard — the elite** |

The blender is the heaviest of them and is the pool's **elite**: 1.6x the health
of an ordinary blocker, slower with it, and worth double points.

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
| **Laser** | A round **passes through** what it hits — the answer to a wall of blockers rather than to a crowd. Deliberately slow: at six rounds a second it was eighteen damage a second AND piercing, which made every other gun pointless. The piercing is the weapon; the rate of fire is what it pays for it. |
| **Flamethrower** | Shortest range, widest spread, high damage. Sets enemies alight - they keep burning and taking damage after the stream leaves them, so a sweep across a crowd kills things that walked out of range. The close-range panic button: devastating if they reach you, useless at distance. |

### Helpers

Rum-bottle companions that flank the player, move with them, and fire the base
pistol. Killed by contact with any enemy that reaches them. **Reset to zero at
the end of every stage.**

Helper positions come from one shared function, so a helper is drawn exactly
where it shoots. A slot that would fall off the screen is **mirrored to the
other side rather than clamped** — clamping pinned the outside helper to the
screen edge, a few pixels from the hero, so the squad collapsed into one
overlapping shape precisely when the guest was dodging hardest. Each side keeps
its own rank count, or the mirrored helper lands on top of the one it was
avoiding.

They are extra bodies, **not a multiplier on the hero's gun**, and two separate
things enforce that:

* **Their rounds are worth a fifth of a pistol round.** At full strength they
  used to hit as hard as the hero, so three of them quadrupled his output and
  cleared the road on sight.
* **They keep their own trigger, at the pistol's rate.** Firing whenever the
  hero fired meant picking up an uzi secretly made the helpers fire at thirteen
  rounds a second as well.

A full rank of six roughly doubles his output — worth taking, and nowhere near
the end of the difficulty curve.

---

## Gates

Periodically a pair of panels sweeps down the field. The player steers through
one — or past both.

### Panels do not span the road

Each panel reaches about **72% of the way** from the centre to the road edge,
leaving the outer edges open. A gate is therefore never compulsory: you can
refuse it entirely, but only by committing to the very edge of the road, which
usually means giving up position on whatever else is coming.

This matters most at depth, where gate quality decays until **both sides are
negative**. Being forced to eat one of two punishments is not a decision; being
able to spend your position to dodge both is.

### Shooting a gate cures it

Rounds landed on a panel walk it **up its own ladder, one rung at a time**. A
`-3 RUM` becomes `-2`, then `-1`, then `NOTHING`, and only then starts paying
out. Each rung costs five rounds, so dragging a `-3` all the way to a reward is
fifteen rounds not spent on the things walking at you.

That is the point: a bad gate stops being something that happens *to* you and
becomes a problem you can shoot your way out of, priced in the only currency the
game has — where your bullets go.

* Every ladder passes through a **neutral** rung, so a negative can always be
  walked to harmless before it becomes a reward.
* A panel already at the top of its ladder absorbs nothing.
* **One round counts once.** The cure check runs every frame and a bullet stays
  in range of a panel for several of them; without a spent flag a single shot
  cured a gate four or five times over.
* Bullets are **not** consumed. A gate is a sign, not a wall — eating rounds
  would stop the guest defending themselves from whatever is behind it.
* A round through the open edge cures nothing.

The panel fills white from the bottom as it charges toward the next rung. That
fill is the entire feedback loop: without it the guest has no idea whether their
rounds are doing anything.

### The ladders

| Family | Rungs, worst to best |
|---|---|
| **Helpers** | -3 RUM · -2 RUM · -1 RUM · **NOTHING** · +1 RUM · +2 RUM · +3 RUM |
| **Money** | -$5 · **NOTHING** · +$5 · +$10 |
| **Gun** | PISTOL (downgrade) · **NOTHING** · SHOTGUN · UZI · FLAME |
| **Health** | POISON · **NOTHING** · +HEALTH · BOMB |

Money is the only gate outcome that outlives the run. That tension — take the
power you need now, or bank toward a permanent upgrade — is the core decision of
the game and should stay sharp at every difficulty.

### Gates get clear road

Spawning **stops for a beat before a gate arrives**, and again while it is at
the top of the field, so a gate does not come down inside a crowd. Stages are
longer to pay for it, which is the right trade: a gate the guest cannot read is
a decision they cannot make.

A gate also **outruns the wave**, and its speed scales with the stage to keep
doing so. Slowing it to the world's pace reads better physically — it is
scenery — but it then spends ten seconds of every cycle on screen and gets
overtaken by every enemy on the field, so the gap it was given at spawn closes
before it arrives. Outrunning them means the only thing that needs clearing is
the road *ahead* of it: one short quiet window rather than a permanent hole in
the wave.

### Labels

Drawn at the largest size that fits and **clipped to their own panel**. Fixed
sizing smeared "NOTHING" and "POISON" through each other at distance; refusing
to draw a label that didn't fit was worse, since a gate you cannot read is a
gate you cannot make a decision about.

## Economy

### Stats

| Stat | Range | Notes |
|---|---|---|
| **Health** | bar | Refills at the start of every stage. |
| **Armor** | 0–10 slots | Absorbs damage before health. Does **not** refill — must be re-bought. |
| **Luck** | 0–100%, in 10% steps | Raises the frequency and strength of good gate offers. |
| **Money** | $ | Earned at gates and from kills. |

### Shop (between stages)

Three purchases, each a row: **icon · label · count · a segmented bar that
fills · a priced buy button**.

The bars are segmented rather than continuous because every one of these is a
small countable stock — ten armour plates, three bombs, ten steps of luck — and
a guest deciding whether to spend needs to see "three more" at a glance, which a
smooth bar never tells them. A row with nothing left to buy drops its button for
`FULL`, and luck shows `ONE PER STOP` once its clover is spent.

Luck sits beside armor because those two are what **persist**: what a guest is
really buying at this stall is a better next run, not a better next stage.

The rows are anchored to the BOTTOM of the screen, under the thumb already
holding the phone — the logical height flexes 480..620, so fixed offsets strand
the buttons in the middle of a tall display.

Fronted by the **shopkeeper — a Scotch bottle** leaning in the window of a tiki
market booth, who has something to say about every purchase (see Quips). Money
and luck are displayed here, since this is the only place they're actionable.

| Item | Cost | Effect |
|---|---|---|
| Four-leaf clover | Rises with current luck | +10% luck. **Max one per shop visit** — luck compounds into every future gate, so letting a rich guest buy the whole track in one stop would end the gate decision permanently. |
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

### Pressure — the game watching the run

The stage curve sets a floor, but it cannot see how a run is actually going. A
guest who takes three good gates in a row out-guns the wave entirely:
everything dies at the horizon, the field empties, and the stage becomes a walk
down a beach with nothing to do.

So the game measures **how deep enemies get before they die** and opens the taps
until they are reaching mid-field again.

* `killDepth` is a running average of where enemies stop existing. A **miss**
  counts nearly twice as heavily as a kill — an enemy getting past is the
  clearest evidence the guest is at their limit, and pressure has to come off
  faster than it went on. The loop must never be the reason a run ends.
* `pressure` multiplies the spawn rate, between **1x and 4x**.
* It is floored at 1, so it can only ever ADD to the stage curve. A struggling
  guest is left alone.

It is a closed loop, not a difficulty setting — lose the gun at the next gate
and the pressure falls back on its own. Measured behaviour:

| Guest | Pressure | What happens |
|---|---|---|
| Kills everything at the horizon | 1 -> 4 over ~20s | Field fills from 0 to 13 enemies |
| Killing around mid-field | 1.00, flat | Loop never interferes |
| Only killing close in | 1.00 floor | No extra pressure piled on |
| Barely killing anything | 1.00 floor | Left alone entirely |

### The shape of one stage

A stage is not one flat rate. Spawning ramps about 40% between the opening and
the boss, so it starts light enough to find your feet after the shop and is
pressing by the time the boss arrives. Stage one opens at roughly 1.4 enemies a
second and reaches 1.9 by the end.

This is separate from the pressure loop above: the ramp **always** happens,
where pressure only responds to how the guest is actually doing.

### The stage curve

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

**Beating the King** plays the blimp escape — *"You think you can catch me that
easily?"* — before the shop, rather than instead of it. Bosses cycle, so it
comes round again, which is the intended shape: the King gets away and the next
loop is harder. Once the real stages exist this belongs to the Castle rather
than to a boss name.

---

## Quips (barks)

The hero and the shopkeeper talk. Comic speech bubbles, **drawn in code** from
pools of one-liners, randomly injected — so the pools can grow to hundreds of
lines without a single new sprite, and a regular who plays twenty runs keeps
hearing new material.

Three triggers, each with its own pool and its own staging.

### 1. Gate pickup — non-blocking

The hero turns to camera (`player-turn.png`), a small bubble pops, he turns
back. **The game does not pause.**

**Two pools, chosen by what the gate actually did.** A `+3 RUM` gets a cheer
from `pickup`; a `POISON` gets a groan from `downgrade`. A neutral rung says
nothing at all, because nothing happened. The core records the outcome as it
applies the gate — by the time the bark is raised the gate is gone, so there is
no way to tell after the fact.

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
  pickup:    [ /* gate helped   */ ],
  downgrade: [ /* gate hurt     */ ],
  shop:      [ /* purchase      */ ],
  boss:      [ /* boss defeated */ ],
};
```

Currently 152 lines: 33 pickup, 14 downgrade, 13 shop, 92 boss.

* **Anti-repeat**: draws shuffle through the whole pool before any line repeats,
  rather than picking at random each time. Random picking will visibly repeat
  within a handful of draws and make a large pool feel small.
* **Length cap**: bubbles are readable at a glance or they are not read at all.
  `QUIP_LIMITS` holds the cap per pool — 44 characters for the two gate pools
  (they get 1.2 seconds), 72 for shop and boss, which block.
* **Renderable characters only.** These are drawn with the cabinet's bitmap
  font, and `drawText` silently substitutes a question mark for a glyph it does
  not have. That is a bug that ships happily: nothing errors, and a guest reads
  `IT?S GOOD TO BE THE KING`. Curly apostrophes and ellipsis characters are the
  usual culprits, since anything that autocorrects inserts them invisibly — use
  a straight `'` and three full stops.
* Pools can be extended at any time by editing that one file — no other change
  needed. **Every rule above is enforced by a test**, so a line that breaks one
  fails the build rather than reaching a guest.

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

**Resolved.** The hero's label originally carried a real spirits brand's
wordmark; it now reads **TROPICAL FIRE**, an original mark, across the in-game
sprites and every story panel. The green-and-yellow overproof look is a style
and is fine to evoke — it was the wordmark that carried the risk.

The same rule applies to anything drawn later: tequila, mezcal, beer and
cinnamon characters all use invented labels.

---

## Open

* **Cocktail pairing** — the other two games hang off a drink on the menu. Using
  a placeholder until the pop-up's cocktails are chosen.
