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

## Starting a run

1. The marquee. **Tap to start**, or **high scores** — which hands the guest back
   to the cabinet's own attract screen, where the board lives. That is what
   `onShowScores` on `ArcadeGameProps` is for; it is optional, and the button is
   not drawn for a game that does not pass it.
2. Three pages of how to play, once per run. Each demonstrates its rule with
   real bottles rather than only stating it.

Only the scores button is a target you have to hit. Anywhere else on the
marquee starts the game — missing "start" on a front page is a guest deciding
the game is broken.

## The panels

**Nothing between stages moves itself on.** Every panel waits for a tap, and
every one carries the same prompt in the same place at the bottom: TAP TO
ADVANCE, except the three where the tap does something more specific than "go
on" — starting the round, spending a continue, ending the run.

They used to sit for two to four seconds and then advance themselves. Reading
speed is not a constant — somebody is holding a drink, somebody else is showing
the screen to a friend — and a panel that leaves while you are still reading it
cannot be got back. Waiting costs a tap the player was going to make anyway.
Attract mode is the exception: with nobody there to tap, it walks itself
through.

Every story panel is shown through the same fixed FRAME, centred on black, with
the picture contained inside it — never cropped. Fitting each panel to the
screen instead meant every one was scaled differently, so the cast turned up at
a different size each time and the sequence looked unsteady; and cropping the
overflow took the top off the speech bubble on the taller panels, so a guest
could be halfway through a line the player never got to read.

The footer bands — the round tally, the continue count — sit INSIDE the frame
along its bottom edge. Outside it they float on the black surround and read as
a second, unrelated panel.

## The stage flow

1. The bartender: *"Someone said you wanted to order a shot?"*
2. The guest, with their line in the speech bubble, and the recipe underneath.
3. The bartender: *"Weird… never heard of that one myself but let's do it!"*
4. The round's shot, full screen: its name, the four bottles in pour order, what
   the guest actually ordered and how much of it, and how many swipes there are
   to do it in.
5. The board pours in. Anything that matches on the way down breaks — for the
   show of it only: the deal pays no score and fills none of the order, because
   a stage that could be handed to you before you touched it is not a stage.
6. Play.
7. Cleared, in three beats, each waiting for its own tap:
   1. **STAGE CLEARED!** pops up over the finished board, which is dimmed but
      still there underneath.
   2. The guest, delighted, holding the shot, with the round score and the
      running total in the band along the bottom.
   3. **NEXT ROUND!** pops up over that same screen — over the guest, but
      *under* the score band, which is drawn last so the payout stays at full
      strength while everything behind it dims.

   Neither banner gets a screen of its own. The moment each one announces
   belongs to the picture underneath it, and cutting to black would take that
   picture away at the instant the player earned the right to look at it. This
   used to be one screen doing all three jobs, and the score under the guest's
   face got read as decoration while the fact that another stage was coming was
   never stated at all. The next stage is not dealt until the last tap, so
   nothing on screen is swapped out from under the player mid-sentence.
8. Failed, in two beats: **STAGE FAILED** pops up over the board first, for the
   same reason the clear does — the position that beat them is what is being
   talked about, and it is still on screen. Then the guest, furious: *"Where is
   my shot??"* Three continues; a continue re-deals the same stage rather than
   handing back the position that just beat them, and drops straight back to the
   recipe — they have just watched the guest order this, and they are trying
   again rather than starting over. Which screen follows the banner — one more
   go, or the end of the run — is decided on the way out of it, so the count of
   continues is read at the moment it is about to be shown.

Each stage draws a random order and a random guest, avoiding what came up
recently, so nobody at the bar is reading the same joke as the person next to
them.

## The bartender

He stands on the bar above the board for the whole stage and reacts to the last
thing that happened: **concentrating** by default, a **flinch** when a swipe
breaks nothing, a **grin** when it does, and **both arms up** for the guest's
own shot. Louder reactions interrupt quieter ones, never the other way round,
and each settles back to concentrating after a second or two — a grin still on
his face three moves later stops being feedback and becomes wallpaper.

He is the game's only continuous feedback that is not a number, so he is given
the room to be read at a glance: centred, cut off by the top of the grid, and
filling everything above it. There is no scenery between him and the board —
there used to be a drawn shelf, and losing it roughly doubled his size. Only his
WIDTH is capped, because on a tall phone the height alone would make him more
than half the screen across and the readouts would end up on his shoulders.

The readouts are keylined rather than sitting on a panel, since a panel would
simply have erased him, and the order meter runs along the very top edge — at
the foot of the HUD it was exactly where his chest is now.

All four moods are cut from ONE shared rectangle at import time, so they are
identical in size and register with each other; he changes expression without
changing size or hopping sideways. A test asserts that.

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
Everything is in. The ten bottles, twenty-nine guests, the bartender's two
lettered panels and his four reactions, the bar back's nine-frame run, the
coffee cup, the marquee and the three between-stage banners.

The banners are keyed by the FLOOD ONLY — the connected fill in from the border
— and never by the stray-colour pass every other sprite gets. Both are lettered
in bright green over a magenta starburst, which is to say they are made almost
entirely of the two colours that pass every stray test in the importer: run it
over **STAGE CLEARED!** and the word CLEARED disappears, along with the lime.

One thing the flood cannot save: on the *Stage Cleared* sheet the bright pink
rays behind the shot glass are drawn in the same magenta as the background and
touch it, so they key out with it. The purple rays survive and the banner reads
fine without them — but if they are wanted, they need redrawing in a pink that
is not the key colour, the way the *Next Round* and *Stage Failed* sheets
already do it.

Two sheets are cut as FRAMES — the reactions and the bar back — and both are
cropped with a single shared rectangle covering all of them, so a character
cannot change size or hop sideways between poses. The bar back's strip is also
written at a width that divides exactly by its frame count; a width that does
not divide leaves every cell boundary a fraction of a pixel out and smears a
sliver of the next frame into this one.

The bar back throws his own bottles — they are drawn into his frames — so the
game plays the sheet and adds no particles of its own. He runs along the board's
TOP EDGE, feet on the rim and body up in the back bar, passing in front of the
bartender: in from the right, a turn, then back out to the right. He used to
cross the middle of the screen, which put him over the fourth and fifth rows —
squarely on top of the bottles being read, at the moment the board is refilling
and they most need to be seen. His sheet faces LEFT, so he is mirrored on the return leg only, and
`barBackPass` in constants.ts is the one place that rule lives.
