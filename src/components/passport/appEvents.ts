/**
 * File 06: how pieces of the app tell the frame that something changed, without reloading the screen.
 * A heart, a star, a list or a bottle request changed: the tabs that show it refresh quietly in the background.
 */
export type Changed = "marks" | "lists" | "inbox" | "votes" | "recs";
export const CHANGED_EVENT = "passport:changed";

export function notifyChanged(what: Changed) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { what } }));
}

/**
 * How many times the member has moved inside the app since it opened. A page's "Back" goes back in history when
 * there is somewhere in the app to go back to, and to its tab otherwise (a page opened straight from a link).
 */
let moves = 0;
export const appMoved = () => { moves += 1; };
export const hasAppHistory = () => moves > 0;

/**
 * File 15, Part B: the app's own trail of places, newest last, each with the tab it sits on. A Back control goes back in
 * the browser's history only when the step before is in the same tab (so it is the level the member came down from);
 * otherwise it opens the place one level up (never browser-back into another tab). Moving back by the browser or the
 * phone's gesture is noticed too: a return to the step before pops it.
 */
export interface Step { url: string; tab: string }
const steps: Step[] = [];
export function recordStep(url: string, tab: string) {
  const top = steps[steps.length - 1];
  if (top && top.url === url) { top.tab = tab; return; }
  if (steps.length > 1 && steps[steps.length - 2].url === url) { steps.pop(); steps[steps.length - 1].tab = tab; return; }
  steps.push({ url, tab });
  if (steps.length > 60) steps.splice(0, steps.length - 60);
}
/** The step before the current one, or null at the first. */
export const previousStep = (): Step | null => (steps.length > 1 ? steps[steps.length - 2] : null);
export const currentStep = (): Step | null => steps[steps.length - 1] ?? null;
/** Each tab's "at its top level" state, set by the tab itself (the Menu knows which of its sections is first). */
const roots: Record<string, boolean> = {};
export const setTabAtRoot = (tab: string, atRoot: boolean) => { roots[tab] = atRoot; };
export const tabAtRoot = (tab: string): boolean | undefined => roots[tab];
/** The frame asks a tab to go back to its top level (the Menu: its first section). */
export const TAB_ROOT_EVENT = "passport:tab-root";

/** Whether the member asked their phone for less motion. */
export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll the window so this element sits just below the fixed top bar. (scrollIntoView can pan a phone's visual
 * viewport and leave the fixed bars out of place, so the window is scrolled directly.)
 */
export function scrollToId(id: string, smooth = false) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el) return;
  // File 12: the Index's jump chips stick under the top bar, so a heading lands below them too.
  const jump = document.querySelector(".pp-jump") as HTMLElement | null;
  const chips = jump && jump.offsetParent ? jump.getBoundingClientRect().height : 0;
  const top = el.getBoundingClientRect().top + window.scrollY - (document.querySelector(".pp-app header")?.getBoundingClientRect().height || 56) - chips - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: (smooth && !reducedMotion() ? "smooth" : "instant") as ScrollBehavior });
}
