"use client";

import { ScreenSkeleton } from "../bits";
import { MyBottles } from "../Bottles";
import { PageTitle, SectionTitle } from "../Library";
import { InboxActions, InboxSections } from "../Inbox";
import { InboxFriends } from "../Social";
import TabView from "./TabView";
import type { BottleRequests, InboxData, SocialInbox } from "@/lib/passport/types";

/**
 * File 08: the Inbox tab. Three actions at the top (Message the bar, Make a request, Plan an event), then, each only
 * when it has something: Needs you (a price to answer, a bottle ready, an unread reply, a question on a request),
 * Messages (newest activity first, unread marked), Requests (general requests and event inquiries with their status),
 * (file 09) notes from the bar and Friends (friend requests and conversations with friends, apart from messages with the
 * bar), and My bottles (file 05, unchanged).
 */
export default function InboxTab() {
  return (
    <TabView<BottleRequests & { inbox?: InboxData | null; social?: SocialInbox | null }> name="inbox" skeleton={<ScreenSkeleton rows={4} cards={1} />}>
      {(d) => (
        <>
          <PageTitle kicker="Messages and requests" title="Inbox" />
          <InboxActions />
          <InboxSections inbox={d.inbox ?? null} bottles={d.requests} title={(id, children) => <div id={id}><SectionTitle section="inbox">{children}</SectionTitle></div>} />
          <InboxFriends social={d.social} title={(id, children) => <div id={id}><SectionTitle section="friends">{children}</SectionTitle></div>} />
          <section aria-labelledby="pp-my-bottles">
            <div id="pp-my-bottles"><SectionTitle section="spirits">My bottles</SectionTitle></div>
            <MyBottles initial={d} />
          </section>
        </>
      )}
    </TabView>
  );
}
