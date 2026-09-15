// ─── Tater Tales — the opening ───────────────────────────────────────────────
//
// Twenty-three slides, tapped through one at a time. Nothing advances itself:
// reading speed is not a constant — somebody is holding a drink, somebody else
// is showing the screen to a friend — and a slide that leaves while you are
// still reading it cannot be got back. Attract mode is the exception, since
// with nobody there to tap it has to walk itself through.
//
// Every line here is drawn with the 5x7 font in arcade.ts, which has no
// lowercase. Write in caps and stay inside its punctuation, or a guest reads
// IT?S GOOD TO BE THE KING — the game will not error, it will just be wrong.
// The test checks every string in this file against the font.
//
// Slide N's picture is cutscene-NN.png — one full-screen portrait image each,
// with solid black bands top and bottom. The line is drawn in the top band.

import type { ArtName } from "./artManifest";
import type { CharacterId } from "./cast";

export interface Slide {
  id: string;
  /** The picture. */
  art: ArtName;
  /** Who is talking, for the bubble's tail and for the stand-in's staging. */
  speaker?: CharacterId;
  /** What they say. */
  line?: string;
  /** Narration, when nobody is talking. Sits along the bottom, not in a bubble. */
  caption?: string;
}

export const SLIDES: Slide[] = [
  {
    id: "01-closed", art: "cutscene-01",
    caption: "THE LIQUOR STORE. NOT OPEN YET.",
  },
  {
    id: "02-shelf", art: "cutscene-02",
    caption: "AND ON THE SHELF INSIDE, NOBODY IS ASLEEP.",
  },
  {
    id: "03-johnny", art: "cutscene-03", speaker: "johnny",
    line: "THE STORE OPENS SOON! WITH ANY LUCK ONE OF YOU WILL BE TAKEN HOME TODAY!",
  },
  {
    id: "04-elmer", art: "cutscene-04", speaker: "elmer",
    line: "I'M SO SICK OF SITTING ON A SHELF... I CAN'T WAIT FOR SOMEONE TO TAKE ME HOME AND DRINK ME!",
  },
  {
    id: "05-alistaire", art: "cutscene-05", speaker: "alistaire",
    line: "THAT'S RIGHT ELMER! WHAT'S THE POINT OF BEING A DRINK IF NO ONE DRINKS YOU!!",
  },
  {
    id: "06-silhouette", art: "cutscene-06",
    caption: "SOMETHING BIG IS AT THE DOOR.",
  },
  {
    id: "07-places", art: "cutscene-07", speaker: "johnny",
    line: "HURRY, THEY'RE OPENING! BACK TO YOUR PLACES!",
  },
  {
    id: "08-hand", art: "cutscene-08",
    caption: "ELMER SHUTS HIS EYES AND HOPES.",
  },
  {
    id: "09-house", art: "cutscene-09",
    caption: "MR. TATER'S HOME BAR. IT GOES UP THROUGH THE ROOF.",
  },
  {
    id: "10-drainpour", art: "cutscene-10", speaker: "tater",
    line: "HMMM... BONDED BUT ONLY 4 YEAR? BARELY BETTER THAN A DRAIN POUR! I'LL LEAVE YOU DOWN HERE ON THE BOTTOM SHELF",
  },
  {
    id: "11-leaving", art: "cutscene-11",
    caption: "AND HE IS GONE.",
  },
  {
    id: "12-alive", art: "cutscene-12",
    caption: "THE BOTTOM SHELF WAKES UP.",
  },
  {
    id: "13-smitten", art: "cutscene-13",
    caption: "ELMER HAS NEVER SEEN ANYTHING LIKE ALLIE CATED.",
  },
  {
    id: "14-guillermo", art: "cutscene-14", speaker: "guillermo",
    line: "SORRY YOU'RE STUCK HERE. WE MAKE THE BEST OF IT. BUT MR. TATER DOESN'T BUY US TO DRINK US, HE BUYS US TO COLLECT US!",
  },
  {
    id: "15-sad", art: "cutscene-15",
    caption: "A WHOLE LIFE ON A SHELF. NEVER OPENED.",
  },
  {
    id: "16-allie-sad", art: "cutscene-16",
    caption: "AND ALLIE HAS BEEN HERE LONGER THAN ANY OF THEM.",
  },
  {
    id: "17-vow", art: "cutscene-17", speaker: "elmer",
    line: "THEN I'LL GET US ALL OUT OF HERE. EVERY LAST BOTTLE.",
  },
  {
    id: "18-footsteps", art: "cutscene-18", speaker: "guillermo",
    line: "TATER IS COMING BACK! QUICK!",
  },
  {
    id: "19-taken", art: "cutscene-19", speaker: "tater",
    line: "WHAT ARE YOU DOING DOWN HERE? AN ALLOCATED BOTTLE LIKE YOU BELONGS ON MY TOP SHELF!",
  },
  {
    id: "20-gone", art: "cutscene-20",
    caption: "HE CARRIES HER UP AND OUT OF SIGHT.",
  },
  {
    id: "21-save-her", art: "cutscene-21", speaker: "elmer",
    line: "I HAVE TO SAVE HER!",
  },
  {
    id: "22-mixey", art: "cutscene-22", speaker: "guillermo",
    line: "MIXEY HERE CAN HELP YOU! USE HIS CARBONATION TO BLAST UP SHELF TO SHELF!",
  },
  {
    id: "23-mixers", art: "cutscene-23", speaker: "guillermo",
    line: "ON YOUR WAY GRAB MIXERS AND MATCH THEM TO THE LONELY DUSTY BOTTLES UP THERE, SO THEY CAN FINALLY BE A DRINK AND GET OFF TATER'S SHELVES FOR GOOD!",
  },
];

/**
 * Seconds attract mode holds a slide before moving itself on.
 *
 * Long enough to read the shorter lines, and the long ones are not the point in
 * a demo anybody is watching over somebody else's shoulder.
 */
export const DEMO_SLIDE_HOLD = 3.2;
