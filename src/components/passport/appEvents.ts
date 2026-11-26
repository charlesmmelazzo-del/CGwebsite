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

/** Whether the member asked their phone for less motion. */
export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll the window so this element sits just below the fixed top bar. (scrollIntoView can pan a phone's visual
 * viewport and leave the fixed bars out of place, so the window is scrolled directly.)
 */
export function scrollToId(id: string, smooth = false) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - (document.querySelector(".pp-app header")?.getBoundingClientRect().height || 56) - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: (smooth && !reducedMotion() ? "smooth" : "instant") as ScrollBehavior });
}
