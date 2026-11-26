"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { C } from "./theme";
import { PassportMark } from "./ui";
import AddToList from "./AddToList";
import { CHANGED_EVENT, TAB_ROOT_EVENT, appMoved, recordStep, reducedMotion, tabAtRoot, type Changed } from "./appEvents";
import { isTabRoot, tabPress } from "@/lib/passport/nav";
import { ShellContext, ViewStore, type AddTarget, type ShellApi, type ViewEntry, type ViewName } from "./shellContext";
import { TABS, homeTabOf, inboxDot, tabHref, tabOfPath, type TabId } from "@/lib/passport/shell";
import type { BottleRequests, InboxData, PassportList, SocialInbox } from "@/lib/passport/types";
import { needsYou } from "@/lib/passport/inbox";
import { socialLit } from "@/lib/passport/social";
import { messagesBadges, messagesLit, type ChatOverview } from "@/lib/passport/chat";
import HomeTab from "./tabs/HomeTab";
import MenuTab from "./tabs/MenuTab";
import IndexTab from "./tabs/IndexTab";
import EventsTab from "./tabs/EventsTab";
import InboxTab from "./tabs/InboxTab";
import { countOpen } from "./pushClient";

/**
 * File 06: the Passport app frame. Five tabs along the bottom (a top bar on a wide screen): Menu · Index · CG · Events ·
 * Messages (file 16: the Inbox, renamed, with a chat-bubble icon). Each tab, once opened, stays open in the background with its scroll position, so moving between tabs is
 * instant and nothing reloads the whole screen. Pages (a cocktail, a bottle, a list, your account) slide over the tab
 * they were opened from; going back reveals the list exactly where it was.
 */

const ICONS: Record<TabId, ReactNode> = {
  menu: <><path d="M6.5 4h11l-5.5 7.5z" /><path d="M12 11.5V19M8.5 20h7" /></>,
  index: <><path d="M5 4.5h4v15H5zM10.5 4.5h4v15h-4z" /><path d="m16 5.3 3.2-.8 3 14.2-3.2.8z" /></>,
  home: null,
  events: <><rect x="4" y="5.5" width="16" height="14.5" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  // File 16: Messages, a chat bubble.
  inbox: <><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6.5L6 19.5V16H7a2.5 2.5 0 0 1-2.5-2.5z" /><path d="M8.5 9h7M8.5 12h4.5" /></>,
};
const VIEW_OF: Record<TabId, ViewName> = { menu: "menu", index: "index", home: "home", events: "events", inbox: "inbox" };
// File 12: a heart, a star or a list also changes "For you" (Home and the Index); so does "Not for me".
const WHAT_CHANGES: Record<Changed, ViewName[]> = { marks: ["menu", "index", "home"], lists: ["index", "home"], inbox: ["inbox", "home"], votes: ["home", "index"], recs: ["home", "index"] };
const STALE_MS = 5 * 60 * 1000;

function Icon({ id, on }: { id: TabId; on: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 1.9 : 1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[id]}
    </svg>
  );
}

export default function AppShell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  if (!signedIn) return <>{children}</>;
  return <Frame>{children}</Frame>;
}

/** File 15, Part B: records each place the member moves to (address and the tab it sits on), for the Back controls. */
function StepTracker({ tab }: { tab: TabId }) {
  const pathname = usePathname() || "/passport";
  const params = useSearchParams();
  const search = params?.toString() || "";
  useEffect(() => { recordStep(`${pathname}${search ? `?${search}` : ""}`, tab); }, [pathname, search, tab]);
  return null;
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/passport";
  const router = useRouter();
  const pathTab = tabOfPath(pathname);
  const [pending, setPending] = useState<TabId | null>(null);
  const [under, setUnder] = useState<TabId>(() => pathTab ?? homeTabOf(pathname));
  const overlay = !pending && !pathTab;
  const tab: TabId = pending ?? pathTab ?? under;
  const [visited, setVisited] = useState<Set<TabId>>(() => new Set(pathTab ? [pathTab] : []));
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; n: number } | null>(null);
  // The Inbox dot: lit while a bottle needs the member (file 05) or a reply or question waits (file 08).
  const [bottleDot, setDot] = useState(false);
  const [messagesDot, setMessagesDot] = useState(false);
  const dot = bottleDot || messagesDot;
  const listsCache = useRef<PassportList[] | null>(null);
  const views = useMemo(() => new ViewStore(() => window.location.assign("/passport?signed_out=1")), []);

  // The tab under the page that is open, and which tabs have been opened (they stay mounted from then on).
  // File 13: count this open, so Home's notifications card waits until the member has used Passport for a bit.
  useEffect(() => { countOpen(); }, []);
  useEffect(() => { setPending(null); }, [pathname]);
  useEffect(() => { if (pathTab) setUnder(pathTab); }, [pathTab]);
  useEffect(() => {
    if (overlay) return;
    setVisited((v) => (v.has(tab) ? v : new Set(v).add(tab)));
  }, [tab, overlay]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } appMoved(); }, [pathname]);

  // Data: load a tab the first time it shows; refresh it quietly when it shows again after a while.
  useEffect(() => {
    if (overlay) return;
    const v = VIEW_OF[tab];
    const e = views.get(v);
    if (!views.loaded(v)) void views.load(v);
    else if (!e.loading && Date.now() - e.at > STALE_MS) void views.load(v, { silent: true });
  }, [tab, overlay, views]);
  // The Inbox dot needs My bottles from the start, whichever tab opened first.
  useEffect(() => { if (!views.loaded("inbox")) void views.load("inbox"); }, [views]);
  // (Read from the store directly: this component provides the context, so it can't read it.)
  const inbox = useSyncExternalStore((fn) => views.subscribe("inbox", fn), () => views.get("inbox"), () => views.get("inbox")) as ViewEntry<BottleRequests & { inbox?: InboxData | null; social?: SocialInbox | null; chat?: ChatOverview | null; friends?: { incoming: unknown[] } | null }>;
  useEffect(() => {
    if (!inbox.data) return;
    setDot(inboxDot(inbox.data.requests));
    // File 09: a friend request, an unread message from a friend, or a note from the bar light it too.
    // File 16: any of the Messages top tabs with something waiting (a chat, a channel, a request, a bottle, a friend request).
    const b = messagesBadges({ chat: inbox.data.chat, requests: inbox.data.inbox?.member_requests, inquiries: inbox.data.inbox?.inquiries, bottles: inbox.data.requests, friendRequests: inbox.data.friends?.incoming.length ?? inbox.data.social?.incoming.length ?? 0 });
    setMessagesDot(needsYou(inbox.data.inbox, []).length > 0 || socialLit(inbox.data.social) || messagesLit(b));
  }, [inbox.data]);
  // Something changed (a heart, a list, a bottle request): the tabs that show it refresh in the background.
  useEffect(() => {
    const on = (e: Event) => {
      const what = (e as CustomEvent<{ what: Changed }>).detail?.what;
      for (const v of WHAT_CHANGES[what] || []) if (views.loaded(v)) void views.load(v, { silent: true });
      if (what === "lists") listsCache.current = null;
    };
    window.addEventListener(CHANGED_EVENT, on);
    return () => window.removeEventListener(CHANGED_EVENT, on);
  }, [views]);
  // Back to the app after a while (phone unlocked, app reopened): refresh the tab on screen and the Inbox dot.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const on = () => {
      if (document.visibilityState !== "visible") return;
      for (const v of [VIEW_OF[tabRef.current], "inbox" as ViewName]) {
        const e = views.get(v);
        if (views.loaded(v) && !e.loading && Date.now() - e.at > 60_000) void views.load(v, { silent: true });
      }
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [views]);

  // Scroll: each tab keeps its own place. Tabs scroll the window; a page over a tab scrolls on its own.
  const scrollOf = useRef<Partial<Record<TabId, number>>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayScroll = useRef<Record<string, number>>({});
  const overlayOpen = useRef(overlay);
  overlayOpen.current = overlay;
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const on = () => { if (!overlayOpen.current) scrollOf.current[tabRef.current] = window.scrollY; };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const shownTab = useRef<TabId | null>(null);
  useLayoutEffect(() => {
    if (overlay || shownTab.current === tab) return;
    shownTab.current = tab;
    // "instant": the site scrolls smoothly by default, which would animate the jump back to where the member left off.
    window.scrollTo({ top: scrollOf.current[tab] || 0, behavior: "instant" as ScrollBehavior });
  }, [tab, overlay]);
  // The page over a tab: slides in from the side when it opens from a list, a light fade between pages.
  const wasOverlay = useRef(false);
  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!overlay || !el) { wasOverlay.current = overlay; return; }
    el.scrollTop = overlayScroll.current[pathname] || 0;
    if (!reducedMotion() && el.animate) {
      if (!wasOverlay.current) el.animate([{ transform: "translateX(100%)" }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      else el.animate([{ opacity: 0.4, transform: "translateX(18px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
    }
    wasOverlay.current = true;
  }, [pathname, overlay]);
  // File 12: Back slides the page out the way it came in (to the side), over the tab it was opened from. The page keeps
  // what it showed while it leaves; with "reduce motion" it simply goes.
  const lastPage = useRef<ReactNode>(null);
  if (overlay) lastPage.current = children;
  const [exiting, setExiting] = useState(false);
  const prevOverlay = useRef(overlay);
  useLayoutEffect(() => {
    const was = prevOverlay.current;
    prevOverlay.current = overlay;
    if (overlay) { setExiting(false); return; }
    if (was && !reducedMotion() && typeof Element !== "undefined" && "animate" in Element.prototype) setExiting(true);
  }, [overlay]);
  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!exiting || !el || !el.animate) return;
    const anim = el.animate([{ transform: "none" }, { transform: "translateX(100%)" }], { duration: 220, easing: "cubic-bezier(0.4, 0, 0.8, 0.4)", fill: "forwards" });
    anim.onfinish = () => setExiting(false);
    return () => { anim.onfinish = null; anim.cancel(); };
  }, [exiting]);
  const pageShown = overlay || exiting;

  // While a page is over a tab, the tab behind it is out of reach for keyboards and screen readers.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const m = mainRef.current as (HTMLElement & { inert?: boolean }) | null;
    if (m) { m.inert = overlay || !!addTarget; m.setAttribute("aria-hidden", overlay ? "true" : "false"); }
    const o = overlayRef.current as (HTMLElement & { inert?: boolean }) | null;
    if (o) o.inert = !!addTarget;
  }, [overlay, addTarget]);

  const toast = useCallback((text: string) => setToastMsg((t) => ({ text, n: (t?.n || 0) + 1 })), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);
  const closeAdd = useCallback(() => setAddTarget(null), []);
  const api: ShellApi = useMemo(() => ({ views, tab, openAdd: setAddTarget, toast, setInboxDot: setDot, setMessagesDot }), [views, tab, toast]);

  /**
   * A tab tap: show it at once (the address follows). File 15, Part B: tapping the tab already on screen returns it to
   * its top level (Index root, the Menu's first section, the Inbox, Events or Home top) and scrolls up; tapped again at
   * the top, nothing happens. The same on the bottom bar and the wide-screen top bar.
   */
  const onTab = (e: React.MouseEvent, id: TabId) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (id !== tab) { setPending(id); return; }
    const here = typeof window !== "undefined" ? window.location : null;
    const atRoot = !!here && isTabRoot(id, here.pathname, here.search, tabAtRoot(id) !== false);
    const action = tabPress({ overlay, atRoot, scrollY: typeof window !== "undefined" ? window.scrollY : 0 });
    e.preventDefault();
    if (action === "none") return;
    if (action === "top") { window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); return; }
    window.dispatchEvent(new CustomEvent(TAB_ROOT_EVENT, { detail: { tab: id } }));
    scrollOf.current[id] = 0;
    if (here && here.pathname + here.search !== tabHref(id)) { setPending(id); router.push(tabHref(id), { scroll: false }); }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  const tabLink = (t: (typeof TABS)[number], where: "bottom" | "top") => {
    const on = t.id === tab;
    const label = t.id === "inbox" && dot ? "Messages, something is waiting" : t.id === "home" ? "Home" : t.label;
    if (t.id === "home") {
      return (
        <Link href={t.href} scroll={false} onClick={(e) => onTab(e, t.id)} aria-current={on ? "page" : undefined} aria-label={label}
          className={`pp-focus pp-press rounded-full flex items-center justify-center shrink-0 ${where === "bottom" ? "w-[62px] h-[62px] -mt-6 shadow-lg" : "w-12 h-12"}`}
          style={{ background: on ? C.brass : "#1d2318", border: `1.5px solid ${C.brass}`, color: on ? C.bg : C.brass, boxShadow: where === "bottom" ? `0 6px 18px rgba(0,0,0,0.45), 0 0 0 5px ${C.bg}` : undefined }}>
          <span className="font-display text-[1.375rem] leading-none tracking-wide" style={{ marginTop: 2 }}>CG</span>
        </Link>
      );
    }
    return (
      <Link href={t.href} scroll={false} onClick={(e) => onTab(e, t.id)} aria-current={on ? "page" : undefined} aria-label={label}
        className={`pp-focus relative flex items-center rounded-lg ${where === "bottom" ? "flex-col justify-center gap-1 w-full min-h-[56px] pt-1.5" : "gap-2 px-3 min-h-[44px]"}`}
        style={{ color: on ? C.brass : C.faint }}>
        <span className="relative">
          <Icon id={t.id} on={on} />
          {t.id === "inbox" && dot && <span aria-hidden className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: C.accent, boxShadow: `0 0 0 2px ${C.bg}` }} />}
        </span>
        <span className={`font-body uppercase ${where === "bottom" ? "text-[0.75rem] tracking-[0.14em]" : "text-[0.75rem] tracking-[0.18em]"}`}>{t.label}</span>
        {on && where === "bottom" && <span aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full" style={{ background: C.brass }} />}
      </Link>
    );
  };

  const panels: Record<TabId, ReactNode> = { home: <HomeTab />, menu: <MenuTab />, index: <IndexTab />, events: <EventsTab />, inbox: <InboxTab /> };
  return (
    <ShellContext.Provider value={api}>
      <Suspense fallback={null}><StepTracker tab={tab} /></Suspense>
      <div className="pp-app min-h-[100dvh]" style={{ background: C.bg, color: C.text, ["--pp-top" as string]: "calc(env(safe-area-inset-top) + 56px)" }}>
        <header className="fixed top-0 inset-x-0 z-40 border-b backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top)", background: "rgba(19,23,15,0.94)", borderColor: C.line }}>
          <div className="max-w-5xl mx-auto h-14 px-4 md:px-6 flex items-center justify-between gap-4">
            <Link href="/passport" scroll={false} onClick={(e) => onTab(e, "home")} className="flex items-center gap-2.5 pp-focus rounded-lg min-h-[44px] md:w-48" aria-label="Passport home">
              <PassportMark size={28} />
              <span className="font-body text-[0.75rem] tracking-[0.4em] uppercase" style={{ color: C.brass }}>Passport</span>
            </Link>
            <nav aria-label="Passport" className="hidden md:flex items-center gap-1">
              {TABS.map((t) => <span key={t.id}>{tabLink(t, "top")}</span>)}
            </nav>
            <div className="md:w-48 flex justify-end">
              <Link href="/passport/account" scroll={false} aria-label="Your account" aria-current={pathname.startsWith("/passport/account") ? "page" : undefined}
                className="w-11 h-11 rounded-full flex items-center justify-center pp-focus">
                <span className="w-9 h-9 rounded-full flex items-center justify-center border" style={{ borderColor: pathname.startsWith("/passport/account") ? C.brass : C.line }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={pathname.startsWith("/passport/account") ? C.brass : C.muted} strokeWidth="1.6" aria-hidden>
                    <circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main ref={mainRef} id="passport-main" className="pp-main w-full max-w-xl mx-auto px-5"
          style={{ paddingTop: "calc(var(--pp-top) + 24px)" }}>
          {TABS.map((t) => (visited.has(t.id) ? (
            <section key={t.id} hidden={t.id !== tab} aria-label={t.id === "home" ? "Home" : t.label}>{panels[t.id]}</section>
          ) : null))}
        </main>

        {/* Pages that open over a tab (and, for a tab's own address, nothing: the tab is drawn above). */}
        <div ref={overlayRef} className={pageShown ? "pp-overlay fixed inset-x-0 bottom-0 z-30 overflow-y-auto" : "hidden"}
          style={pageShown ? { top: 0, background: C.bg, paddingTop: "calc(var(--pp-top) + 20px)", ...(exiting ? { pointerEvents: "none" } : {}) } : undefined}
          aria-hidden={exiting || undefined}
          onScroll={(e) => { if (overlay) overlayScroll.current[pathname] = (e.target as HTMLDivElement).scrollTop; }}>
          <div className="pp-page w-full max-w-xl mx-auto px-5">{exiting ? lastPage.current : children}</div>
        </div>

        <nav aria-label="Passport tabs" className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t"
          style={{ background: "rgba(15,19,12,0.97)", borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <ul className="max-w-xl mx-auto grid grid-cols-5 items-end px-1">
            {TABS.map((t) => <li key={t.id} className="flex justify-center">{tabLink(t, "bottom")}</li>)}
          </ul>
        </nav>

        <div aria-live="polite" role="status" className="sr-only">{toastMsg?.text || ""}</div>
        {toastMsg && (
          <div key={toastMsg.n} aria-hidden className="pp-toast fixed left-1/2 z-[80] rounded-full px-5 py-3 font-body text-sm shadow-xl max-w-[90vw] text-center"
            style={{ transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 92px)", background: C.text, color: C.bg }}>
            {toastMsg.text}
          </div>
        )}
        {addTarget && <AddToList target={addTarget} onClose={closeAdd} toast={toast} cache={listsCache} />}
      </div>
    </ShellContext.Provider>
  );
}
