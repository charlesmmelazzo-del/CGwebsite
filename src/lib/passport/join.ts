import "server-only";
import { passport, PassportError } from "./bible";

/** File 18: is this the invitation-card sign-up page's address? (The Bible says no while sign-up is Off.) */
export async function joinPageOpen(slug: string): Promise<"ok" | "no" | "unavailable"> {
  try {
    await passport("POST", "/join/page", { body: { slug } });
    return "ok";
  } catch (e) {
    if (e instanceof PassportError && (e.status === 404 || e.status === 400 || e.status === 403)) return "no";
    return "unavailable";
  }
}

/** A passcode typed on that page: "ok" | "bad" (used, revoked, expired or made up: one answer) | "paused" | "unavailable". Nothing is used up. */
export async function checkPasscode(slug: string, code: string): Promise<"ok" | "bad" | "paused" | "unavailable"> {
  if (!code) return "bad";
  try {
    await passport("POST", "/join/check", { body: { slug, code } });
    return "ok";
  } catch (e) {
    if (e instanceof PassportError) {
      if (e.status === 400 || e.status === 403 || e.status === 404) return "bad";
      if (e.status === 429) return "paused";
    }
    return "unavailable";
  }
}
