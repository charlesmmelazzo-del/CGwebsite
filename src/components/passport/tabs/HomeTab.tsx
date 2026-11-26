"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { C } from "../theme";
import { SeeAll, Skel } from "../bits";
import { KindLabel, SectionHeading, accentCardStyle } from "../Drill";
import { ACCENTS, sectionOf, type CardKind } from "@/lib/passport/accents";
import { CocktailFeature } from "../Library";
import InstallHint from "../InstallHint";
import PushPrompt from "../PushPrompt";
import PhonePrompt from "../PhonePrompt";
import TabView from "./TabView";
import { FromTheBar, HereButtons, NewestList, SharedWithYou, Tonight, WhatsNew } from "./Slots";
import { FriendsHere, LetsGoCards } from "../Social";
import { VotesHome } from "../Votes";
import { ForYouHome } from "../ForYou";
import { eventNoticeWords } from "@/lib/passport/social";
import { dayLong, partyOf, reservationWord } from "@/lib/passport/shell";
import { money } from "@/lib/passport/bottles";
import type { InboxData, Recommendation, SocialHome, VoteCard } from "@/lib/passport/types";
import type { BarMessage, BottleRequest, Cocktail, FeedCard, HouseList, Reservation, SpiritOfTheDay as Spirit, WelcomeAperitif as Aperitif } from "@/lib/passport/types";

/** What the Home view sends (api/passport/view/home). */
export interface HomeView {
  first_name: string; needs_phone: boolean; exclusives: Cocktail[]; attention: BottleRequest[]; reservations: Reservation[];
  // File 07: From the bar.
  messages?: BarMessage[]; feed?: FeedCard[]; spirit_of_the_day?: Spirit | null; welcome_aperitif?: Aperitif | null; newest_list?: HouseList | null;
  // File 08: what waits on the member in the Inbox (an unread reply, a question on a request, a reply about an event).
  inbox?: Pick<InboxData, "threads" | "member_requests" | "inquiries"> | null;
  // File 09: I'm here and friends here, Let's go, Shared with you, a held place or a cancelled event.
  social?: SocialHome | null;
  // File 10: open votes and brackets, and results during their window.
  votes?: { open: VoteCard[]; results: VoteCard[] } | null;
  // File 12: "For you", up to four, from the member's own record only.
  for_you?: Recommendation[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skel w={120} h={10} /><Skel w="60%" h={30} className="mt-2" />
      <div className="mt-8 rounded-xl border p-5 space-y-2.5" style={{ borderColor: C.line }}><Skel w="40%" h={10} /><Skel w="70%" h={18} /></div>
      <div className="mt-8 rounded-xl border p-5 space-y-2.5" style={{ borderColor: C.line }}><Skel w="55%" h={22} /><Skel w="85%" h={12} /><Skel w="60%" h={12} /></div>
    </div>
  );
}

/**
 * One thing that needs the member right now: a tappable card in its section's colours (File 14, Part 7): a coloured
 * left edge, a tinted background and the section's icon and word, so a reservation, a bottle ready and a reply from
 * the bar look different at a glance (and never by colour alone).
 */
function NowCard({ href, kind, kicker, title, line }: { href: string; kind: CardKind; kicker: string; title: string; line?: string }) {
  const section = sectionOf(kind);
  return (
    <Link href={href} scroll={false} className="flex items-center gap-3 rounded-xl border px-4 py-3.5 pp-focus pp-row pp-card pp-accent-card h-full" style={accentCardStyle(section)}>
        <span className="flex-1 min-w-0">
          <KindLabel section={section}>{kicker}</KindLabel>
          <span className="block pp-t-card mt-1" style={{ color: C.text }}>{title}</span>
          {line && <span className="block pp-t-secondary mt-0.5" style={{ color: C.muted }}>{line}</span>}
        </span>
        <span aria-hidden style={{ color: ACCENTS[section].ink }}>→</span>
    </Link>
  );
}

/**
 * Home (the CG button). File 12 set the order so a long Home reads top to bottom at a glance, each section only when
 * it has something in it: the welcome and the two round buttons (and friends at Common Good now); Right now (what
 * needs the member, then Let's go plans to answer); Tonight (the Welcome Aperitif and the Spirit of the Day as one
 * compact pair); open votes; For you; From the bar; What's new; Shared with you; the newest house list; the Passport
 * exclusives. A section with more than three cards keeps the rest behind "See all" (What's new and For you scroll
 * sideways instead).
 */
export default function HomeTab() {
  return (
    <TabView<HomeView> name="home" skeleton={<HomeSkeleton />}>
      {(d) => {
        const ready = d.attention.filter((r) => r.status === "ready");
        const prices = d.attention.filter((r) => r.can_answer);
        const next = d.reservations[0];
        const replies = d.inbox?.threads.filter((t) => t.unread) ?? [];
        const questions = d.inbox?.member_requests.filter((r) => r.question || r.unread) ?? [];
        const events = d.inbox?.inquiries.filter((q) => q.unread) ?? [];
        const eventNotes = d.social?.event_notices ?? [];
        const now: { key: string; card: ReactNode }[] = [
          ...eventNotes.map((n) => { const w = eventNoticeWords(n); return { key: `ev${n.kind}${n.id}`, card: <NowCard kind="event-notice" href={`/passport/events/${n.id}`} kicker={w.kicker} title={`${n.title} · ${dayLong(n.date)}`} line={w.line} /> }; }),
          ...questions.map((r) => ({ key: `q${r.id}`, card: <NowCard kind="request-question" href={`/passport/inbox/requests/${r.id}`} kicker={r.question ? "A question about your request" : "A note about your request"} title={r.kind_label} line={r.question ? "Answer it in your Inbox." : r.status_label} /> })),
          ...replies.map((t) => ({ key: `t${t.id}`, card: <NowCard kind="bar-reply" href={`/passport/inbox/messages/${t.id}`} kicker="A reply from the bar" title={t.subject || (t.ref ? `About ${t.ref.name}` : "Your message")} line={t.preview} /> })),
          ...events.map((q) => ({ key: `e${q.id}`, card: <NowCard kind="event-reply" href={`/passport/inbox/events/${q.id}`} kicker="About your event" title={`${q.kind_label} · ${dayLong(q.preferred_date)}`} line={q.status_label} /> })),
          ...ready.map((r) => ({ key: `r${r.id}`, card: <NowCard kind="bottle-ready" href="/passport/inbox" kicker="Ready for pickup" title={r.name} line={r.quantity > 1 ? `${r.quantity} bottles, set aside for you at the bar` : "Set aside for you at the bar"} /> })),
          ...prices.map((r) => ({ key: `p${r.id}`, card: <NowCard kind="bottle-price" href="/passport/inbox" kicker="A price is waiting for you" title={r.name} line={r.quote ? `${money(r.quote.price_cents)} a bottle, plus tax. Accept or decline in your Inbox.` : "Accept or decline in your Inbox."} /> })),
          ...(next ? [{ key: "res", card: <NowCard kind="reservation" href="/passport/events" kicker={`Your table · ${reservationWord(next.status)}`} title={dayLong(next.date)} line={`${next.time} · ${partyOf(next.party_size)}`} /> }] : []),
        ];
        return (
          <div>
            {d.needs_phone && <PhonePrompt />}
            <p className="pp-t-eyebrow" style={{ color: C.brass }} suppressHydrationWarning>{greeting()}</p>
            <h1 className="pp-t-page mt-1" style={{ color: C.text }}>Welcome, {d.first_name}</h1>
            {/* File 12: under the welcome, so the page's heading comes first. */}
            <div className="mt-6 -mb-6"><InstallHint /></div>
            {/* File 13: once, after the member has used Passport for a bit: notifications on this phone. */}
            <PushPrompt />
            <HereButtons presence={d.social?.presence} hasFriends={d.social?.has_friends} />
            <FriendsHere friends={d.social?.friends_here} />
            {now.length > 0 && (
              <section aria-labelledby="pp-now">
                <SectionHeading id="pp-now">Right now</SectionHeading>
                <SeeAll items={now} keyOf={(x) => x.key} render={(x) => x.card} what="things waiting" href="/passport/inbox" />
              </section>
            )}
            <LetsGoCards plans={d.social?.letsgo} />
            <Tonight aperitif={d.welcome_aperitif} spirit={d.spirit_of_the_day} />
            <VotesHome open={d.votes?.open} results={d.votes?.results} />
            <ForYouHome items={d.for_you} />
            <FromTheBar messages={d.messages} />
            <WhatsNew cards={d.feed} />
            <SharedWithYou shared={d.social?.shared} />
            <NewestList list={d.newest_list} />
            {d.exclusives.length > 0 && (
              <section aria-labelledby="pp-exclusives">
                <SectionHeading id="pp-exclusives" section="cocktails">Passport exclusives</SectionHeading>
                <p className="pp-t-secondary -mt-1 mb-3" style={{ color: C.muted }}>Members only</p>
                <SeeAll items={d.exclusives} keyOf={(c) => String(c.id)} render={(c) => <CocktailFeature c={c} />} what="exclusives" href="/passport/menu?tab=exclusives" />
              </section>
            )}
          </div>
        );
      }}
    </TabView>
  );
}
