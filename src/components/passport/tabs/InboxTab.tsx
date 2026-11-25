"use client";

import { ScreenSkeleton } from "../bits";
import { MyBottles } from "../Bottles";
import { PageTitle, SectionTitle } from "../Library";
import TabView from "./TabView";
import type { BottleRequests } from "@/lib/passport/types";

/**
 * File 06: the Inbox tab. "My bottles" (file 05: requests with their statuses, accept, decline and cancel) lives here
 * now, with "Something we don't carry". Messages from the bar arrive in a later file.
 */
export default function InboxTab() {
  return (
    <TabView<BottleRequests> name="inbox" skeleton={<ScreenSkeleton rows={3} />}>
      {(d) => (
        <>
          <PageTitle kicker="For you" title="Inbox" />
          <section aria-labelledby="pp-my-bottles">
            <div id="pp-my-bottles"><SectionTitle>My bottles</SectionTitle></div>
            <MyBottles initial={d} />
          </section>
        </>
      )}
    </TabView>
  );
}
