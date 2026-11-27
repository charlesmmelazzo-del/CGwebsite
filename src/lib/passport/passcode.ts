/**
 * File 18: invitation-card passcodes and the sign-up page address. Shared by the server routes, the page and tests
 * (no server-only imports here).
 *
 * A passcode is 4 characters from 2-9 and A-Z without I, L and O (31 characters, easy to read off handwriting),
 * shown in capitals. Any case is accepted, and spaces and dashes are ignored.
 */
export const PASSCODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PASSCODE_LEN = 4;
export const BAD_PASSCODE = "That passcode isn't valid";
export const PASSCODE_LIMIT_MESSAGE = "Too many tries in a short time. Please wait a few minutes and try again.";

/** " ab-c d " → "ABCD"; anything that can't be a passcode → "". */
export function cleanPasscode(v: unknown): string {
  const c = (typeof v === "string" ? v : "").toUpperCase().replace(/[\s-]/g, "");
  return c.length === PASSCODE_LEN && c.split("").every((ch) => PASSCODE_ALPHABET.includes(ch)) ? c : "";
}

/** What the box shows while typing: capitals, only characters a passcode can hold, at most 4. */
export function typedPasscode(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").split("").filter((ch) => PASSCODE_ALPHABET.includes(ch)).join("").slice(0, PASSCODE_LEN);
}

/** The sign-up page's address part: 12 lowercase letters and digits (an admin setting in the Bible). */
export const isJoinSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{12}$/.test(v);

/**
 * Where the sign-in page's "Sign up" button goes, or null for no button. The Bible sends the page address only while
 * an admin has the "Sign up" button turned on (off by default), so with it off nothing on the site links to the page.
 */
export function signUpButtonHref(config: { signup_button?: boolean; join_path?: string }): string | null {
  if (config.signup_button !== true || typeof config.join_path !== "string") return null;
  const slug = config.join_path.replace(/^\/passport\/join\//, "");
  return config.join_path.startsWith("/passport/join/") && isJoinSlug(slug) ? config.join_path : null;
}
