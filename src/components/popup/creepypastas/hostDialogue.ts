// ─── Cocktail Creepypastas — everything the bartender says ───────────────────
//
// His lines come from dialogue.json, which scripts/creepypastas-import.mjs
// writes from ChatGPT's corpus. Each moment has a few alternatives; one is
// drawn per occasion (see lineRotation.ts).
//
// FALLBACK covers moments the corpus doesn't have yet. When ChatGPT's next
// pass supplies a moment with the same key, its lines win automatically.

import DIALOGUE from "./dialogue.json";
import { drawFrom } from "./lineRotation";

export interface HostLine {
  id: string;
  /** One speech bubble each, shown in order. */
  lines: string[];
  /** The guest's replies the corpus suggests. The UI may use its own. */
  choices?: string[];
}

export type Moment =
  | "fresh_welcome"
  | "intent_prompt"
  | "time_prompt"
  | "scare_prompt"
  | "returning_guest_welcome"
  | "recipe_shared_return_callback"
  | "both_story_and_recipe_connective"
  | "resume_unfinished_story"
  | "decline_and_offer_another"
  | "new_search_transition"
  | "no_matching_story"
  | "all_matching_stories_heard"
  | "story_completion_outro"
  | "all_the_time_response"
  | "under_five_minutes_leadin"
  | "unknown_history_greeting"
  | "same_visit_return_to_main"
  | "farewell"
  | "recipe_menu_intro"
  | "recipe_ready"
  | "recipe_download_started"
  | "all_matching_stories_offered"
  // Not in the corpus yet — FALLBACK until ChatGPT's pass adds them.
  | "email_signup_ask"
  | "email_signup_ask_email"
  | "email_signup_thanks"
  | "email_signup_declined"
  | "story_left_early"
  | "story_changed_mind"
  | "recipe_writing"
  | "story_thinking"
  | "recipe_another"
  | "recipe_no_pdf"
  | "version_choice_prompt"
  | "modern_bridge";

const one = (id: string, text: string): HostLine => ({ id, lines: [text] });

/** Stand-in lines, written to match the corpus voice. Replace freely. */
const FALLBACK: Partial<Record<Moment, HostLine[]>> = {
  email_signup_ask: [
    one("fb_signup_ask_01", "Before you wander off: shall I send word when Common Good opens its next pop-up? I keep a ledger for friends of the bar."),
    one("fb_signup_ask_02", "I do enjoy a returning face. Would you like to hear about our next pop-ups and the odd bit of Common Good news?"),
  ],
  email_signup_ask_email: [
    one("fb_signup_email_01", "Splendid. Write your email in my ledger and I'll see the word reaches you."),
  ],
  email_signup_thanks: [
    one("fb_signup_thanks_01", "There. You're in the ledger now. Rather better company than most of its pages."),
    one("fb_signup_thanks_02", "Noted, in my very best handwriting. You'll hear from us."),
  ],
  email_signup_declined: [
    one("fb_signup_declined_01", "No matter at all. The bar will be here either way. It always is."),
    one("fb_signup_declined_02", "Of course. Some guests prefer to simply turn up. I admire that."),
  ],
  story_left_early: [
    one("fb_left_early_01", "I've marked your place. The tale will keep; they always do."),
    one("fb_left_early_02", "Stepping away mid-story? Wise, sometimes. Your page is saved for when you're ready."),
  ],
  story_changed_mind: [
    one("fb_changed_mind_01", "Perfectly all right. Some stories are better saved for another night."),
  ],
  recipe_writing: [
    one("fb_recipe_writing_01", "Let me write that down for you. My handwriting has survived worse than a busy bar."),
    one("fb_recipe_writing_02", "One moment. A good recipe deserves to be written out properly."),
  ],
  recipe_another: [
    one("fb_recipe_another_01", "Shall I scribble down another? I've ink to spare and no pulse to slow me down."),
    one("fb_recipe_another_02", "Another recipe for the road? My quill hasn't had this much exercise since the Victorian era."),
  ],
  recipe_no_pdf: [
    one("fb_recipe_no_pdf_01", "Blast. The printed card for that one isn't back from the printer yet. Ask at the bar and they'll walk you through it."),
  ],
  version_choice_prompt: [
    one("fb_version_01", "This one I can give you in the author's own words, or retold in modern English. Same tale, same twists, every bone in place. Which would you like?"),
    one("fb_version_02", "The original telling is a touch old-fashioned; I can also tell it in today's English, with nothing left out. Your choice."),
  ],
  modern_bridge: [
    one("fb_modern_bridge_01", "Retold in today's English, not word for word, but every turn of the tale is here. Let's begin."),
  ],
  story_thinking: [
    one("fb_thinking_01", "Now then. Which tale… let me think."),
    one("fb_thinking_02", "Hmm. I know just the one. Or I will, in a moment."),
  ],
};

const CORPUS = DIALOGUE as unknown as Partial<Record<Moment, HostLine[]>>;

export function linesFor(moment: Moment): HostLine[] {
  const fromCorpus = CORPUS[moment];
  return fromCorpus?.length ? fromCorpus : FALLBACK[moment] ?? [];
}

/** Draw one alternative for a moment — call when it happens, not on render. */
export function say(menuId: string, moment: Moment): HostLine {
  return drawFrom(menuId, moment, linesFor(moment));
}

// ─── The guest's side ────────────────────────────────────────────────────────
// Plain wording, so a tap target always says exactly what it does.

export const REPLIES = {
  enter: "Tap to enter",
  next: "Next",
  recipe: "A cocktail recipe",
  tale: "A spooky tale",
  accept: "Yes, I'd love to hear it",
  another: "Tell me a different tale",
  changeChoices: "Change time or scare level",
  changedMind: "I changed my mind",
  resume: "Pick up where I left off",
  somethingElse: "Choose something else",
  revisit: "Hear a favourite again",
  revisitOffered: "Show me those again",
  recipesInstead: "A recipe instead",
  backToBar: "Back to the bar",
  signupYes: "Yes, keep me posted",
  signupNo: "No thanks",
  done: "That's all for now",
  download: "Download the recipe",
  showCocktails: "Show me the cocktails",
  original: "The original words",
  modern: "Modern English",
  anotherRecipe: "Another recipe",
  noMoreRecipes: "No, that's all",
};
