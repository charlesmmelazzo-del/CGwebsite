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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
