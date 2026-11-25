import { NextResponse, type NextRequest } from "next/server";
import {
  getBarHome, getBarLists, getBottleRequests, getInbox, getIndex, getLists, getMarksSafe, getMe, getMenus, getPassportCocktails, getReservations, getSpirits,
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
  // Home: their first name, the Passport exclusives, what needs them right now, and (file 07) From the bar: messages,
  // What's new, Spirit of the Day, the Welcome Aperitif and the newest house list. A section that can't load is left out.
  home: async (auth) => {
    const [me, exclusives, bottles, reservations, bar, inbox] = await Promise.all([
      getMe(auth),
      getPassportCocktails(auth).catch(() => []),
      getBottleRequests(auth).catch(() => null),
      getReservations(auth).catch(() => []),
      getBarHome(auth).catch(() => null),
      getInbox(auth).catch(() => null),
    ]);
    return {
      // Only what Home shows of their own record.
      first_name: me.member.first_name,
      needs_phone: me.member.needs_phone,
      exclusives,
      attention: bottles ? sortRequests(bottles.requests.filter(needsMember)) : [],
      reservations,
      messages: bar?.messages ?? [],
      feed: bar?.feed ?? [],
      spirit_of_the_day: bar?.spirit_of_the_day ?? null,
      welcome_aperitif: bar?.welcome_aperitif ?? null,
      newest_list: bar?.newest_list ?? null,
      // File 08: an unread reply from the bar, a question on a request, a reply about an event (for "Right now").
      inbox: inbox ? { threads: inbox.threads.filter((t) => t.unread), member_requests: inbox.member_requests.filter((r) => r.question || r.unread), inquiries: inbox.inquiries.filter((q) => q.unread) } : null,
    };
  },
  // Menu: the Passport exclusives, the Toast menus an admin ticked, the spirits list, and the member's own hearts and stars.
  menu: async (auth) => {
    const [exclusives, menus, spirits, marks] = await Promise.all([getPassportCocktails(auth), getMenus(auth), getSpirits(auth), getMarksSafe(auth)]);
    return { exclusives, ...menus, spirits: spirits.menu_info.available ? spirits.spirits : null, marks };
  },
  // Index: everything (one call), the member's own lists, their hearts and stars, and (file 07) From Common Good.
  index: async (auth) => {
    const [index, lists, marks, bar] = await Promise.all([getIndex(auth), getLists(auth), getMarksSafe(auth), getBarLists(auth).catch(() => null)]);
    return { ...index, lists, marks, house_lists: bar?.house_lists ?? [], charts: bar?.charts ?? [], past_count: bar?.past_count ?? 0 };
  },
  // Events: their own upcoming reservations, and whether the public booking page is open.
  events: async (auth) => {
    const [reservations, book] = await Promise.all([getReservations(auth), reserveEnabled().catch(() => false)]);
    return { reservations, book };
  },
  // Inbox: My bottles (file 05) and (file 08) the member's conversations with the bar, requests and event inquiries.
  // My bottles keeps its own shape at the top (requests, open_count, max_open); the rest arrives as `inbox`.
  inbox: async (auth) => {
    const [r, inbox] = await Promise.all([getBottleRequests(auth), getInbox(auth).catch(() => null)]);
    return { ...r, requests: sortRequests(r.requests), inbox };
  },
};

export async function GET(req: NextRequest, { params }: { params: { view: string } }) {
  const view = VIEWS[params.view];
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return memberRequest(req, "passport-member", (auth) => view(auth));
}
