// npm run test:passport (third part) — file 16: Messages. The top tabs and their badges, the quick switcher, day
// separators and hidden messages, mentions, and the input checks before anything reaches the Bible.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MESSAGES_TABS, REACTIONS, ROOM_POLL_MS, LIST_POLL_MS, badgeText, chatLines, chatPostBody, chosenMessagesTab, dayLabel, groupBody, hiddenWords, insertMention, isSeat,
  mentionQuery, mentionsLeft, mergePosts, messagesBadges, messagesLit, proposalBody, switcherItems, type ChatOverview,
} from "../chat";
import { TABS } from "../shell";
import { PAGE_PARENTS, parentOf } from "../nav";
import { isTarget } from "../social";
import { LIMITS } from "../../rateLimit";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}
const ROOT = join(__dirname, "..", "..", "..");

const overview = (): ChatOverview => ({
  chats: [
    { kind: "bar", id: 1, name: "Common Good", subtitle: "Birthday", unread: 1, mentions: 0, last_at: "2026-11-25T18:00:00Z", preview: "x", pinned: true },
    { kind: "friend", id: 4, name: "Sam B.", unread: 0, mentions: 0, last_at: "2026-11-26T18:00:00Z", preview: "hi" },
    { kind: "group", id: 9, name: "Friday crew", unread: 3, mentions: 1, last_at: "2026-11-26T19:00:00Z", preview: "Sam: in", people: 4 },
  ],
  invitations: [{ id: 12, name: "Rye club", from_name: "Sam B.", people: 3, at: "2026-11-26T19:00:00Z" }],
  channels: [
    { id: 2, name: "Whiskey talk", description: "", covers: [], people: 40, joined: true, started_by: null, locked: false, bar_only: false, pinned: false, unread: 5, mentions: 0, muted: false, notify: "mentions", last_at: "2026-11-26T10:00:00Z" },
    { id: 3, name: "Tonight at CG", description: "", covers: [], people: 90, joined: true, started_by: null, locked: false, bar_only: true, pinned: true, unread: 2, mentions: 0, muted: true, notify: "mentions", last_at: "2026-11-26T11:00:00Z" },
  ],
  browse: [], proposals: [], can_start: "off", unread: { chats: 5, channels: 5, mentions: 1 }, limits: { body_max: 1000, group_max: 20, reactions: [...REACTIONS] },
});

(async () => {
  console.log("File 16: the tab and its top tabs");
  await test("the fifth bottom tab is Messages, still at /passport/inbox (old addresses keep working)", () => {
    assert.equal(TABS[4].label, "Messages");
    assert.equal(TABS[4].href, "/passport/inbox");
    assert.equal(parentOf("/passport/inbox/messages/4")!.label, "Messages");
  });
  await test("tabs across the top: Chats · Channels · Requests · Bottles · Friends; the last used is remembered", () => {
    assert.deepEqual(MESSAGES_TABS.map((t) => t.label), ["Chats", "Channels", "Requests", "Bottles", "Friends"]);
    assert.equal(chosenMessagesTab(null, null), "chats");
    assert.equal(chosenMessagesTab(null, "bottles"), "bottles");
    assert.equal(chosenMessagesTab("friends", "bottles"), "friends", "the address wins");
    assert.equal(chosenMessagesTab("nonsense", "nope"), "chats");
  });
  await test("each top tab has a badge when something waits; a muted channel adds nothing; the bottom dot follows", () => {
    const b = messagesBadges({ chat: overview(), requests: [{ question: true }, { unread: false }], inquiries: [{ unread: true }], bottles: [{ can_answer: true, status: "quoted" }, { can_answer: false, status: "ordered" }], friendRequests: 2 });
    assert.deepEqual(b, { chats: 3, channels: 1, requests: 2, bottles: 1, friends: 2 });
    assert.equal(messagesLit(b), true);
    assert.equal(messagesLit(messagesBadges({})), false);
    assert.equal(badgeText(12), "9+");
  });
  await test("the wording: 'Send a request' and 'Book an event'", () => {
    const inbox = readFileSync(join(ROOT, "components", "passport", "Inbox.tsx"), "utf8");
    assert.ok(inbox.includes('"Send a request"') && inbox.includes('"Book an event"'));
  });

  console.log("File 16: the quick switcher");
  await test("every chat and joined channel, unread first, filtered by any word", () => {
    const all = switcherItems(overview());
    assert.equal(all.length, 5);
    assert.deepEqual(all.slice(0, 3).map((i) => i.key).sort(), ["bar:1", "channel:2", "group:9"].sort(), "unread first (a muted channel's unread does not count)");
    assert.deepEqual(switcherItems(overview(), "fri").map((i) => i.name), ["Friday crew", "Sam B."]);
    assert.equal(switcherItems(overview(), "whiskey")[0].href, "/passport/inbox/channels/2");
    assert.deepEqual(switcherItems(null), []);
  });

  console.log("File 16: a conversation like a text-messaging app");
  await test("day separators, and runs of hidden messages collapsed into one line", () => {
    const now = new Date("2026-11-26T20:00:00Z");
    const lines = chatLines([{ id: 1, at: "2026-11-25T20:00:00Z" }, { id: 2, at: "2026-11-26T15:00:00Z", hidden: true }, { id: 3, at: "2026-11-26T15:01:00Z", hidden: true }, { id: 4, at: "2026-11-26T16:00:00Z" }], now);
    assert.deepEqual(lines.map((l) => (l.kind === "day" ? l.label : l.kind === "hidden" ? `h${l.count}` : `p${l.post.id}`)), ["Yesterday", "p1", "Today", "h2", "p4"]);
    assert.equal(hiddenWords(1), "1 hidden message");
    assert.equal(dayLabel("2026-11-20T18:00:00Z", now), "Friday");
  });
  await test("older messages arrive in front, a poll's newer ones at the end; never twice", () => {
    const m = mergePosts([{ id: 5 }, { id: 6 }], [{ id: 6 }, { id: 7 }]);
    assert.deepEqual(m.map((x) => x.id), [5, 6, 7]);
    assert.deepEqual(mergePosts([{ id: 5 }], [{ id: 2 }, { id: 3 }], { older: true }).map((x) => x.id), [2, 3, 5]);
  });
  await test("freshness: the open conversation every 5 seconds, the lists every 30, with room in the rate limit", () => {
    assert.equal(ROOM_POLL_MS, 5000);
    assert.equal(LIST_POLL_MS, 30000);
    assert.ok(LIMITS["passport-chat-read"].max >= 3600 / 5 + 120);
  });

  console.log("File 16 (review fix): the composer never sits under the tab bar");
  await test("above the tab bar and the safe area; directly on the keyboard when it is open", async () => {
    const X = await import("../chat");
    assert.equal(X.composerBottom(0), "calc(var(--pp-tabbar) + env(safe-area-inset-bottom))");
    assert.equal(X.composerBottom(40), "calc(var(--pp-tabbar) + env(safe-area-inset-bottom))", "a browser bar settling is not the keyboard");
    assert.equal(X.composerBottom(291.6), "292px");
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
    assert.ok(/--pp-tabbar: 57px/.test(css) && /min-width: 768px\) \{ \.pp-app \{ --pp-tabbar: 0px; \} \}/.test(css) && css.includes('html[data-pp-keyboard="open"] .pp-tabbar { display: none; }'));
    const shell = readFileSync(join(ROOT, "components", "passport", "AppShell.tsx"), "utf8");
    assert.ok(shell.includes('className="pp-tabbar md:hidden') && shell.includes('height: "calc(var(--pp-tabbar) - 1px)"'), "the tab bar is drawn at the same height");
    const chat = readFileSync(join(ROOT, "components", "passport", "Chat.tsx"), "utf8");
    assert.ok(chat.indexOf("data-pp-line") < chat.indexOf('id="pp-chat-compose"'), "who can read it sits above the box");
    assert.ok(chat.includes("paddingBottom: composerH + 12"), "the list leaves room for the composer");
  });

  console.log("File 16: mentions");
  await test("typing @ starts a mention; picking one puts the name in; only names still in the text are sent", () => {
    assert.equal(mentionQuery("hi @Sa", 6), "Sa");
    assert.equal(mentionQuery("email@x", 7), null, "an @ inside a word is not a mention");
    const out = insertMention("hi @Sa", 6, "Sam B.");
    assert.equal(out.text, "hi @Sam B. ");
    assert.deepEqual(mentionsLeft(out.text, [{ seat: "c4", name: "Sam B." }, { seat: "c5", name: "Ana K." }]), ["c4"]);
  });

  console.log("File 16: input checks (the Bible checks everything again)");
  await test("a message: plain text up to 1,000; only seats as mentions; only room shares", () => {
    assert.ok("error" in chatPostBody({ body: "" }));
    assert.ok("error" in chatPostBody({ body: "x".repeat(1001) }));
    const ok = chatPostBody({ body: "hi", mentions: ["c4", "1234", "member:9"], reply_to: "8", from_bar: true, user_id: 1 });
    assert.ok("body" in ok && ok.body.mentions.join() === "c4" && ok.body.reply_to === 8 && !("from_bar" in ok.body) && !("user_id" in ok.body));
    assert.ok("error" in chatPostBody({ body: "x", share: { kind: "recipe", id: 1 } }));
    assert.ok(isSeat("g12") && !isSeat("12") && !isSeat("x12"));
  });
  await test("a group: a name and 1 to 19 friends (2 to 20 people in all); a channel idea: a name and a line", () => {
    assert.ok("error" in groupBody({ name: "", friends: [1] }));
    assert.ok("error" in groupBody({ name: "Crew", friends: [] }));
    assert.ok("error" in groupBody({ name: "Crew", friends: Array.from({ length: 20 }, (_, i) => i + 1) }));
    assert.ok("body" in groupBody({ name: " Crew ", friends: [1, "2", 2] }));
    assert.ok("error" in proposalBody({ name: "x", description: "" }));
  });
  await test("block and report reach a message's writer or a room-mate, never a member number", () => {
    assert.ok(isTarget("chatpost:4") && isTarget("gseat:2") && isTarget("cseat:3") && !isTarget("member:4"));
  });

  console.log("File 16: pages");
  await test("every new page exists and has a way back", () => {
    const app = join(ROOT, "app", "passport", "(app)");
    for (const r of ["inbox/groups/[id]", "inbox/groups/new", "inbox/channels/[id]", "inbox/channels/new", "inbox/channels/[id]/threads/[key]"]) {
      assert.ok(existsSync(join(app, r, "page.tsx")), r);
      assert.ok(PAGE_PARENTS.some((p) => p.route === r), r);
    }
    const propose = readFileSync(join(app, "inbox", "channels", "new", "page.tsx"), "utf8");
    assert.ok(/can_start === "off"\) notFound\(\)/.test(propose), "with members' channels Off there is no way to propose one");
  });
  await test("where members write, the page says who can read it", () => {
    const rooms = readFileSync(join(ROOT, "lib", "passport", "chat.ts"), "utf8");
    assert.ok(rooms.includes("Everyone in this channel and the Common Good team can read this.") && rooms.includes("Private between the people in this group."));
  });

  console.log("File 16, Part 8: the home screen and notifications pop-up");
  const W = await import("../welcomePrompt");
  const base = { homeRendered: true, sinceVisit: 5000, installed: false, push: "off" as const, ios: false, now: 1_800_000_000_000, lastShown: null, snoozed: null };
  await test("the first visit after signing in: it shows, once Home has rendered, never in the visit's first second", () => {
    assert.equal(W.welcomePlan(base).show, true);
    assert.equal(W.welcomePlan({ ...base, homeRendered: false }).show, false, "not over a loading screen");
    assert.equal(W.welcomePlan({ ...base, sinceVisit: 600 }).show, false, "never in the first second");
  });
  await test("at most once a day; after Not now, not for 30 days", () => {
    assert.equal(W.welcomePlan({ ...base, lastShown: base.now - 3 * 3600_000 }).show, false);
    assert.equal(W.welcomePlan({ ...base, lastShown: base.now - 25 * 3600_000 }).show, true);
    assert.equal(W.welcomePlan({ ...base, lastShown: base.now - 3 * W.DAY_MS, snoozed: base.now - 29 * W.DAY_MS }).show, false);
    assert.equal(W.welcomePlan({ ...base, lastShown: base.now - 31 * W.DAY_MS, snoozed: base.now - 31 * W.DAY_MS }).show, true);
  });
  await test("never once installed and notifications on", () => {
    assert.equal(W.welcomePlan({ ...base, installed: true, push: "on" }).show, false);
  });
  await test("only the missing steps: install then notifications; iPhone Safari gets the install step only", () => {
    assert.deepEqual(W.welcomePlan(base).steps, ["install", "notify"], "Android or desktop Chrome, not installed");
    assert.deepEqual(W.welcomePlan({ ...base, installed: true }).steps, ["notify"]);
    assert.deepEqual(W.welcomePlan({ ...base, push: "on" }).steps, ["install"]);
    assert.deepEqual(W.welcomePlan({ ...base, ios: true, push: "needs-install" }).steps, ["install"], "iPhone in Safari: notifications come after adding");
    assert.equal(W.iosInstallNote({ installed: false, ios: true, push: "needs-install" }), true);
    assert.deepEqual(W.welcomePlan({ ...base, ios: true, installed: true }).steps, ["notify"], "iPhone, opened from the home screen");
    assert.equal(W.welcomePlan({ ...base, installed: true, push: "blocked" }).show, false, "nothing it can do: nothing shows");
  });
  await test("no card in the page any more: Home has only the pop-up; the old cards are gone", () => {
    const home = readFileSync(join(ROOT, "components", "passport", "tabs", "HomeTab.tsx"), "utf8");
    assert.ok(home.includes("<WelcomePopup />") && !/InstallHint|PushPrompt/.test(home));
    assert.ok(!existsSync(join(ROOT, "components", "passport", "InstallHint.tsx")) && !existsSync(join(ROOT, "components", "passport", "PushPrompt.tsx")));
    const sheet = readFileSync(join(ROOT, "components", "passport", "WelcomeSheet.tsx"), "utf8");
    assert.ok(sheet.includes('role="dialog" aria-modal="true"') && sheet.includes('e.key === "Escape"') && sheet.includes("Not now") && sheet.includes('style.overflow = "hidden"') && sheet.includes("reducedMotion()"), "a proper dialog");
    assert.ok(readFileSync(join(ROOT, "components", "passport", "Account.tsx"), "utf8").includes("Add Passport to your home screen"));
  });

  console.log("File 16, Part 10: the home-screen icon, a small passport");
  await test("the manifest lists the booklet icons (any and maskable); name and short name stay", async () => {
    const route = await import("../../../app/passport/manifest.webmanifest/route");
    const m = JSON.parse(await route.GET().text());
    assert.equal(m.name, "Common Good Passport");
    assert.equal(m.short_name, "Passport");
    const by = (p: string) => m.icons.filter((i: { purpose: string }) => i.purpose === p).map((i: { src: string; sizes: string }) => `${i.src} ${i.sizes}`);
    assert.deepEqual(by("any"), ["/passport/icons/icon-192.png 192x192", "/passport/icons/icon-512.png 512x512"]);
    assert.deepEqual(by("maskable"), ["/passport/icons/icon-maskable-512.png 512x512"]);
    const pub = join(ROOT, "..", "public", "passport", "icons");
    for (const f of ["icon.svg", "icon-maskable.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) assert.ok(existsSync(join(pub, f)), f);
    const png = readFileSync(join(pub, "apple-touch-icon.png"));
    assert.equal(png.readUInt32BE(16), 180, "180 wide");
    assert.equal(png[25], 2, "colour type 2: RGB, no transparency (iOS rounds the corners itself)");
  });
  await test("the cover carries the real Common Good logo (made by scripts/passport-icon.mjs), not the placeholder CG ring", () => {
    const pub = join(ROOT, "..", "public", "passport", "icons");
    const scripts = join(ROOT, "..", "scripts");
    assert.ok(existsSync(join(scripts, "passport-icon.mjs")) && existsSync(join(scripts, "passport-icon", "cg-logo-hand.png")));
    for (const f of ["icon.svg", "icon-maskable.svg"]) {
      const svg = readFileSync(join(pub, f), "utf8");
      assert.ok(!svg.includes("<circle"), `${f}: no placeholder ring`);
      assert.ok(svg.includes('xlink:href="data:image/png;base64,'), `${f}: the logo is embedded, never fetched`);
    }
    for (const [f, w] of [["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512]] as const) {
      const png = readFileSync(join(pub, f));
      assert.equal(png.readUInt32BE(16), w, `${f} width`);
      assert.equal(png[25], 2, `${f}: opaque RGB`);
    }
  });
  await test("the apple-touch-icon is on Passport pages only, never the public site's own pages", () => {
    const pl = readFileSync(join(ROOT, "app", "passport", "layout.tsx"), "utf8");
    assert.ok(pl.includes('apple: [{ url: "/passport/icons/apple-touch-icon.png"'));
    const root = readFileSync(join(ROOT, "app", "layout.tsx"), "utf8");
    assert.ok(!root.includes("/passport/icons") && !root.includes("passport/apple-touch-icon"));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
