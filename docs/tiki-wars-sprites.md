# Tiki Wars — sprite list

Every asset the game needs, with sizes, frame counts and descriptions written so
they can be used directly as generation prompts.

Companion to [`tiki-wars.md`](./tiki-wars.md), which is the design spec.

---

## Before you start

**Style contract — applies to every sprite below.**

> 90s console sprite art in the style of Metal Slug. Heavy black outline, flat
> saturated fills, cel-shaded highlights, exaggerated cartoon proportions.
> Transparent background. Full body, no cropping. Tropical tiki colour palette.

The hero rum-bottle render is the reference sheet — match its line weight,
outline colour, shading and eye style throughout.

**Two orientations, not interchangeable.** The camera looks down the field from
behind the player:

* **Back view** — player and helpers only. Seen from behind, walking away from
  camera, weapons pointing forward into the screen.
* **Front view** — every enemy and boss. Facing the camera, walking toward it.
* **Three-quarter hero pose** — key art only. Logo, intro panels, shop. Never
  in-game.

**Rules**

| | |
|---|---|
| Format | PNG, **true transparent alpha** (not white) |
| Deliver at | **1024 px on the long edge** unless stated otherwise |
| Never | draw small and upscale — always generate large, code downsamples |
| Test | fill it solid black; if unrecognisable, it won't read in game |

---

## Sprite sheets — the preferred format

**Every animated character is one PNG.** Rows are animations, columns are
frames, all cells the same size. The code slices the cell it needs, so the sheet
can be any resolution — only the **grid** has to match what's below.

This is easier to draw, and it also fixes something loose files get wrong. With
separate files, frame 2 quietly comes back a different size or off-centre from
frame 1, and the character bobs and jitters in game. A grid makes that
impossible: every frame shares a cell, so they cannot drift apart.

### Background: use flat magenta

Export with **real transparency** if the tool allows it. If it doesn't, fill the
background with **flat pure magenta `#FF00FF`** — no gradient, no checkerboard —
and the import will key it out. Magenta is used nowhere in this artwork, so it
can never be confused with the art itself.

**Do not rely on a checkerboard pattern.** A checkerboard drawn by an export
tool is just grey pixels; it carries no transparency at all. The first batch
arrived that way and had to have the background cut out by flood-filling in from
the edges. That worked — the heavy black outline stopped the fill — but it only
works because of that outline, and it is not something to depend on.

### Importing

`node scripts/tiki-art.mjs` copies from `~/Desktop/Game Assets/Tiki Wars/` into
the game and does four things the export cannot:

1. **Cuts the background** — keys out flat magenta, or flood-fills a baked-in
   checkerboard from the edges.
2. **Straightens the frames** — each frame is re-centred horizontally on its own
   pixel centroid. The first batch drifted about 100px across four cells, which
   reads as a side-to-side wobble. Vertical position is left alone, because the
   up-and-down in a walk cycle is the bob.
3. **Trims dead margin** — the game sizes a sprite by its cell height, so empty
   space inside the cell shrinks the character. Cropping is done once for the
   whole sheet so the frames stay registered and the bob survives.
4. **Downscales** — source art at 1536px tall is nine times more than the screen
   can ever show. The first batch was 19MB; after import it is about 2MB.

Nothing needs to be named or sized a particular way on your side — the mapping
from your filenames lives in that script.

### Laying out a sheet

```
        col 0        col 1        col 2        col 3
      +------------+------------+------------+------------+
row 0 |  walk 1    |  walk 2    |  walk 3    |  walk 4    |
      +------------+------------+------------+------------+
row 1 |  turn      |  shades    |  hit       |  (spare)   |
      +------------+------------+------------+------------+
```

* **Every cell exactly the same size.** Equal-width columns, equal-height rows.
* **Character centred horizontally** in its cell.
* **Feet on the bottom edge** of the cell, consistently. The game plants sprites
  by their feet, so a character floating higher in one cell will hop.
* **Transparent everywhere else.** No background, no frame, no guide lines, no
  padding that varies between cells.
* Unused cells can be left empty.

### The sheets

| File | Grid | Row 0 | Row 1 |
|---|---|---|---|
| `player.png` | 4 x 2 | walk cycle, 4 frames | turn-to-camera · turn-with-shades · hit · *(spare)* |
| `helper.png` | 2 x 1 | walk cycle, 2 frames | — |
| `lime.png` | 4 x 1 | walk cycle, 4 frames | — |
| `lemon.png` | 2 x 1 | walk cycle, 2 frames | — |
| `orange.png` | 2 x 1 | walk cycle, 2 frames | — |
| `kiwi.png` | 2 x 1 | walk cycle, 2 frames | — |
| `sugarcane.png` | 4 x 1 | walk cycle, 4 frames | — |
| `boss-baby-pineapple.png` | 2 x 1 | walk cycle, 2 frames | — |

Suggested cell size: **512 x 512**, giving e.g. a 2048 x 1024 `player.png`. Any
size works as long as the grid is right.

**Loose files still work.** Anything without a sheet falls back to the
individually-named files listed further down, and failing those to a code-drawn
placeholder. Sheets, loose frames and nothing at all can be mixed freely, in any
order, without a code change. Scenery and the shopkeeper stay loose files —
single images with nothing to animate, where a sheet would only add a layout to
get wrong.

**"On-screen max"** below is how tall the sprite gets at its closest approach, in
a 270×540 field. That is your detail budget — not the delivery size.

**Not needed as art** (drawn in code): bullets, muzzle flash, flame, fire on
burning enemies, explosions, gate panels, HUD bars, all text.

---

# Phase 1 — The Beach

Everything needed for a playable v1. **Start here.** Nothing in Phase 2 or 3 is
worth making until the beach proves fun.

## Branding

| File | Deliver | Frames | Description |
|---|---|---|---|
| `logo-tiki-wars.png` | 1400×1000 | 1 | Game logo. The words **TIKI WARS** in a chunky 90s arcade display face — carved-tiki or bamboo lettering, heavy black outline, warm yellow-to-orange gradient fill, slight upward arc. Crossed palm fronds or a tiki mask behind the text. Transparent background. |

## Player — **back view**

The base weapon is dual pistols, as in the hero render.

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `player-walk-1..4.png` | 1024 tall | 84 px | 4 | The rum bottle hero **seen from behind**, walking away from camera down a beach. Bottle body with cartoon arms and legs, green-and-yellow sneakers, cap-shaped head, both arms extended forward past the body so the guns are visible either side of the torso. Four-frame walk cycle: contact, passing, contact opposite, passing opposite. Consistent height and centre across all four. |
| `player-hit.png` | 1024 tall | 84 px | 1 | Same back view, recoiling — shoulders hunched, one knee buckling, head snapped back. Used for a damage flash. |

### Turn-to-camera poses — **three-quarter hero view**

The one place the hero pose appears in-game. Used for the quip system (see the
design spec): the character spins to face the player, says something, and turns
back. These replace the back-view sprite for about a second.

**The existing hero render is exactly this pose** — it can serve as
`player-turn.png` directly once it has transparent alpha and an original label.

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `player-turn.png` | 1024 tall | 84 px | 1 | The rum bottle hero turned to face the camera in a confident three-quarter action pose, both pistols out, grinning. This is the existing key-art render. |
| `player-turn-shades.png` | 1024 tall | 84 px | 1 | Identical pose and framing, but wearing black sunglasses and smirking rather than open-mouthed. Must line up pixel-for-pixel with `player-turn.png` so the game can cut between them as he puts the shades on. |
| `player-shades-drop.png` | 512×512 | — | 1 | A pair of black sunglasses alone, side-on, slight downward tilt — dropped in from above onto the face during the boss-kill beat. Transparent. |

### Weapon overlays — **back view**

Drawn **over** the walk cycle so the body animates once for all four guns.

**The walk cycle must have NO ARMS drawn into it.** This is the one hard
requirement, and the first batch showed why: the body was drawn holding two
pistols, so overlaying the shotgun put a shotgun *and* two pistols on screen at
once — four arms of hardware rather than a weapon swap.

So the body sheet is a bottle with legs and no arms, and **every** gun is an
overlay — including the base pistols, which need their own `gun-pistols` file
rather than being painted into the body.

Ideally the overlays are drawn **on the same canvas size as the walk frames**,
from the same pose. Then they land exactly where they were drawn and need no
alignment at all. Otherwise they have to be nudged into place by hand, which has
to be redone every time either side is re-exported.

| File | Deliver | Frames | Description |
|---|---|---|---|
| `gun-pistols.png` | 1024 tall | 1 | Both forearms and hands from behind, holding a matched pair of black-and-grey semi-automatic pistols pointing forward into the screen. Green-and-yellow wristbands. |
| `gun-shotgun.png` | 1024 tall | 1 | Both forearms from behind gripping one wide double-barrelled shotgun, wood stock, pointing forward. Held slightly lower and more central than the pistols. |
| `gun-uzi.png` | 1024 tall | 1 | Both forearms from behind, a compact black submachine gun in each hand, angled slightly outward, pointing forward. |
| `gun-flamethrower.png` | 1024 tall | 1 | Both forearms from behind gripping a stubby brass-and-copper flamethrower with a wide bell nozzle, pointing forward. A small green fuel tank strapped across the shoulders. Nozzle only — the flame itself is drawn in code. |

## Helper — **back view**

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `helper-walk-1..2.png` | 1024 tall | 62 px | 2 | A smaller, simpler rum-bottle companion **seen from behind**, walking away from camera, one pistol held forward. Same family as the hero but visually subordinate — slightly narrower, plainer label, no sneakers detail. Two-frame walk. |

## Enemies — **front view**

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `lime-walk-1..4.png` | 1024 tall | 60 px | 4 | **Lime soldier — the grunt.** A bright green lime with arms and legs, angry scowling cartoon face, wearing a small olive-green military helmet and ammo belt, marching **toward the camera**. Fists up. Four-frame march cycle. Should read instantly as "small, disposable, lots of them". |
| `lime-die.png` | 1024 tall | 60 px | 1 | The lime soldier splitting apart in a burst of green pulp and juice, helmet flying off. |
| `lemon-walk-1..2.png` | 1024 tall | 60 px | 2 | **Lemon soldier.** Same build and helmet as the lime but bright yellow, with a more oval body and a pointed tip at each end. Sour, squinting expression. Marching toward camera. |
| `lemon-die.png` | 1024 tall | 60 px | 1 | Burst into yellow pulp and juice, helmet flying. |
| `orange-walk-1..2.png` | 1024 tall | 60 px | 2 | **Orange soldier.** Same build and helmet, bright orange, rounder and slightly bulkier than the lime, dimpled peel texture, gruff scowl. Marching toward camera. |
| `orange-die.png` | 1024 tall | 60 px | 1 | Burst into orange segments and spray. |
| `kiwi-walk-1..2.png` | 1024 tall | 60 px | 2 | **Kiwi soldier — the fast one.** Same helmet, fuzzy brown exterior with a bright green sliced face showing the white core and black seeds. Leaner and more athletic than the others, leaning forward as it runs toward camera. Should look quick. |
| `kiwi-die.png` | 1024 tall | 60 px | 1 | Burst into green pulp and scattered black seeds. |
| `sugarcane-walk-1..4.png` | 1024 tall | 104 px | 4 | **Giant sugar cane monster — the blocker.** A towering segmented sugar-cane stalk, pale green and straw-yellow, with thick knotted arms, heavy stomping feet, and a snarling face with blunt teeth set into the stalk. Leafy fronds sprouting from the crown. Walking **toward the camera**, arms raised. Must read as a wall — visibly heavier and wider than the lime. Four-frame heavy stomp. |
| `sugarcane-die.png` | 1024 tall | 104 px | 1 | The stalk shattering into splintered cane segments and a spray of sugar. |

## Boss — **front view**

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `boss-baby-pineapple-walk-1..2.png` | 1400 tall | 170 px | 2 | **Baby Pineapple.** A fat, angry infant pineapple — small gold crown tilted on its leafy crown, chubby limbs, a diaper, and a huge knobbled wooden club dragged in one fist. Furious scrunched face. Advancing **toward the camera**. Two-frame waddle. |
| `boss-baby-pineapple-attack-1..2.png` | 1400 tall | 170 px | 2 | Same character: frame 1 winding the club back overhead, frame 2 slamming it down toward the camera. |
| `boss-baby-pineapple-die.png` | 1400 tall | 170 px | 1 | Flat on its back, crown rolling away, club dropped, X-eyes, pineapple chunks flying. |

## Beach scenery

| File | Deliver | Frames | Description |
|---|---|---|---|
| `bg-beach-sky.png` | 2048×1024 | 1 | Bright tropical sky. Big warm sun low and centred, layered flat cartoon clouds, gradient from deep turquoise at the top to warm yellow at the horizon. **Must tile seamlessly left-to-right** and have generous empty sky at the top — tall phones stretch this upward. |
| `bg-beach-horizon.png` | 2048×512 | 1 | The distant band where ocean meets sky: flat turquoise sea with white cartoon wave-caps, a couple of tiny sailboats and a small island with palms. **Tiles seamlessly left-to-right.** Bottom edge meets the sand. |
| `prop-palm.png` | 1024 tall | 1 | A single leaning coconut palm, thick curved trunk, six or seven broad fronds, a cluster of coconuts. Lit from the front. Sits at the roadside and scales with depth. |
| `prop-beachgoer-1.png` | 1024 tall | 1 | A cheerful cartoon beachgoer in a swimsuit and sunglasses holding a tropical drink, standing side-on, oblivious to the war. |
| `prop-beachgoer-2.png` | 1024 tall | 1 | A second beachgoer, different build and swimwear colour, lying on a striped towel under a beach umbrella. |
| `tex-sand.png` | 512×512 | 1 | **Seamlessly tileable** pale golden beach sand — flat cartoon shading, scattered small shells, pebbles and ripple marks. No strong directional lighting; this scrolls under the player. |

## The shop

Shown between stages. The shopkeeper is a static scene, not an animated
character — the bubble text does the work.

| File | Deliver | Frames | Description |
|---|---|---|---|
| `shop-booth.png` | 1400×1600 | 1 | A wooden tiki-hut market booth seen straight on, thatched palm roof, bamboo posts, a hand-painted sign across the top reading **SHOP** in chunky carved letters. An open serving window in the middle, dark inside. Tiki masks and glass bottles on shelves either side. Warm lantern light. The window is empty — the shopkeeper is a separate file that sits inside it. |
| `shopkeeper-scotch.png` | 1024 tall | 1 | The shopkeeper: a **Scotch whisky bottle** character, upper body only, leaning on the counter with both elbows as if framed in the booth window. Squat amber-glass bottle, tartan band around the neck, a small flat cap, bushy eyebrows and a knowing, wry expression — the wise old merchant. Generic label, no real brand. Same outline and shading style as the hero. Composed so the bottom edge crops naturally at the counter line. |
| `shopkeeper-scotch-happy.png` | 1024 tall | 1 | Same character and framing, grinning broadly and holding up a coin or a finger — shown for a beat after a purchase, while his quip bubble is up. |

## Icons

Shown on gate panels, in the shop, and in pickups. Read at roughly **32 px**, so
each must work as a **flat two-colour shape with a heavy outline**. Square canvas.

| File | Deliver | Description |
|---|---|---|
| `icon-rum-bottle.png` | 512×512 | The hero rum bottle, front-on, no limbs — just the bottle. Helper pickup. |
| `icon-pistol.png` | 512×512 | A single black semi-automatic pistol, side-on. |
| `icon-shotgun.png` | 512×512 | A wide double-barrelled shotgun with wood stock, side-on. |
| `icon-uzi.png` | 512×512 | A compact black submachine gun, side-on. |
| `icon-flamethrower.png` | 512×512 | A stubby brass flamethrower with a bell nozzle and green tank, side-on. |
| `icon-bomb.png` | 512×512 | A classic round black cartoon bomb with a lit fuse. |
| `icon-money.png` | 512×512 | A fat roll of green banknotes tied with a band, or a single folded bill. Must read as money at a glance. |
| `icon-poison.png` | 512×512 | A small dark bottle with a skull-and-crossbones label and a sickly green drip at the neck. |
| `icon-black-cat.png` | 512×512 | A black cat sitting, back arched, yellow eyes, tail curled — unmistakable silhouette. |
| `icon-armor.png` | 512×512 | A coconut-shell breastplate or bamboo-slat chestguard, front-on. Tiki, not medieval. |

---

# Phase 2 — The world

Desert, Winter and Castle stages, plus luck. Not needed until v1 plays well.

## Wildcard blockers

Stage-agnostic blockers that can appear anywhere — the pool that keeps the
endless tail fresh. All front view, advancing toward camera, and all must read
as **heavy and unkillable-by-accident**: visibly wider and taller than a grunt,
weapon clearly raised.

Two-frame walk cycles here rather than four. There are seven of them and they
appear in crowds at mid distance, so the extra frames buy less than they cost.
Say the word if you'd rather have four.

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `wild-milk-walk-1..2.png` | 1024 tall | 104 px | 2 | **Angry milk carton.** A tall waxed paper milk carton with limbs, gable top, curdled-looking off-white body with a grubby blue-and-white generic label, furious scrunched face, swinging a heavy steel wrench. |
| `wild-milk-die.png` | 1024 tall | 104 px | 1 | Split open and crumpled, milk gushing out across the ground, wrench dropped. |
| `wild-beer-walk-1..2.png` | 1024 tall | 104 px | 2 | **Angry beer can.** A dented aluminium beer can with limbs, generic red-and-silver label, pull-tab top bent like a scowling brow, foam dribbling from the opening, hefting a rusty length of lead pipe over one shoulder. |
| `wild-beer-die.png` | 1024 tall | 104 px | 1 | Crushed flat like a stomped can, foam spraying, pipe clattering away. |
| `wild-coconutcream-walk-1..2.png` | 1024 tall | 104 px | 2 | **Angry coconut cream can.** A squat tin can with limbs, generic label showing a palm and a coconut, lid peeled half open like a snarling jaw with white cream oozing at the edge, brandishing a hooked can opener. |
| `wild-coconutcream-die.png` | 1024 tall | 104 px | 1 | Lid blown off, white cream erupting upward, can crumpled. |
| `wild-gingerbeer-walk-1..2.png` | 1024 tall | 104 px | 2 | **Angry ginger beer bottle.** A stout amber-brown bottle with limbs, ceramic-style generic label, cork cap tilted like a conical hat, narrow furious eyes, holding a katana in a two-handed samurai stance. The most disciplined-looking of the pool. |
| `wild-gingerbeer-die.png` | 1024 tall | 104 px | 1 | Shattered into brown glass shards mid-slash, ginger beer foaming out, katana embedded in the ground. |
| `wild-pomegranate-walk-1..2.png` | 1024 tall | 104 px | 2 | **Angry pomegranate.** A big round deep-red pomegranate with limbs and a crown-shaped calyx on top, thick leathery skin, split down one side showing red seeds like gritted teeth, hauling a rough plank of lumber with nails in it. |
| `wild-pomegranate-die.png` | 1024 tall | 104 px | 1 | Burst wide open, hundreds of red seeds spraying outward, plank splintered. |
| `wild-almond-walk-1..2.png` | 1024 tall | 104 px | 2 | **Angry almond.** A large teardrop-shaped almond with limbs, tan pitted skin with the classic grain lines, tiny furious eyes set high, wielding an oversized wooden spoon like a club. Slightly comic — the least intimidating of the pool. |
| `wild-almond-die.png` | 1024 tall | 104 px | 1 | Cracked in half like a shelled nut, spoon snapped, tan fragments flying. |
| `wild-blender-walk-1..2.png` | 1024 tall | 120 px | 2 | **Angry blender — the elite.** A chunky retro countertop blender with limbs, glass jar body half full of a sloshing tropical slush, chrome base, spinning blades visible inside, a control panel of buttons forming a snarling face, wearing big red boxing gloves. Visibly the biggest and heaviest of the pool. |
| `wild-blender-die.png` | 1024 tall | 120 px | 1 | Glass jar shattered, slush exploding outward, motor base sparking, one boxing glove flying off. |

---

## Desert

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `worm-walk-1..4.png` | 1024 tall | 104 px | 4 | **Tequila worm blocker.** A fat pale-gold agave worm standing upright on its tail, oversized embroidered sombrero, thick segmented body, tiny angry eyes, a bandolier across the middle. Advancing toward camera. |
| `worm-die.png` | 1024 tall | 104 px | 1 | Flattened, sombrero spinning off, X-eyes. |
| `mezcal-walk-1..4.png` | 1024 tall | 104 px | 4 | **Mezcal bottle blocker.** A tall dark-green glass bottle with limbs, a huge curled black moustache, narrowed eyes, brandishing a curved sabre. Generic label only — no real brand. Advancing toward camera. |
| `mezcal-die.png` | 1024 tall | 104 px | 1 | Shattering into green glass shards, sabre flying. |
| `boss-knight-pineapple-walk-1..2.png` | 1400 tall | 170 px | 2 | **Knight Pineapple.** A pineapple in full plate armour — steel breastplate, pauldrons, visored helm pushed back over the leafy crown, longsword in one gauntlet, small shield in the other. Heavy armoured advance toward camera. |
| `boss-knight-pineapple-attack-1..2.png` | 1400 tall | 170 px | 2 | Sword raised overhead, then swept down toward camera. |
| `boss-knight-pineapple-die.png` | 1400 tall | 170 px | 1 | Collapsed, armour pieces scattered, sword embedded in the ground. |
| `bg-desert-sky.png` | 2048×1024 | 1 | Deep orange-to-purple dusk sky, big low setting sun, thin flat cloud bands. Tiles horizontally, generous top. |
| `bg-desert-horizon.png` | 2048×512 | 1 | Layered flat mesa and mountain silhouettes in dusty purple and rust. Tiles horizontally. |
| `prop-cactus-1.png` | 1024 tall | 1 | A tall classic saguaro cactus with two raised arms, ribbed, small spines and a pink flower on top. |
| `prop-cactus-2.png` | 1024 tall | 1 | A squat barrel cactus cluster, rounder and wider than the saguaro. |
| `prop-coyote.png` | 1024 tall | 1 | A scrawny grey-brown coyote sitting side-on, head tipped back mid-howl. |
| `tex-desert.png` | 512×512 | 1 | **Seamlessly tileable** cracked orange desert hardpan with scattered pebbles and dry scrub. |

## Winter

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `cinnamon-walk-1..4.png` | 1024 tall | 104 px | 4 | **Cinnamon stick blocker.** A thick rolled cinnamon-bark stick with limbs, rough curled brown texture, a heavy wooden mallet in both hands, scowling knothole face. Advancing toward camera. |
| `cinnamon-die.png` | 1024 tall | 104 px | 1 | Splintering into bark curls and cinnamon dust. |
| `coconut-walk-1..4.png` | 1024 tall | 104 px | 4 | **Coconut blocker.** A large hairy brown coconut with limbs, the three "eyes" forming a glaring face, wielding a glowing cyan energy sword. Advancing toward camera. |
| `coconut-die.png` | 1024 tall | 104 px | 1 | Cracked in half, white flesh and coconut water spraying, sword fizzling out. |
| `grapefruit-walk-1..4.png` | 1024 tall | 104 px | 4 | **Grapefruit blocker.** A big pink-red grapefruit with limbs and a thuggish grin, swinging a wooden baseball bat over one shoulder. Advancing toward camera. |
| `grapefruit-die.png` | 1024 tall | 104 px | 1 | Burst into pink pulp, bat clattering away. |
| `candycane-walk-1..4.png` | 1024 tall | 104 px | 4 | **Zombie candy cane.** A tall red-and-white striped candy cane with a hooked top, cracked and chipped, undead grey-green limbs, hollow glowing eyes, lurching toward camera with arms outstretched. |
| `candycane-die.png` | 1024 tall | 104 px | 1 | Snapped into striped shards. |
| `boss-santa-pineapple-walk-1..2.png` | 1400 tall | 170 px | 2 | **Santa Pineapple.** A pineapple in a red fur-trimmed Santa coat and hat pulled over the leafy crown, thick black belt, white cotton beard, coiled leather whip in one hand. Menacing, not jolly. Advancing toward camera. |
| `boss-santa-pineapple-attack-1..2.png` | 1400 tall | 170 px | 2 | Whip drawn back, then cracked forward toward the camera. |
| `boss-santa-pineapple-die.png` | 1400 tall | 170 px | 1 | Flat on its back in the snow, hat over its face, whip limp. |
| `bg-winter-sky.png` | 2048×1024 | 1 | Pale grey-blue overcast winter sky, soft flat cloud layers, weak white sun. Tiles horizontally, generous top. |
| `bg-winter-horizon.png` | 2048×512 | 1 | Snow-capped mountain range in flat white and cold blue-grey, with a dark treeline at the base. Tiles horizontally. |
| `prop-pine.png` | 1024 tall | 1 | A tall conical pine tree heavily laden with snow, dark green needles under thick white caps. |
| `prop-elf.png` | 1024 tall | 1 | A small cartoon elf in green and red with a pointed hat and curled shoes, standing side-on, waving. Scenery, not an enemy. |
| `prop-yeti.png` | 1024 tall | 1 | A big shaggy white yeti standing side-on, peering out from behind the treeline. Scenery, not an enemy. |
| `tex-snow.png` | 512×512 | 1 | **Seamlessly tileable** packed snow — flat white with pale blue shadow dimples, boot scuffs and small ice patches. |

## Castle

| File | Deliver | On-screen max | Frames | Description |
|---|---|---|---|---|
| `pineapple-knight-walk-1..4.png` | 1024 tall | 104 px | 4 | **Pineapple knight.** A standard-issue pineapple soldier in simple chainmail and an open-faced helm, short sword and kite shield. Smaller and plainer than the Knight Pineapple boss — this is the rank and file. Advancing toward camera. |
| `pineapple-knight-die.png` | 1024 tall | 104 px | 1 | Toppled backward, shield spinning off, pineapple chunks flying. |
| `boss-king-pineapple-walk-1..2.png` | 1600 tall | 200 px | 2 | **King Pineapple — the final boss.** A large regal pineapple in a purple ermine-trimmed cloak and a tall gold crown set into the leafy top, jewelled sceptre in one hand. Cruel, sneering face. Under his other arm he clamps the **female rum bottle** — a slimmer bottle with a bow at the neck, long lashes, struggling and reaching toward the camera. Advancing toward camera. |
| `boss-king-pineapple-attack-1..2.png` | 1600 tall | 200 px | 2 | Sceptre raised, then thrust forward toward camera, energy gathering at its tip. Hostage still clamped under the arm. |
| `boss-king-pineapple-die.png` | 1600 tall | 200 px | 1 | Staggered backward, crown knocked askew, sceptre dropped, hostage breaking free. |
| `bg-castle-sky.png` | 2048×1024 | 1 | Deep night sky, indigo to black, scattered stars, thin ragged clouds and a huge pale moon with a faint sinister face. Tiles horizontally, generous top. |
| `bg-castle-horizon.png` | 2048×512 | 1 | A jagged black evil castle silhouette on a crag — spires, buttresses, a few windows lit sickly green — against the night. Tiles horizontally. |
| `prop-battle-fence.png` | 1024 tall | 1 | A wooden spiked barricade / cheval de frise, weathered dark timber lashed with rope. |
| `tex-castle-ground.png` | 512×512 | 1 | **Seamlessly tileable** cracked dark flagstone with moss in the joints and scattered gravel. |

## Luck

| File | Deliver | Description |
|---|---|---|
| `icon-clover.png` | 512×512 | A bright green four-leaf clover, front-on, with a subtle golden glow. Must read instantly at 32 px. |

---

# Phase 3 — Story panels

Static comic panels, tapped through and skippable. **Three-quarter hero poses** —
this is where the existing key art style belongs.

Delivered at **1080×1350** (portrait 4:5), full-bleed illustration, no text —
captions are drawn in code so they can be restyled and translated.

| File | Description |
|---|---|
| `intro-1.png` | The male rum bottle and the female rum bottle standing on a moonlit beach holding hands, mid-kiss, palm trees behind them, hearts in the air. Warm and sweet. |
| `intro-2.png` | The King Pineapple in the foreground watching them, face twisted in jealous fury, crown glinting, fists clenched. The couple small and out of focus behind him. |
| `intro-3.png` | The King leaning out of the open door of a black helicopter above the beach, the female rum bottle clamped under one arm, one hand reaching back down toward the ground. Sand and palms whipping in the rotor wash. |
| `intro-4.png` | The male rum bottle alone on the beach, looking up after the helicopter, face contorted with rage, both pistols drawn. Storm clouds gathering. |
| `ending-blimp.png` | The King Pineapple escaping in an ornate gold-and-purple blimp rising into a night sky over the castle, leaning over the gondola rail with a mocking grin, hostage still under his arm, looking back down at the camera. |

---

## Delivery

Drop files into **`public/popup/art/tiki/`**, using the exact filenames above.

Numbered frames use a plain suffix: `player-walk-1.png` … `player-walk-4.png`.

Until a file exists the game draws a coloured placeholder shape in its place, so
assets can land in any order and nothing blocks the build. Anything that arrives
mid-build simply appears the next time the page loads.

### Registration matters for animation frames

Within a walk cycle, every frame must be the **same canvas size** with the
character at the **same centre and the same overall height** — only the limbs
should move between frames. A character that drifts or resizes between frames
will visibly bob and jitter in game.

The weapon overlays have the tightest requirement: they must line up with
`player-walk`'s arms exactly, so generate them **on the same canvas, from the
same pose**.
