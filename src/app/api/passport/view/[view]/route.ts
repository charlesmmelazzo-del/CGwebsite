import { NextResponse, type NextRequest } from "next/server";
import {
  getBottleRequests, getIndex, getLists, getMarksSafe, getMe, getMenus, getPassportCocktails, getReservations, getSpirits,
  type MemberAuth,
} from "@/lib/passport/bible";
import { memberRequest } from "@/lib/passport/route";
import { sortRequests } from "@/lib/passport/bottles";
import { needsMember } from "@/lib/passport/shell";
import { reserveEnabled } from "@/lib/reserve/enabled";

export const dynamic = "force-dynamic";

/**
 * File 06: what each tab shows, for the app frame (the tabs stay open in the browser, so moving between them never
 * reloads the page). Only the signed-in member's own data and what members may see; the Bible decides both. The Bible
 * is asked a few things at once per tab, never once per item.
 */
const VIEWS: Record<string, (auth: MemberAuth) => Promise<unknown>> = {
  // Home: their first name, the Passport exclusives, and what needs them right now.
  home: async (auth) => {
    const [me, exclusives, bottles, reservations] = await Promise.all([
      getMe(auth),
      getPassportCocktails(auth).catch(() => []),
      getBottleRequests(auth).catch(() => null),
      getReservations(auth).catch(() => []),
    ]);
    return {
      // Only what Home shows of their own record.
      first_name: me.member.first_name,
      needs_phone: me.member.needs_phone,
      exclusives,
      attention: bottles ? sortRequests(bottles.requests.filter(needsMember)) : [],
      reservations,
    };
  },
  // Menu: the Passport exclusives, the Toast menus an admin ticked, the spirits list, and the member's own hearts and stars.
  menu: async (auth) => {
    const [exclusives, menus, spirits, marks] = await Promise.all([getPassportCocktails(auth), getMenus(auth), getSpirits(auth), getMarksSafe(auth)]);
    return { exclusives, ...menus, spirits: spirits.menu_info.available ? spirits.spirits : null, marks };
  },
  // Index: everything (one call), the member's own lists, and their hearts and stars.
  index: async (auth) => {
    const [index, lists, marks] = await Promise.all([getIndex(auth), getLists(auth), getMarksSafe(auth)]);
    return { ...index, lists, marks };
  },
  // Events: their own upcoming reservations, and whether the public booking page is open.
  events: async (auth) => {
    const [reservations, book] = await Promise.all([getReservations(auth), reserveEnabled().catch(() => false)]);
    return { reservations, book };
  },
  // Inbox: My bottles (file 05).
  inbox: async (auth) => {
    const r = await getBottleRequests(auth);
    return { ...r, requests: sortRequests(r.requests) };
  },
};

export async function GET(req: NextRequest, { params }: { params: { view: string } }) {
  const view = VIEWS[params.view];
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return memberRequest(req, "passport-member", (auth) => view(auth));
}
