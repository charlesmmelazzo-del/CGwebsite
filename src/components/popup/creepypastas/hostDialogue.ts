// ─── Cocktail Creepypastas — everything the Host says ────────────────────────
//
// ALL of his dialogue lives here, as content, so it can be rewritten without
// touching a component. This is first-draft copy from the design handoff —
// editable, not final. "The Host" is a placeholder until he has a name.
//
// Every line has a stable id. Ids are what the rotation remembers, so reword a
// line freely but don't reuse an old id for a different line.
//
// Voice rules (from the handoff): grand and velvet-voiced, then a cheap shot.
// Tease bravery and taste, never appearance, identity or drinking. "Spoopy" is
// a promise as well as an insult — nothing here may get genuinely scary.
// No souls, possession, ghosts, summoning or anything spiritual.

export const HOST_NAME = "The Host";

/** Portrait slots. Any of them may be missing art — the box still works. */
export type Expression =
  | "neutral"
  | "appraising"
  | "smug"
  | "mockConcern"
  | "unamused"
  | "quietWarning";

/**
 * One beat of a passage. `say` is his speech; `direction` is an italic stage
 * direction. Wrap a word in **double asterisks** to emphasise it.
 */
export type Beat = { say: string } | { direction: string };

export interface HostLine {
  id: string;
  expression?: Expression;
  beats: Beat[];
}

const line = (id: string, text: string, expression?: Expression): HostLine => ({
  id,
  expression,
  beats: [{ say: text }],
});

// ─── First visit: the three-panel introduction ───────────────────────────────

export const INTRO_PANELS: HostLine[] = [
  {
    id: "intro.1",
    expression: "appraising",
    beats: [
      { direction: "He lowers his book and studies you for a moment." },
      { say: "Ah. There you are." },
      { say: "Yes. We'll use the lighter material." },
    ],
  },
  {
    id: "intro.2",
    expression: "smug",
    beats: [
      {
        say: "Welcome to Cocktail Creepypastas. Four cocktails. Four tales. Ordinarily, I would warn you that what follows is not for the faint of heart.",
      },
      { say: "Fortunately, I've made accommodations." },
    ],
  },
  {
    id: "intro.3",
    expression: "mockConcern",
    beats: [
      { say: "Tonight's selection never ventures into horror. Not even spooky." },
      { say: "**Spoopy.**" },
      { direction: "He looks faintly offended by the word." },
      {
        say: "I don't want you crying into a perfectly good cocktail. The dilution alone would be unforgivable.",
      },
    ],
  },
];

/** Closes the introduction, and follows every greeting. */
export const MAIN_QUESTION = "Now. What did you order?";
export const MAIN_QUESTION_SHORT = "What did you order?";

// ─── Rotating pools ──────────────────────────────────────────────────────────
// One line is drawn per meaningful event, without repeats until a pool runs
// out (see lineRotation.ts).

export const POOLS = {
  /** A generic welcome — safe for anyone. */
  "welcome.short": [
    line("welcome.short.1", "Come in. I had higher expectations, but you've arrived, so we shall proceed."),
    line("welcome.short.2", "Welcome. Please leave your disbelief at the door. Your confidence can go beside it.", "smug"),
    line("welcome.short.3", "Ah, an audience. That explains the sudden pressure to simplify.", "appraising"),
    line("welcome.short.4", "There you are. I've selected something appropriate to your apparent level of preparedness."),
    line("welcome.short.5", "Make yourself comfortable. I see you've already made yourself optimistic.", "smug"),
    line("welcome.short.6", "Four tales await. Do take your time. Choosing is the last part that happens entirely on your terms.", "quietWarning"),
    line("welcome.short.7", "Welcome to Cocktail Creepypastas. I've done the difficult part. Let's see how you handle selecting a drink."),
    line("welcome.short.8", "Step closer. I prefer to see the confidence before it leaves.", "quietWarning"),
    line("welcome.short.9", "You look ready. Fortunately, looks have never been a requirement.", "smug"),
    line("welcome.short.10", "A little suspense. A few poor decisions. I've every confidence you'll contribute."),
    line("welcome.short.11", "I've prepared an evening of restrained dread. For this audience, restraint seemed prudent.", "appraising"),
    line("welcome.short.12", "Come in. Nothing tonight exceeds spoopy. I know my audience, champ.", "smug"),
  ],
  /** Only for someone who has been here before on this browser. */
  "welcome.returning": [
    line("welcome.returning.1", "Back again. Either you enjoyed yourself or you're determined to prove something. Both are excellent for attendance.", "smug"),
    line("welcome.returning.2", "Ah. A returning reader. We shall put that under progress."),
    line("welcome.returning.3", "You again. Wonderful. I was beginning to miss having my expectations tested.", "unamused"),
    line("welcome.returning.4", "Still spoopy. I haven't raised the difficulty behind your back. You seem quite capable of doing that yourself."),
    line("welcome.returning.5", "Welcome back. Shall we try a different tale, or a different standard of judgment?", "appraising"),
    line("welcome.returning.6", "Another visit. Your curiosity remains in excellent health."),
    line("welcome.returning.7", "There you are. I've kept the material at your level.", "smug"),
    line("welcome.returning.8", "Ah, a familiar face. We can dispense with the optimistic first impression.", "unamused"),
  ],
  /** "I haven't ordered yet." */
  "browse.entry": [
    line("browse.entry.1", "Still deciding? Of course. Four options. A brutal little gauntlet. Pick one that interests you.", "mockConcern"),
    line("browse.entry.2", "An informed decision. How refreshing. Which drink shall we discuss?", "appraising"),
    line("browse.entry.3", "I can explain what is in the glass and what awaits in the tale. The rest will depend on you. An imperfect arrangement, but there it is."),
    line("browse.entry.4", "Take your time. It's rather touching to see someone investigate before getting involved.", "smug"),
  ],
  /** "I've ordered a cocktail." — DRAFT lines, not from the handoff. */
  "order.which": [
    line("order.which.1", "Splendid. And which one did you settle on?"),
    line("order.which.2", "A decision has already been made. Remarkable. Which was it?", "appraising"),
    line("order.which.3", "Name your drink. I'll try to look surprised.", "smug"),
  ],
  /** A cocktail picked from the "ordered" list. */
  "cocktail.selected": [
    line("cocktail.selected.1", "An interesting choice. I'll reserve judgment until I see what you do with it.", "appraising"),
    line("cocktail.selected.2", "Very well. Let's find out whether your confidence travels."),
    line("cocktail.selected.3", "That one? Certainly. I admire a decision made with so little visible hesitation.", "smug"),
    line("cocktail.selected.4", "A promising beginning. Do try not to make it the high point.", "smug"),
  ],
  /** Asides about the tone, for quiet moments. */
  "tone.spoopy": [
    line("tone.spoopy.1", "Spoopy. I've practically put little socks on the monsters.", "smug"),
    line("tone.spoopy.2", "Not horror. Not even spooky. I refuse to have this evening complicated by whimpering.", "unamused"),
    line("tone.spoopy.3", "You're quite safe from anything genuinely dreadful. Your own judgment remains an exception.", "quietWarning"),
  ],
} satisfies Record<string, HostLine[]>;

export type PoolKey = keyof typeof POOLS;

// ─── Plain-language interface copy ───────────────────────────────────────────
// The performance sits on top; these say what's actually going on.

export const COPY = {
  enter: "Click here to enter… if you dare!",
  enterNote: "Four cocktails. Four tales. A Common Good pop-up.",
  skipIntro: "Skip introduction",
  hearIntro: "Hear the introduction",
  next: "Next",
  ordered: "I've ordered a cocktail.",
  notOrdered: "I haven't ordered yet.",
  backToHost: "Back to the host",
  differentCocktail: "Choose a different cocktail",
  readAbout: "Read about this cocktail",
  anotherCocktail: "Tell me about another.",
  orderedThis: "I've ordered this — enter my ticket.",
  inTheGlass: "In the glass",
  inTheTale: "In the tale",
  glassPending: "The drink description is still being finalized. Ask your bartender what's in it.",
  talePending: "This story is still being written.",
  serviceNote:
    "Order your drink at the bar as usual. It comes with a ticket that unlocks its story. This website does not place drink orders.",
  noCocktails: "The cocktails haven't been announced yet. Check back soon.",
};
