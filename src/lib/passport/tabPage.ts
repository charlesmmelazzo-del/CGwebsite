import "server-only";
import { redirect } from "next/navigation";
import { currentAuth } from "./session";

/**
 * File 06: a tab's own address. The app frame draws the tab and fetches its data (members only, through
 * /api/passport/view/*), so the address itself only checks the Passport cookie: no call to the Bible, and moving
 * between tabs never waits on one. A sign-in the Bible has ended is caught by the tab's own request.
 */
export function tabPage(): null {
  if (!currentAuth()) redirect("/passport");
  return null;
}
