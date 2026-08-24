# Let's Do Shots!

A match-three built for the Pop Up Zone cabinet. A guest orders an invented
shot, and you clear their order off a grid of bottles before your swipes run
out. Dr. Mario on the NES is the reference for the look; the movement is not —
bottles fall, land, squash and shatter with weight to them.

Attach it to a cocktail from the admin panel with the game key
**`lets-do-shots`**.

## The files

| File | What lives there |
| --- | --- |
| `bottles.ts` | The ten spirits: ids, labels, signature colours. |
| `orders.ts` | A hundred drink orders — the guest's line and its four bottles. |
| `shotsCore.ts` | Every rule. No canvas, no React, no clock. |
| `stages.ts` | The difficulty curve, and one stage's rules generated from it. |
| `constants.ts` | Geometry and palette. |
| `guestArt.ts` | **Generated** by `scripts/shots-art.mjs`. Speech-bubble rectangles. |
| `sprites.ts` | Loading the art, and a code-drawn stand-in for each piece of it. |
| `ShotsCanvas.tsx` | The canvas, the frame loop and swipe handling. |
| `LetsDoShots.tsx` | The stage flow, the animation, and the drawing. |

The split that matters is `shotsCore.ts` against everything else. The rules are
pure functions of a state object and a seeded generator, so the same seed plays
the same stage and the whole difficulty curve can be simulated in a test rather
than discovered at the bar. `__tests__/shots.test.ts` does exactly that.

## The move

Flick a bottle into one of its four neighbours, or tap one and then tap the
neighbour. Three or more of a kind in a line break.

* **Three** — just the three.
* **Four** — the run, plus everything orthogonally against it.
* **Five, or an L or a T** — the run and its full eight-way surround.
* **The bonus shot** — see below.

A swap that breaks nothing is refused and **costs no swipe**. On a phone a
mis-registered drag is the most common input there is, and charging for one
makes the game feel like it is cheating.

Everything falls into the holes, the bar back restocks the top, and anything
that lines up on the way down breaks too. Each further link in that chain is
worth more than the last.

## The bonus shot

Every stage the guest orders a named shot — a "Bowie Moonboot", a "Cleopatra Fax
Machine" — and its recipe sits under the board. Line those four bottles up in
recipe order, in a row or a column, read either way, and the whole thing goes up
at **double score**, taking everything around it in all eight directions.

At least one bottle the shot pours is always something the guest's order asks
for. That is what ties the two halves of a stage together: building the shot is
also the fastest way to fill the order, rather than a side quest.

## The coffee cup

A cup turns up on the board every eight or nine swipes. It never matches. Break
anything next to it and it goes off, handing back three swipes.

It is bounded by **two** limits, and both are load-bearing:

* at most two cups on the board at a time, and
* at most one new cup per player move, however long the cascade runs.

Without the second, cups arrived faster than they were spent — a player who
simply always broke the cup ended each move with more swipes than they started
it, no stage could be lost, and a bot ground stage 25 to a win against an order
nearly twice what it should have been able to fill. A cup is a reprieve, never
an income.

## The curve

Measured, not guessed. A swipe breaks six to fifteen cells once its cascade is
counted, about 2.8 of those are a kind being asked for, and the cups hand back
roughly another half a swipe — so the real budget is around four and a half
useful bottles per swipe, not the two or three it looks like from the board.

Against that, a competent player clears the first few stages outright, sits
around 80% at stage ten and a shade over 70% from stage sixteen on. Three
continues make a typical good run about fourteen stages — ten or fifteen
minutes, which is the right length for a game played standing at a bar.

The single biggest lever is the **palette**: five of the ten spirits early,
seven later, never all ten. With the full cast on a seven-by-eight board a
random three-in-a-row is rare enough that the board reads as broken.

## The stage flow

1. The bartender: *"Someone said you wanted to order a shot?"*
2. The guest, with their line in the speech bubble, and the recipe underneath.
3. The bartender: *"Weird… never heard of that one myself but let's do it!"*
4. The board pours in. Anything that matches on the way down breaks — for the
   show of it only: the deal pays no score and fills none of the order, because
   a stage that could be handed to you before you touched it is not a stage.
5. Play.
6. Cleared: the guest, delighted, holding the shot. Round score and running
   total.
7. Failed: the guest, furious. *"Where is my shot??"* Three continues; a
   continue re-deals the same stage rather than handing back the position that
   just beat them.

Each stage draws a random order and a random guest, avoiding what came up
recently, so nobody at the bar is reading the same joke as the person next to
them.

## The art

Sources live in `~/Desktop/Game Assets/Shots/`. Run:

```bash
node scripts/shots-art.mjs
```

That cuts the ruled sheets apart, keys out the magenta, drops the printed
captions, quantises everything to a palette PNG, and regenerates `guestArt.ts`
with the speech-bubble rectangles measured off each panel. `--dry` reports
without writing.

Everything the game draws has a code-drawn stand-in, so a stage is playable from
the first frame and the painted art fades in underneath as it arrives.

### Still to be drawn

Two files are wired up and will be picked up automatically the moment they land
in `public/popup/art/shots/`:

| File | What it is |
| --- | --- |
| `powerup-coffee.png` | The coffee cup, drawn to sit in a grid cell like a bottle. Same magenta background as the bottle sheet. |
| `barback.png` | The bar back who runs across restocking the shelf. One row of **four** frames, left to right, a walk cycle, facing right. |

Both are drawn in code until then — the cup as a mug of coffee, the bar back as
a small figure in an apron.
