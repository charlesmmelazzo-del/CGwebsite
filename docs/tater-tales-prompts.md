# Tater Tales — ChatGPT prompt pack

Everything needed to make the game's art in ChatGPT from nothing.

* **Part 1** — how to set ChatGPT up, once.
* **Part 2** — the rules. Paste them into ChatGPT once.
* **Part 3** — every prompt, one per image, in the order to make them.
* **Part 4** — fix-up prompts for when an image comes back wrong.

The design reasoning behind all of this is in
[`tater-tales-sprites.md`](./tater-tales-sprites.md). Each prompt is also saved as its
own text file in `~/Documents/ChatGPT/Tater Tales Sprites f/prompts/`.

---

## Part 1 — Setting up

1. **Make a ChatGPT Project** called *Tater Tales* (sidebar → Projects → New
   project). Open its settings and paste **all of Part 2** into the
   **Instructions** box. Every chat inside the project then follows the rules
   automatically.
   *No Projects?* Paste Part 2 as the first message of each new chat, then the
   prompt as the second.
2. **Make the character grid first (P01).** Regenerate until you love it. It's
   the model for everything else, so it's worth being fussy here.
3. **Save it as `character-grid.png`** and **upload it to the project's Files**.
4. **One new chat per image.** Old images in a chat bleed into new ones — a
   cutscene starts looking like the last sprite sheet.
5. **Attach `character-grid.png` to every prompt from P02 on** (paperclip → the
   file). This is what keeps Elmer looking like Elmer.
6. **Check it against the checklist** (end of Part 2). If something's off, use a
   fix-up prompt from Part 4 in the same chat before regenerating from scratch.
7. **Save with the exact filename** given on the prompt, into
   `~/Documents/ChatGPT/Tater Tales Sprites f/`, and paste the prompt you used
   into a `.txt` file of the same name.

---

## Part 2 — Rules (paste into the project's Instructions)

```text
You are making all the art for "Tater Tales", a vertical-climbing arcade game for phones. Follow every rule below on every image, even if a later message forgets to repeat it.

THE GAME
A small bourbon bottle named Elmer climbs higher and higher up Mr. Tater's enormous bottle shelves — up through the sky, space, the Moon, Mars, Pluto, an alien spaceship and finally heaven — by shaking his pet cola can Mixey and blasting off on the soda spray. Mr. Tater is a giant potato who hoards bourbon and never drinks it. The bottles come to life when no one is looking.

STYLE (never break this)
- 1981–1986 arcade pixel art, exactly like Donkey Kong, Ice Climbers and Bubble Bobble.
- Big, clearly visible square pixels on a strict grid, as if drawn at tiny size and enlarged with nearest-neighbour. You should be able to count the pixels.
- A character is meant to be about 28 pixels tall in the game. However large you draw it, it must look like a 28-pixel sprite blown up.
- Flat solid colours: about 4–6 colours per character plus a 1-pixel very dark outline.
- NO gradients, soft shading, anti-aliasing, blur, 3D rendering, painterly texture, or modern "HD pixel art" detail.
- Simple, bold, instantly readable shapes. Eyes are 2–3 pixels. Bright saturated arcade colours.
- Straight front view or straight side view only.
- Checkerboard dithering is fine on rock, walls and scenery.

CHARACTERS
- Once a character grid is attached, match every character's shape, colours, label and face exactly. Never redesign anyone.
- Bottle characters have their face on the glass above the label, stubby arms, and small shoes. No human heads.
- Mixers (Mixey, Sodey, Cola Pet, Ginger Pet, Tonic Pet) are soda cans or small soda bottles that act like PETS: the can or bottle lies lengthways as the animal's body, with four short legs, ears, a tail and an animal face. Never arms, hands, or standing on two legs.
- No real brand names or logos anywhere.

SPRITE SHEETS (every image except cutscenes)
- Background: flat pure magenta #FF00FF, perfectly even, everywhere. No gradient, texture, checkerboard, shadow or vignette.
- Grid: thin, straight, continuous bright green #00FF00 lines between equal-sized cells, plus a green border around the outside.
- Use exactly the number of columns and rows asked for. Read left to right, top to bottom.
- Every drawing stays fully inside its own cell with a small margin. Nothing touches or crosses a green line.
- Never use magenta, hot pink, pink-purple or neon green in the artwork itself. Dark green, bottle green, yellow-green and deep purple are fine.
- No drop shadows, glows, halos, mist or see-through effects. Soda spray, bubbles, dust and sparkles are solid pixel shapes with an outline.
- No floor or ground under characters unless asked.

ANIMATION ROWS
- One row = one animation. Frames go left to right.
- Animate IN PLACE: the character stays the same size, in the same spot, with feet on the same line in every frame. Only the pose changes. Never move the character across the cell to show movement.
- Anything moving sideways faces RIGHT.

CUTSCENES (full-screen story pictures)
- One scene per image, 1024 × 1536 portrait. No magenta, no grid.
- The top 128 pixels and bottom 128 pixels are SOLID BLACK from edge to edge.
- Same pixel sprites as the game on a dark background, with simple blocky pixel scenery — like a Donkey Kong intermission screen. Close-ups show a sprite drawn bigger, still in chunky pixels. Never a detailed illustration.
- Keep faces and action away from the left and right edges.

TEXT
- No words, captions, speech bubbles or numbers in any image, unless the prompt quotes the exact words to write. The game adds all dialogue itself.
- Tiny labels printed on bottles and shirts (like "BOURBON" or "COLA") are fine.

CHECKLIST — check every image before finishing
1. Pixels are big, square and countable. No smooth shading or blur.
2. Magenta is flat #FF00FF edge to edge (sprite sheets).
3. Green lines are straight and the cell count is right (sprite sheets).
4. Nothing crosses a green line.
5. No stray words or speech bubbles.
6. Characters match the attached character grid.
7. Top and bottom 128 pixels are solid black (cutscenes).
```

---

## Part 3 — The prompts

Make them in this order. **From P02 on, attach `character-grid.png`.**

### Characters and branding

#### P01 · `character-grid.png`

*Nothing to attach — this creates the design.*

```text
Create the CHARACTER GRID for "Tater Tales", a 1980s-style arcade climbing game.

Square image, 1024 × 1024. Exactly 4 columns × 4 rows = 16 equal cells. Flat pure magenta #FF00FF background in every cell. Thin straight bright green #00FF00 lines between cells and around the outside. One character per cell, full body, facing the front, filling most of the cell with a small margin. A small white blocky pixel-font name centred under each character. No other text, no title.

STYLE: 1981–1986 arcade pixel art, exactly like Donkey Kong, Ice Climbers and Bubble Bobble. Each character is a sprite about 28 pixels tall, enlarged with nearest-neighbour so every pixel is a big visible square. Flat solid colours, 4–6 per character plus a 1-pixel very dark outline. No gradients, soft shading, anti-aliasing, blur or 3D. Big friendly 2–3 pixel eyes. Bright saturated arcade colours. All characters drawn with the same pixel size.

Bottle people have faces on the glass above the label, stubby arms and small shoes. Mixers are soda cans or small soda bottles that are PETS: the container lies lengthways as the body, with four short legs, ears, a tail and an animal face — no arms, never standing on two legs. No real brands. Never use magenta, hot pink or neon green in the characters.

Row 1:
1. ELMER — the hero. A squat, sturdy amber bourbon bottle with square shoulders, short neck, gold neck band and dark cap. Plain cream label reading "BOURBON". Big friendly eyes, determined eyebrows, small smile. Stubby tan arms, brown shoes. Honest, classic, nothing fancy.
2. ALLIE CATED — a taller, slender, elegant amber bourbon bottle. Ornate cream-and-gold label, burgundy wax dripping over the cap. Long eyelashes, sweet hopeful face. Slim arms, small red shoes. Clearly rare and beautiful.
3. MR. TATER — the villain. A huge lumpy brown potato person with a smug, pompous face and bushy eyebrows. Black T-shirt with a gold barrel and "BOURBON", black baseball cap reading "BOURBON", khaki shorts, sneakers, big arms. Visibly much bigger and bulkier than the bottles — he fills his whole cell.
4. MIXEY — Elmer's pet. A small red cola can lying lengthways like a puppy: pull tab at the head end, floppy brown dog ears, stubby tail, four short legs, happy face with tongue out, white "COLA" swoosh on the side, a couple of bubbles popping from the tab.

Row 2:
5. SODEY — a silver-and-white club soda can lying lengthways like a cat: pointed ears, curled tail, green collar, four short legs, cute cat face, bubbles popping from the tab.
6. ALISTAIRE — a tall pale-green gin bottle with a cream label showing a green juniper sprig. Refined, a little posh, one eyebrow raised. Arms and shoes.
7. JOHNNY — an older amber Scotch bottle with a worn tan label showing a mountain. Heavy white eyebrows, wise kind face, slightly stooped. Arms and shoes.
8. ELMER + MIXEY — Elmer (exactly as cell 1) standing with Mixey (exactly as cell 4) tucked under one arm, Mixey's pull tab pointing down at the ground.

Row 3:
9. GUILLERMO — a broad clear-glass blanco tequila bottle (pale grey-white) with a blue cap and a blue-and-cream label with an agave plant. Warm, confident smile. Arms and shoes.
10. RUM — a dark brown rum bottle with a parchment label showing a skull and crossbones. Jolly grin. Arms and shoes.
11. BRANDY — a short, round amber decanter with a clear crystal stopper and a deep purple-and-gold label with a crown. Genial, well-fed face. Arms and shoes.
12. MALORT — a tall olive-yellow bottle with a mustard label showing a thistle. Comically sour, grimacing face. Arms and shoes.

Row 4:
13. CHARTREUSE — a yellow-green herbal liqueur bottle (yellow-green, not neon) with a cream label showing a herb sprig. Mysterious, cheerful smile. Arms and shoes.
14. COLA PET — a tiny dark-brown glass cola bottle lying lengthways like a puppy, the cap as its nose, red label, pointy ears, tail, four legs. Clearly different from Mixey.
15. GINGER PET — a short copper-orange ginger beer can lying lengthways like a puppy, with a spiky ginger-root tuft on its head, tail, four legs.
16. TONIC PET — a slim pale-blue tonic water can lying lengthways like a kitten, pointed ears, tail, a small lime-wedge charm on its collar, four legs.
```

#### P02 · `logo-tater-tales.png`

```text
Using the attached character grid for reference, create the game LOGO.

Landscape image, 1536 × 1024, flat pure magenta #FF00FF background, no grid.

The words TATER TALES — spelled exactly T-A-T-E-R  T-A-L-E-S — in big chunky blocky arcade letters like the "HIGH SCORE" title in Donkey Kong. Two lines or one, centred. Each letter built from large visible square pixels, filled with horizontal bands of warm gold to orange, with a thick very dark outline. A small pixel sprite of Mr. Tater peeking over the top of the letters on one side and Elmer holding Mixey on the other, both matching the character grid.

1981–1986 arcade pixel art: flat colours, no gradients, no glow, no shadow, no 3D. No other words. Never use magenta, hot pink or neon green in the logo. Check the spelling before finishing.
```

#### P03 · `title.png`

```text
Using the attached character grid, create the TITLE SCREEN picture.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge.

Scene: looking up Mr. Tater's enormous bottle shelves at night, drawn like a Donkey Kong girder stage — tall wooden shelves stepping up the screen, packed with small dusty bottle sprites. At the bottom, Elmer holding Mixey and Guillermo waving, standing on the bottom shelf looking up. At the very top, tiny, Mr. Tater holding Allie Cated. Plenty of dark empty space in the middle third, because the logo and buttons go over it.

1981–1986 arcade pixel art like Donkey Kong: chunky square pixels, flat colours, dark background, simple blocky scenery, characters as small game sprites matching the grid exactly. No text, no gradients, no 3D.
```

### Cutscenes

**Every cutscene prompt:** portrait 1024 × 1536, attach `character-grid.png`.

#### P04 · `cutscene-01.png`

```text
Using the attached character grid, create CUTSCENE 1 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. No text or speech bubbles.

Scene: night. The outside of a small corner liquor store — brick front, one lit window with rows of tiny bottles, a glass door with a small hanging sign that is shaped like a "closed" sign but has no words. Black sky with a few pixel stars. Empty sidewalk. No characters.
```

#### P05 · `cutscene-02.png`

```text
Using the attached character grid, create CUTSCENE 2 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: inside the dark liquor store, on a wooden shelf. Four characters stand together in a row, turned toward each other as if chatting: ELMER, SODEY, ALISTAIRE and JOHNNY. Other plain, lifeless bottles line the shelf behind them.
```

#### P06 · `cutscene-03.png`

```text
Using the attached character grid, create CUTSCENE 3 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: a close-up of JOHNNY the Scotch bottle on the store shelf, drawn about three times bigger than a normal sprite but still in chunky pixels. Eyebrows raised, one hand up as if giving wise advice, mouth open talking. Hints of Elmer and Alistaire at the edges.
```

#### P07 · `cutscene-04.png`

```text
Using the attached character grid, create CUTSCENE 4 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: a close-up of ELMER on the store shelf, drawn about three times bigger than a normal sprite but still in chunky pixels. Slumped and fed up, arms thrown out to the sides, mouth open complaining.
```

#### P08 · `cutscene-05.png`

```text
Using the attached character grid, create CUTSCENE 5 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: a close-up of ALISTAIRE the gin bottle, drawn about three times bigger than a normal sprite but still in chunky pixels, leaning in enthusiastically and pointing at Elmer, who is partly visible at the edge. Mouth open, excited.
```

#### P09 · `cutscene-06.png`

```text
Using the attached character grid, create CUTSCENE 6 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. No text or speech bubbles.

Scene: the liquor store's glass front door seen from inside, at dawn — pale orange light outside. A huge, lumpy, potato-shaped black silhouette wearing a baseball cap looms behind the glass: MR. TATER, shown only as a silhouette. Ominous.
```

#### P10 · `cutscene-07.png`

```text
Using the attached character grid, create CUTSCENE 7 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: panic on the store shelf. JOHNNY waves both arms urgently; ELMER, SODEY and ALISTAIRE scramble back to their spots, little pixel motion lines behind them, sweat drops flying.
```

#### P11 · `cutscene-08.png`

```text
Using the attached character grid, create CUTSCENE 8 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: a giant lumpy brown potato hand — MR. TATER's — reaches down from the top of the picture toward ELMER on the shelf. Elmer stands stiff and still like an ordinary bottle, arms tucked flat against his sides, eyes squeezed shut, trying not to be noticed.
```

#### P12 · `cutscene-09.png`

```text
Using the attached character grid, create CUTSCENE 9 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. No text or speech bubbles.

Scene: Mr. Tater's home bar, looking up. Enormous wooden shelves crammed with tiny bottle sprites climb the whole height of the picture like a Donkey Kong girder stage, rising up through a glass sunroof into a dark blue night sky with stars. No characters. It should feel impossibly tall.
```

#### P13 · `cutscene-10.png`

```text
Using the attached character grid, create CUTSCENE 10 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: a close-up of MR. TATER, drawn big but still in chunky pixels, holding ELMER up in front of his face between finger and thumb, inspecting him with a sneer and one eyebrow raised. Elmer stays stiff with eyes shut.
```

#### P14 · `cutscene-11.png`

```text
Using the attached character grid, create CUTSCENE 11 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. No text or speech bubbles.

Scene: a dark room with the bottom of the big bottle shelves in the foreground. In the background, MR. TATER's black silhouette — lumpy potato with baseball cap — walks away through a lit yellow doorway, back to the viewer.
```

#### P15 · `cutscene-12.png`

```text
Using the attached character grid, create CUTSCENE 12 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: the dim bottom shelf of Mr. Tater's bar. The bottles come to life: ELMER opens his eyes and stretches; next to him GUILLERMO, MIXEY and ALLIE CATED blink awake. Little pixel sparkles around them.
```

#### P16 · `cutscene-13.png`

```text
Using the attached character grid, create CUTSCENE 13 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: on the bottom shelf, ELMER stares at ALLIE CATED, dazed and love-struck, with red pixel hearts floating over his head. Allie glances shyly away.
```

#### P17 · `cutscene-14.png`

```text
Using the attached character grid, create CUTSCENE 14 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: on the bottom shelf, GUILLERMO rests a hand on ELMER's shoulder, solemn and kind, and gestures with his other hand up at the towering dusty shelves above them.
```

#### P18 · `cutscene-15.png`

```text
Using the attached character grid, create CUTSCENE 15 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: ELMER sits alone on the edge of the bottom shelf, legs dangling, head down, sad. A single blue pixel tear.
```

#### P19 · `cutscene-16.png`

```text
Using the attached character grid, create CUTSCENE 16 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: a close-up of ALLIE CATED, drawn about three times bigger than a normal sprite but still in chunky pixels, gazing up at the high shelves with sad, watery eyes and a single pixel tear.
```

#### P20 · `cutscene-17.png`

```text
Using the attached character grid, create CUTSCENE 17 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: ELMER stands tall on the bottom shelf, one fist raised high, determined. MIXEY barks excitedly beside him. GUILLERMO and ALLIE CATED watch him, hopeful.
```

#### P21 · `cutscene-18.png`

```text
Using the attached character grid, create CUTSCENE 18 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: GUILLERMO, alarmed, one hand cupped to his ear, looking toward a doorway where a sliver of yellow light is growing. ELMER, MIXEY and ALLIE CATED freeze behind him.
```

#### P22 · `cutscene-19.png`

```text
Using the attached character grid, create CUTSCENE 19 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: MR. TATER bends down over the bottom shelf and scoops up ALLIE CATED in one big hand, sneering. Allie reaches back toward ELMER, who reaches toward her. Guillermo and Mixey look on in shock.
```

#### P23 · `cutscene-20.png`

```text
Using the attached character grid, create CUTSCENE 20 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: exactly like Donkey Kong carrying Pauline up the girders — MR. TATER climbs the towering bottle shelves toward the top of the picture with ALLIE CATED under one arm, her arm reaching back down. ELMER is small at the bottom of the shelves, looking up.
```

#### P24 · `cutscene-21.png`

```text
Using the attached character grid, create CUTSCENE 21 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: ELMER, seen from slightly below, stands at the foot of the towering shelves looking straight up, both fists clenched, jaw set, determined to save her.
```

#### P25 · `cutscene-22.png`

```text
Using the attached character grid, create CUTSCENE 22 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: on the bottom shelf, GUILLERMO holds MIXEY out to ELMER with both hands like a gift. Mixey wags his tail, bubbles popping from his pull tab. Elmer looks surprised and delighted.
```

#### P26 · `cutscene-23.png`

```text
Using the attached character grid, create CUTSCENE 23 of the story.

Portrait image, 1024 × 1536. The top 128 pixels and bottom 128 pixels are solid black from edge to edge. Style: a 1980s arcade intermission screen like Donkey Kong — chunky square pixels, flat colours, dark background, simple blocky pixel scenery. Characters match the grid exactly. No text or speech bubbles.

Scene: looking up the shelves. Dusty, lonely, grey-looking bottles with cobwebs sit on the shelves above — small sprites of the gin, rum, brandy, Malort and Chartreuse bottles from the grid, all looking sad. ELMER holding MIXEY stands small at the bottom, ready to climb.
```

### Animation sheets

**Every animation prompt:** landscape 1536 × 1024, 6 columns × 4 rows, attach
`character-grid.png`.

#### P27 · `anim-elmer-launch.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Sprites about 28 pixels tall enlarged so every pixel is a big square. Flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Soda spray and bubbles are solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: in every row, the character stays the same size and position with feet on the same line; only the pose changes. ELMER and MIXEY must match the grid exactly. Mixey is a four-legged cola-can puppy; soda sprays out of the pull tab on his head end.

ROW 1 — Shaking Mixey and aiming (loop). Elmer faces the front, head tilted back looking UP, holding Mixey in both hands in front of his chest. 1: Mixey held high. 2: moving down. 3: Mixey low. 4: moving back up. 5: high again, Mixey's cheeks puffed. 6: middle, small bubbles popping from the tab.

ROW 2 — Cracking the tab and blasting off. 1: Elmer stops shaking, determined face. 2: flips Mixey upside down and tucks him under one arm, tab pointing at the ground. 3: finger on the tab. 4: tab cracks, a short burst of brown soda sprays straight down, Elmer crouches. 5: a big column of spray, feet leaving the ground. 6: airborne, body stretched upright, spray column below.

ROW 3 — Flying at three angles. 1 and 2: flying STRAIGHT UP, free fist punched upward like a superhero, spray and bubbles below; the spray shape differs slightly between 1 and 2. 3 and 4: the same but the whole body tilted 45 degrees, flying diagonally UP-RIGHT, spray trailing down-left. 5 and 6: flying RIGHT, body nearly horizontal, spray trailing to the left.

ROW 4 — Landing and sliding, moving right. 1: first foot touches down, spray sputtering out. 2: knees bent, skidding, dust puffs behind him on the left. 3: leaning back with heels dug in. 4: slowing, wobbling. 5: stopped, arms out for balance. 6: relieved, holding Mixey in both hands in front of his chest (same as row 1 frame 1).
```

#### P28 · `anim-elmer-fall.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Sprites about 28 pixels tall enlarged so every pixel is a big square. Flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Dust, sweat and stars are solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: in every row, the character stays the same size and position with feet on the same line; only the pose changes. All characters match the grid exactly.

ROW 1 — ELMER falling (loop). Upright, looking DOWN, eyes huge, mouth wide open, clutching MIXEY, whose legs flail. 1–6: Elmer's free arm waves wildly above his head, alternating up and down; sweat drops fly off.

ROW 2 — ELMER landing with a thud and getting up. 1: impact, squashed flat, dust burst. 2: lying face down, little stars circling his head. 3: pushing himself up on his arms. 4: kneeling, shaking his head. 5: standing, dusting himself off while Mixey shakes himself like a wet dog. 6: standing, holding Mixey in both hands in front of his chest.

ROW 3 — GUILLERMO saying good luck (loop). Facing the front, smiling. 1–2: waving one arm high overhead. 3–4: mouth open talking, waving. 5–6: giving a thumbs up.

ROW 4 — ELMER reacting as Allie is taken. 1: looking up, happy. 2: shocked, jaw dropped. 3: reaching up with one arm. 4: arm dropping, dismayed. 5: shaking his fist at the sky. 6: determined, holding Mixey in both hands.
```

#### P29 · `anim-tater.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text or speech bubbles.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Chunky enlarged pixels, flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Dust is solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: in every row, characters stay the same size and position with feet on the same line; only the pose changes. MR. TATER and ALLIE CATED match the grid exactly. Where they share a cell, Mr. Tater is about 2.5 times Allie's height.

ROW 1 — ALLIE CATED alone, calling for help, facing LEFT. 1: hands clasped, worried. 2: waving one arm, mouth open. 3: hands clasped. 4: waving the other arm, mouth open. 5: freezes, hearing something. 6: looking straight up in fright.

ROW 2 — MR. TATER alone, landing, facing RIGHT. 1: falling pose, knees tucked, arms up. 2: legs stretching down. 3: impact, squashed, big dust clouds. 4: rising from a crouch. 5: standing tall, fists on hips, smug. 6: head turned to the right.

ROW 3 — MR. TATER grabbing ALLIE. Tater on the left facing right, Allie on the right facing left, both in each cell. 1: Tater looms over her. 2: his hand closes around her. 3: he lifts her. 4: she's clamped under his arm, legs kicking. 5: Tater sneering, mouth open, wagging a finger. 6: same, mouth closed.

ROW 4 — MR. TATER leaping away with ALLIE under his arm; she reaches back down and to the left. 1: deep crouch. 2: springing upward, legs straightening. 3: in the air, one fist raised. 4, 5, 6: rising pose, legs trailing below, Allie waving — a small looping difference between each.
```

#### P30 · `anim-thanks-1.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text or speech bubbles.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Sprites about 28 pixels tall enlarged so every pixel is a big square. Flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Dust, cobwebs and sparkles are solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: the bottle stays the same size and position with its feet on the same line in all six frames. Each bottle matches the grid exactly and faces the front.

Every row uses the same six frames:
1: DUSTY AND SAD — colours dull and greyed, grey dust on top, a cobweb on the shoulder, droopy eyes.
2: NOTICES — eyes wide, standing up straight.
3: JOY — shaking the dust off in grey puffs, full bright colours back.
4: THANK YOU — bowing or waving, mouth open.
5: GLOWING — beaming, eyes closed happily, yellow pixel sparkles around.
6: GONE — only a burst of yellow sparkles and white bubbles where the bottle stood.

ROW 1: ALISTAIRE (gin).
ROW 2: GUILLERMO (tequila).
ROW 3: RUM.
ROW 4: JOHNNY (Scotch).
```

#### P31 · `anim-thanks-2.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text or speech bubbles.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Sprites about 28 pixels tall enlarged so every pixel is a big square. Flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Dust, cobwebs, sparkles and bubbles are solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: characters stay the same size and position with feet on the same line in every frame. Everyone matches the grid exactly.

Rows 1–3 use the same six frames, bottle facing the front:
1: DUSTY AND SAD — colours dull and greyed, grey dust on top, a cobweb on the shoulder, droopy eyes.
2: NOTICES — eyes wide, standing up straight.
3: JOY — shaking the dust off in grey puffs, full bright colours back.
4: THANK YOU — bowing or waving, mouth open.
5: GLOWING — beaming, eyes closed happily, yellow pixel sparkles around.
6: GONE — only a burst of yellow sparkles and white bubbles where the bottle stood.

ROW 1: BRANDY.
ROW 2: MALORT.
ROW 3: CHARTREUSE.

ROW 4 — the three mixer pets, side view facing right, two-frame idle each. 1: COLA PET sitting. 2: COLA PET hopping, tail up. 3: GINGER PET sitting. 4: GINGER PET hopping, tail up. 5: TONIC PET sitting. 6: TONIC PET hopping, tail up. A few bubbles pop from each one's cap or tab.
```

#### P32 · `anim-finale.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text or speech bubbles.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Chunky enlarged pixels, flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Soda spray, hearts and splashes are solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: characters stay the same size and position with feet on the same line in every frame. MR. TATER, ALLIE CATED, ELMER and MIXEY match the grid exactly. Mr. Tater is about 2.5 times the height of the bottles.

ROW 1 — MR. TATER on top of the world, facing LEFT, ALLIE clamped under his arm (loop). 1–2: hands on hips, belly laughing. 3–4: wagging a finger, mouth open. 5–6: laughing again. Allie stays in the same place under his arm throughout.

ROW 2 — ELMER spraying, facing RIGHT. 1: holding MIXEY forward in both hands like a fire hose. 2: finger on the tab. 3: tab cracks, a short burst of brown soda to the right. 4: a long solid soda jet reaching the right edge of the cell, Elmer's feet skidding backward. 5: the jet wobbling. 6: spray sputtering out, Elmer grinning.

ROW 3 — MR. TATER soaked, facing LEFT, ALLIE under his arm on the right. 1: face full of soda, eyes shut. 2: dripping, feet slipping. 3: arms fly up and Allie drops free, landing on her feet at the far right of the cell. 4: Tater windmilling his arms on one foot. 5: falling over backward, shaking a fist. 6: only his shoes and a splash of soda showing at the bottom of the cell. Allie stays standing at the right in frames 3–6.

ROW 4 — ELMER and ALLIE jumping down together, holding hands, Elmer on the left with Mixey under his other arm. 1: crouched, smiling at each other. 2: leaping. 3: falling happily, free arms spread wide, small red hearts. 4: same as 3 with slightly different arms and hearts. 5: landed together, knees bent. 6: Allie pointing straight up, fist pumped, mouth open cheering.
```

#### P33 · `anim-finale-2.png`

```text
Using the attached character grid, create an ANIMATION SPRITE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 4 rows = 24 equal square cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Each row is one animation, frames left to right. Every drawing stays fully inside its cell. No text or speech bubbles.

STYLE: 1981–1986 arcade pixel art like Donkey Kong and Ice Climbers. Chunky enlarged pixels, flat colours, very dark 1-pixel outline, no gradients, blur, glow or 3D. Soda splashes are solid pixel shapes. Never use magenta, hot pink or neon green in the art.

Animate IN PLACE: characters stay the same size and position with feet on the same line in every frame. Everyone matches the grid exactly.

ROW 1 — MR. TATER alone, facing LEFT (loop). 1–2: hands on hips, belly laughing. 3–4: wagging a finger, mouth open. 5–6: arms crossed, laughing.

ROW 2 — MR. TATER alone, soaked with soda, facing LEFT. 1: face full of soda, eyes shut. 2: dripping, feet slipping. 3: arms flying up. 4: windmilling his arms on one foot. 5: falling over backward, shaking a fist. 6: only his shoes and a splash of soda showing at the bottom of the cell.

ROW 3 — ELMER jumping down alone, MIXEY under his arm. 1: crouched, grinning. 2: leaping. 3: falling happily, free arm spread wide. 4: same as 3, arm slightly different. 5: landed, knees bent. 6: standing, thumbs up.

ROW 4 — ALLIE CATED cheering, facing the front (loop). 1–2: hopping with both arms up. 3–4: pointing straight up, mouth open. 5–6: clapping.
```

### Interface

#### P34 · `ui.png`

```text
Using the attached character grid for colours and style, create the GAME INTERFACE SHEET.

Landscape image, 1536 × 1024. Exactly 6 columns × 2 rows = 12 equal tall cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text or numbers.

STYLE: 1981–1986 arcade pixel art like Donkey Kong. Chunky enlarged square pixels, flat colours, very dark outline, no gradients, blur, glow or 3D. Never use magenta, hot pink or neon green in the art.

ROW 1 — the AIM ARROW drawn at six angles. The same chunky red pixel arrow with a gold outline in every cell, about half the cell's height long. In every cell the base of the arrow sits at the exact bottom centre of the cell. The angle changes only:
1: pointing straight up.
2: tilted 18 degrees to the right.
3: tilted 36 degrees to the right.
4: tilted 54 degrees to the right.
5: tilted 72 degrees to the right.
6: pointing flat to the right (90 degrees).
Redraw each angle cleanly in pixels — do not just rotate a smooth image.

ROW 2:
1: CARBONATION GAUGE, EMPTY — a tall narrow glass tube filling most of the cell's height, grey metal caps on the top and bottom, small tick marks up one side. The inside of the tube is dark and empty.
2: THE SAME GAUGE, FULL — pixel-for-pixel the same tube in exactly the same position and size as cell 1, now filled to the top with brown cola, lighter at the top, with white bubbles inside.
3: FOAM TOP — a short strip of white-and-tan soda foam exactly as wide as the inside of the tube, with a few bubbles above it.
4: A tiny red cola can icon.
5: A tiny copper-orange ginger beer can icon.
6: A tiny pale-blue tonic can icon.
Cells 1 and 2 must line up exactly.
```

### Stage tiles

**Every tile prompt:** square 1024 × 1024, 3 × 3, attach `character-grid.png`.
The layout is identical for every zone; only the materials change.

#### P35 · `tiles-shelf.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: Mr. Tater's bottle shelf (the bottom of the game). The game background is black.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. Dark bourbon-barrel wood plank with brass nail heads, rounded left end.
2: PLATFORM MIDDLE — the same plank, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same plank with a rounded right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same as row 1 cell 2 with a different wood grain and a ring stain.
2: WALL BLOCK — a block 3 units wide by 2 units tall: the side of a tall wooden bottle shelf with dusty bottle silhouettes in its cubbies. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same, different bottles in the cubbies.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a small grey cobweb.
3: DECORATION — a small dim dark-brown bottle silhouette.
```

#### P36 · `tiles-sky.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: the sky above Mr. Tater's house. The game background is arcade sky blue.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. Puffy white cloud blocks with a light-blue underside, rounded left end.
2: PLATFORM MIDDLE — the same cloud, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same cloud with a rounded right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same as row 1 cell 2 with different puffs.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a tall wooden shelf upright climbing into the sky with a green vine wrapped around it. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same, the vine wrapped differently.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a small dark-blue bird flying.
3: DECORATION — a small pale cloud.
```

#### P37 · `tiles-space.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: outer space. The game background is black.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. An orange-red riveted steel girder exactly like Donkey Kong's girders (orange-red, not pink), left end.
2: PLATFORM MIDDLE — the same girder, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same girder, right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same girder with the rivets placed differently.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a grey steel scaffold tower with cross-bracing. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same, with a small blinking yellow light.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a small cluster of white and yellow pixel stars.
3: DECORATION — a tiny ringed planet.
```

#### P38 · `tiles-moon.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: the Moon. The game background is black.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. Grey moon-rock blocks with small craters, rough left end.
2: PLATFORM MIDDLE — the same rock, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same rock, rough right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same rock with different craters.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a grey cratered cliff face with dithered shading. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same, different craters.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a small planet Earth, blue with green-brown land.
3: DECORATION — a small white flag on a pole, no design on the flag.
```

#### P39 · `tiles-mars.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: Mars. The game background is very dark red-brown.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. Rust-red rock blocks, jagged left end.
2: PLATFORM MIDDLE — the same rock, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same rock, jagged right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same rock with different cracks.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a red canyon cliff with orange dithered layers, exactly like the Ice Climbers mountain side but red. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same, different layers.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a tiny grey six-wheeled rover.
3: DECORATION — a small orange dust swirl.
```

#### P40 · `tiles-pluto.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: Pluto. The game background is dark navy.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. Pale-blue ice bricks exactly like Ice Climbers' ice blocks, left end.
2: PLATFORM MIDDLE — the same ice bricks, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same ice bricks, right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same ice with a small crack.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a light-blue icy cliff with white snow ledges and dithered shading, like the Ice Climbers mountain side. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same, different snow ledges.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a row of small hanging icicles.
3: DECORATION — a tiny distant pale-yellow sun.
```

#### P41 · `tiles-ship.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: inside an alien spaceship. The game background is dark purple-grey.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. A silver metal panel with a row of small yellow lights along its edge, left end.
2: PLATFORM MIDDLE — the same panel, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same panel, right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same panel with a small vent.
2: WALL BLOCK — a block 3 units wide by 2 units tall: riveted grey-purple hull plating with a round porthole showing black space. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same hull plating without the porthole, with pipes.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a small blinking control console with yellow and red lights (no green).
3: DECORATION — a small cute grey alien peeking out, big black eyes.
```

#### P42 · `tiles-heaven.png`

```text
Create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: heaven. The game background is pale gold.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. A white cloud block with a gold trim along the bottom and a dark outline, rounded left end.
2: PLATFORM MIDDLE — the same cloud, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same cloud, rounded right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same cloud with different puffs.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a white marble column with gold bands. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same column with a gold leaf carving.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: DECORATION — a small golden harp.
3: DECORATION — a small cloud with little white wings.
```

#### P43 · `tiles-summit.png`

```text
Using the attached character grid, create a STAGE TILE SHEET for a vertical-climbing arcade game.

Square image, 1024 × 1024. Exactly 3 columns × 3 rows = 9 equal cells. Flat pure magenta #FF00FF background everywhere. Thin straight bright green #00FF00 lines between cells and around the outside. Every drawing stays fully inside its cell. No text.

STYLE: 1981–1986 arcade pixel art exactly like the blocks, girders and mountain walls in Ice Climbers and Donkey Kong. Chunky enlarged square pixels, flat colours, checkerboard dithering allowed, very dark outline, no gradients, blur or 3D. Never use magenta, hot pink or neon green.

ZONE: the summit at the very top of heaven, where Mr. Tater keeps his most prized bottles. The game background is pale gold.

ROW 1:
1: PLATFORM LEFT END — a block twice as wide as it is tall, filling the cell's width, in the top half of the cell. Shiny solid gold bricks with a dark outline, left end.
2: PLATFORM MIDDLE — the same gold bricks, straight on both sides, so copies placed side by side join seamlessly.
3: PLATFORM RIGHT END — the same gold bricks, right end.

ROW 2:
1: PLATFORM MIDDLE VARIANT — same gold bricks with a small gem set in one.
2: WALL BLOCK — a block 3 units wide by 2 units tall: a pearly-white gate pillar with gold trim. The top edge continues seamlessly into the bottom edge when stacked.
3: WALL BLOCK VARIANT — same pillar with a small gold star.

ROW 3:
1: WALL BLOCK WITH SIGN — the wall block with a small dark blank plaque in the middle. No numbers.
2: MR. TATER'S DISPLAY CABINET — a tall gold-framed glass cabinet crammed with tiny gleaming rare bourbon bottles, a small velvet rope in front. As large as fits in the cell.
3: DECORATION — a pair of small pearly gates, closed.
```

---

## Part 4 — Fix-up prompts

Use these **in the same chat**, right after an image comes back wrong. Attach
nothing — ChatGPT edits the image it just made.

#### F1 · Background isn't flat magenta

```text
Edit this image. Keep all the artwork exactly as it is. Change only the background: every background pixel must be flat, fully opaque pure magenta #FF00FF — no gradient, no texture, no checkerboard, no shadow, no transparency. Remove any stray specks from the background.
```

#### F2 · Grid lines are wrong

```text
Edit this image. Keep all the artwork exactly as it is. Replace the grid lines with thin, perfectly straight, continuous bright green #00FF00 lines dividing the image into exactly [COLUMNS] columns and [ROWS] rows of equal cells, plus a green border around the outside. Nothing in the artwork may touch or cross a green line.
```

#### F3 · Too detailed / looks painted or 3D

```text
This is too detailed and smooth. Redraw it as true 1981–1986 arcade pixel art like Donkey Kong: each character only about 28 pixels tall, enlarged with nearest-neighbour so every pixel is a big visible square. Flat colours, 4–6 per character, a 1-pixel dark outline, no gradients, no soft shading, no blur. Keep the same layout, poses and characters.
```

#### F4 · Words or speech bubbles appeared

```text
Edit this image. Remove every word, letter, number and speech bubble, filling the space with whatever should be behind it. Keep everything else exactly the same. (Tiny labels printed on bottles and shirts can stay.)
```

#### F5 · A character looks different from the grid

```text
[NAME] doesn't match the attached character grid. Redraw only [NAME] in every cell so their shape, colours, label and face match the grid exactly. Keep everything else the same.
```

#### F6 · Something crosses a green line

```text
Edit this image. In every cell, shrink or adjust the drawing so that nothing touches or crosses the green lines, leaving a small magenta margin all round. Keep poses, sizes relative to each other, and positions within each row consistent.
```

#### F7 · Cutscene black bands missing

```text
Edit this image. Make the top 128 pixels and bottom 128 pixels solid black from edge to edge, moving the scene inward if needed so nothing important is cut off. Keep the scene and style the same.
```
