"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ScreenSkeleton } from "../bits";
import { MyBottles } from "../Bottles";
import { PageTitle } from "../Library";
import { RequestsPanel } from "../Inbox";
import { FriendsPage } from "../Social";
import { ChannelsPanel, ChatsPanel, NeedsStrip, NewMessageSheet, SwitcherButton, TopTabs } from "../Messages";
import { TAB_ROOT_EVENT, setTabAtRoot } from "../appEvents";
import { useShell } from "../shellContext";
import TabView from "./TabView";
import { LIST_POLL_MS, MESSAGES_TABS, chosenMessagesTab, messagesBadges, type ChatOverview, type MessagesTabId } from "@/lib/passport/chat";
import type { BottleRequests, EventNotice, FriendsOverview, InboxData, SocialInbox } from "@/lib/passport/types";

/**
 * File 16: the Messages tab (the old Inbox, at the same address). Tabs across the top, swipeable, each with a badge when
 * something waits: Chats (the bar, friends and groups) · Channels · Requests ("Send a request", "Book an event") ·
 * Bottles (My bottles, unchanged) · Friends. The last tab used is remembered while the app is open. "Needs you" sits
 * above the tabs only when it has something; the quick switcher is at the top right.
 */
export type MessagesView = BottleRequests & { inbox?: InboxData | null; social?: SocialInbox | null; chat?: ChatOverview | null; friends?: FriendsOverview | null; event_notices?: EventNotice[] };
const HREF = "/passport/inbox";
let remembered: MessagesTabId | null = null;

export default function InboxTab() {
  return (
    <TabView<MessagesView> name="inbox" skeleton={<ScreenSkeleton rows={5} cards={0} />}>
      {(d) => <Messages d={d} />}
    </TabView>
  );
}

function Messages({ d }: { d: MessagesView }) {
  const params = useSearchParams();
  const router = useRouter();
  const shell = useShell();
  const asked = params?.get("tab") || null;
  const [picked, setPicked] = useState<MessagesTabId | null>(null);
  const current = chosenMessagesTab(picked ?? asked, remembered);
  useEffect(() => { remembered = current; }, [current]);
  const lastAsked = useRef(asked);
  useEffect(() => { if (asked !== lastAsked.current) { lastAsked.current = asked; setPicked(null); } }, [asked]);
  const [newOpen, setNewOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const choose = (id: MessagesTabId) => {
    setPicked(id);
    remembered = id;
    try { window.history.replaceState(window.history.state, "", id === "chats" ? HREF : `${HREF}?tab=${id}`); } catch { /* old browser */ }
    const top = stripRef.current ? stripRef.current.getBoundingClientRect().top + window.scrollY - 56 : 0;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  };
  // File 15: tapping the Messages tab again comes back to Chats.
  useEffect(() => { setTabAtRoot("inbox", current === "chats"); }, [current]);
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<{ tab: string }>).detail?.tab === "inbox") { setPicked("chats"); remembered = "chats"; } };
    window.addEventListener(TAB_ROOT_EVENT, on);
    return () => window.removeEventListener(TAB_ROOT_EVENT, on);
  }, []);
  // The chat list asks for news every 30 seconds while Messages is on screen.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== "visible" || shell?.tab !== "inbox") return;
      void shell?.views.load("inbox", { silent: true });
    }, LIST_POLL_MS);
    return () => clearInterval(t);
  }, [shell]);
  // Swipe left / right moves between the top tabs.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x; const dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    const i = MESSAGES_TABS.findIndex((x) => x.id === current);
    const next = MESSAGES_TABS[i + (dx < 0 ? 1 : -1)];
    if (next) choose(next.id);
  };
  const badges = messagesBadges({ chat: d.chat, requests: d.inbox?.member_requests, inquiries: d.inbox?.inquiries, bottles: d.requests, friendRequests: d.friends?.incoming.length ?? d.social?.incoming.length ?? 0 });
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageTitle kicker="Chats, channels and requests" title="Messages" />
        <div className="pt-5"><SwitcherButton chat={d.chat ?? null} /></div>
      </div>
      <NeedsStrip inbox={d.inbox ?? null} bottles={d.requests} offers={d.event_notices || []} />
      <TopTabs current={current} badges={badges} onPick={choose} stripRef={stripRef} />
      <div id="msg-panel" role="tabpanel" aria-labelledby={`msg-tab-${current}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[55vh] pt-4">
        {current === "chats" && <ChatsPanel chat={d.chat ?? null} social={d.social ?? null} onNew={() => setNewOpen(true)} />}
        {current === "channels" && <ChannelsPanel chat={d.chat ?? null} />}
        {current === "requests" && <RequestsPanel inbox={d.inbox ?? null} />}
        {current === "bottles" && <MyBottles initial={d} />}
        {current === "friends" && (d.friends ? <FriendsPage initial={d.friends} embedded /> : <p className="font-body text-sm" style={{ color: "#859277" }}>Friends can&rsquo;t load right now. <button type="button" className="underline" onClick={() => router.refresh()}>Try again</button></p>)}
      </div>
      {newOpen && <NewMessageSheet friends={d.friends ?? null} onClose={() => setNewOpen(false)} />}
    </>
  );
}
