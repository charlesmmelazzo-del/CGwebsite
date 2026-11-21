import "server-only";
import { redirect } from "next/navigation";
import { PassportError, type MemberAuth } from "./bible";
import { loadMe } from "./page";
import { currentAuth } from "./session";

/**
 * For a signed-in Passport page: the member's auth, or a redirect to sign-in.
 * `run` fetches the page's data; a sign-in that has ended sends them back to sign in,
 * a missing item is a not-found, anything else is "temporarily unavailable".
 */
export async function memberData<T>(run: (auth: MemberAuth) => Promise<T>): Promise<{ data?: T; unavailable?: boolean; notFound?: boolean }> {
  const s = await loadMe();
  if (s.unavailable) return { unavailable: true };
  const auth = currentAuth();
  if (!s.me || !auth) redirect("/passport");
  try {
    return { data: await run(auth) };
  } catch (e) {
    if (e instanceof PassportError && e.signedOut) redirect("/passport");
    if (e instanceof PassportError && e.status === 404) return { notFound: true };
    return { unavailable: true };
  }
}
