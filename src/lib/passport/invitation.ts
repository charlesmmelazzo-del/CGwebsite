import "server-only";
import { passport, PassportError } from "./bible";

/** "abcd 2345" → "ABCD-2345"; anything that can't be an invitation code → "". */
export function cleanCode(v: unknown): string {
  const c = (typeof v === "string" ? v : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z2-9]{8}$/.test(c) ? `${c.slice(0, 4)}-${c.slice(4)}` : "";
}

export const BAD_CODE = "That invitation code isn't valid. Check it and try again, or ask the bar for a new one.";

/**
 * Ask the Bible whether an invitation can be used right now. Nothing is used
 * up; that happens when the member finishes signing up.
 *   "ok" | "bad" | "paused" (too many wrong codes everywhere) | "unavailable"
 */
export async function checkCode(code: string): Promise<"ok" | "bad" | "paused" | "unavailable"> {
  if (!code) return "bad";
  try {
    await passport("POST", "/invitation/check", { body: { code } });
    return "ok";
  } catch (e) {
    if (e instanceof PassportError) {
      if (e.status === 400 || e.status === 403) return "bad";
      if (e.status === 429) return "paused";
    }
    return "unavailable";
  }
}
