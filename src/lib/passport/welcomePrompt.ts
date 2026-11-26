/**
 * File 16, Part 8: the "Save Passport to your home screen" and "Get notifications" pop-up. One modal sheet over the
 * app (the page fully laid out behind it, dimmed) instead of cards in the page. This is the pure rule for when it
 * shows and what it holds (no browser code), so it can be tested.
 *
 * When: on the member's first visit after signing in (once Home has rendered, never on a loading screen), and later
 * only by these rules: never in the first second of a visit; at most once a day; after "Not now", not again for 30
 * days; never once Passport is installed AND notifications are on.
 *
 * What: only the steps that are missing. Not installed → the install step (iPhone: Share → Add to Home Screen; Android
 * and Chrome: the browser's install button when it offers one, else the menu instructions). Then, when installed or on
 * a platform where notifications work without installing, "Get a message when the bar writes back". On an iPhone in
 * Safari that hasn't added Passport, notifications come only after adding it, so only the install step shows (and says so).
 */
export type PushNow = "on" | "off" | "blocked" | "unsupported" | "needs-install";
export type WelcomeStep = "install" | "notify";
export interface WelcomeInput {
  homeRendered: boolean;
  /** Milliseconds since this visit began (the app was opened). */
  sinceVisit: number;
  installed: boolean;
  push: PushNow;
  ios: boolean;
  now: number;
  /** When the pop-up last showed on this device, or null (never: the first visit after signing in). */
  lastShown: number | null;
  /** When the member last tapped "Not now", or null. */
  snoozed: number | null;
}
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_MS = 30 * DAY_MS;
export const FIRST_SECOND_MS = 1000;

/** Which steps are missing on this device (in order), whatever the timing. */
export function welcomeSteps(x: Pick<WelcomeInput, "installed" | "push" | "ios">): WelcomeStep[] {
  const steps: WelcomeStep[] = [];
  if (!x.installed) steps.push("install");
  // Notifications: only where they can work now. An iPhone needs Passport on the home screen first.
  const canNotify = x.push === "off" && (x.installed || !x.ios);
  if (canNotify) steps.push("notify");
  return steps;
}

/** Whether the pop-up shows now, and with which steps. */
export function welcomePlan(x: WelcomeInput): { show: boolean; steps: WelcomeStep[]; why: string } {
  const steps = welcomeSteps(x);
  const no = (why: string) => ({ show: false, steps, why });
  if (x.installed && x.push === "on") return no("installed and notifications on: never");
  if (!steps.length) return no("nothing is missing that can be done here");
  if (!x.homeRendered) return no("Home has not rendered yet");
  if (x.sinceVisit < FIRST_SECOND_MS) return no("never in the first second of a visit");
  if (x.snoozed !== null && x.now - x.snoozed < SNOOZE_MS) return no("Not now: 30 days");
  if (x.lastShown !== null && x.now - x.lastShown < DAY_MS) return no("at most once a day");
  return { show: true, steps, why: x.lastShown === null ? "the first visit after signing in" : "again, by the rules" };
}
/** On an iPhone in Safari that hasn't added Passport, the install step says notifications come after adding it. */
export const iosInstallNote = (x: Pick<WelcomeInput, "installed" | "ios" | "push">) => !x.installed && x.ios;
