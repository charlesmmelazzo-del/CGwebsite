import { NextResponse, type NextRequest } from "next/server";
import {
  getBarHome, getBarLists, getBottleRequests, getInbox, getIndex, getLists, getMarksSafe, getMe, getMenus, getPassportCocktails, getReservations, getSpirits,
  getPassportEvents, getSocialHome, getSocialInbox, getVotes, getForYou,
  type MemberAuth,
} from "@/lib/passport/bible";
import { memberRequest } from "@/lib/passport/route";
import { sortRequests } from "@/lib/passport/bottles";
import { needsMember } from "@/lib/passport/shell";
import { reserveEnabled } from "@/lib/reserve/enabled";
import { getPublicEvents } from "@/lib/passport/publicEventsServer";

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
    const [me, exclusives, bottles, reservations, bar, inbox, social, votes, forYou] = await Promise.all([
      getMe(auth),
      getPassportCocktails(auth).catch(() => []),
      getBottleRequests(auth).catch(() => null),
      getReservations(auth).catch(() => []),
      getBarHome(auth).catch(() => null),
      getInbox(auth).catch(() => null),
      getSocialHome(auth).catch(() => null),
      getVotes(auth).catch(() => null),
      getForYou(auth, 4).catch(() => null),
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
      // File 09: "I'm here" and friends at Common Good, Let's go plans, Shared with you, and a held place or a cancellation.
      social,
      // File 10: any open vote or bracket ("Voting is open"), and results during their window.
      votes: votes ? { open: votes.votes, results: votes.vote_results } : null,
      // File 12: "For you", up to four, from the member's own record only (nothing when too little history or off).
      for_you: forYou?.recommendations ?? [],
    };
  },
  // Menu: the Passport exclusives, the Toast menus an admin ticked, the spirits list, and the member's own hearts and stars.
  menu: async (auth) => {
    const [exclusives, menus, spirits, marks] = await Promise.all([getPassportCocktails(auth), getMenus(auth), getSpirits(auth), getMarksSafe(auth)]);
    return { exclusives, ...menus, spirits: spirits.menu_info.available ? spirits.spirits : null, marks };
  },
  // Index: everything (one call), the member's own lists, their hearts and stars, and (file 07) From Common Good.
  index: async (auth) => {
    const [index, lists, marks, bar, votes] = await Promise.all([getIndex(auth), getLists(auth), getMarksSafe(auth), getBarLists(auth).catch(() => null), getVotes(auth).catch(() => null)]);
    // File 10: open votes and brackets, then how many are under "Past votes".
    return { ...index, lists, marks, house_lists: bar?.house_lists ?? [], charts: bar?.charts ?? [], past_count: bar?.past_count ?? 0, votes: votes?.votes ?? [], vote_results: votes?.vote_results ?? [], past_votes_count: votes?.past_count ?? 0 };
  },
  // File 09: upcoming Passport events first (the member's own answers and friends going), then the same as before.
  // File 15, Part G: and the public website's events (the public page's own list and rule; nothing when unavailable).
  events: async (auth) => {
    const [events, reservations, book, public_events] = await Promise.all([getPassportEvents(auth).catch(() => null), getReservations(auth), reserveEnabled().catch(() => false), getPublicEvents().catch(() => [])]);
    return { events, reservations, book, public_events };
  },
  // Inbox: My bottles (file 05) and (file 08) the member's conversations with the bar, requests and event inquiries.
  // My bottles keeps its own shape at the top (requests, open_count, max_open); the rest arrives as `inbox`.
  // File 09 adds `social`: conversations with friends, friend requests waiting, and notices from the bar.
  inbox: async (auth) => {
    const [r, inbox, social] = await Promise.all([getBottleRequests(auth), getInbox(auth).catch(() => null), getSocialInbox(auth).catch(() => null)]);
    return { ...r, requests: sortRequests(r.requests), inbox, social };
  },
};

export async function GET(req: NextRequest, { params }: { params: { view: string } }) {
  const view = VIEWS[params.view];
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return memberRequest(req, "passport-member", (auth) => view(auth));
}
