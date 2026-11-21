import "server-only";
import { getConfig, getMe, PassportError, type Config, type Me } from "./bible";
import { currentAuth } from "./session";

/**
 * What a Passport page needs on the server: the signed-in member (or why not).
 *   { me }            signed in
 *   { signedOut }     no cookie, or the Bible says that sign-in has ended
 *   { unavailable }   the Bible couldn't be reached
 */
export async function loadMe(): Promise<{ me?: Me; signedOut?: boolean; ended?: boolean; unavailable?: boolean }> {
  const auth = currentAuth();
  if (!auth) return { signedOut: true };
  try {
    return { me: await getMe(auth) };
  } catch (e) {
    if (e instanceof PassportError && e.signedOut) return { signedOut: true, ended: true };
    return { unavailable: true };
  }
}

/** The sign-up setting and terms, or a safe default (sign-up Off) when the Bible can't be reached. */
export async function loadConfig(): Promise<Config & { unavailable?: boolean }> {
  try {
    return await getConfig();
  } catch {
    return { signup_mode: "off", terms_version: 0, terms_text: "", unavailable: true };
  }
}
