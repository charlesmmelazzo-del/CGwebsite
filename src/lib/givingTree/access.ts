// ─── Who sees what (server only) ─────────────────────────────────────────────
//
// The Giving Tree belongs to whichever pop-up uses the "giving-tree" template
// (the Christmas pop-up, created as a draft by db/giving-tree.sql). Its state
// follows that pop-up's own status — there is no separate switch:
//
//   live            → "open":    real opportunities take claims.
//   archived        → "closed":  another pop-up has gone live since, so every
//                                opportunity is off and only the sky shows.
//   draft/scheduled → nothing public. Only the admin sandbox
//                     (/popup/preview/<slug>) can see it, as "sandbox", which
//                     is also the only place demo records ever appear.

import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isPreviewDeployment } from "@/lib/previewGate";
import { getAllMenus, pickLiveMenu } from "@/lib/popup/menus";
import type { TreeMode } from "./types";

export const TEMPLATE_KEY = "giving-tree";

export async function isAdmin(): Promise<boolean> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

/** Same rule as the /popup/preview sandbox page: admin, or anyone on staging. */
export async function canUseSandbox(): Promise<boolean> {
  return isPreviewDeployment() || (await isAdmin());
}

/** Public status of the Giving Tree pop-up, ignoring the sandbox. */
export async function publicMode(): Promise<Exclude<TreeMode, "sandbox"> | null> {
  const menus = await getAllMenus();
  const live = pickLiveMenu(menus);
  if (live?.templateKey === TEMPLATE_KEY) return "open";
  const now = Date.now();
  const wasLive = menus.some(
    (m) =>
      m.templateKey === TEMPLATE_KEY &&
      (m.status === "archived" || m.status === "live" || (m.status === "scheduled" && m.goLiveAt && Date.parse(m.goLiveAt) <= now))
  );
  return wasLive ? "closed" : null;
}

/** The mode for this request, or null when the tree isn't viewable at all. */
export async function resolveMode(wantSandbox: boolean): Promise<TreeMode | null> {
  if (wantSandbox && (await canUseSandbox())) return "sandbox";
  return publicMode();
}

/** Emails are marked [TEST] until the Giving Tree pop-up is live. */
export async function emailsAreTest(): Promise<boolean> {
  try {
    return (await publicMode()) !== "open";
  } catch {
    return true;
  }
}

/**
 * The address guests used, so links in emails go back to the same copy of the
 * site (staging tests → staging). Railway sits behind a proxy.
 */
export function siteOrigin(): string {
  try {
    const h = headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
    if (host) {
      const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not inside a request.
  }
  return (process.env.SITE_URL || "https://commongoodcocktailhouse.com").replace(/\/+$/, "");
}
