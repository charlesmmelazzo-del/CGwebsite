// npm run test:passport — the Menu tab's description layout, its cocktail cards, the "a tap is never lost" save queue,
// (file 05) what a bottle request may send to the Bible, and (file 06) the new shell: tabs, old addresses, search,
// the available-now marker, the Inbox dot and reservations; (file 11) photos.

import assert from "node:assert/strict";
import { bareFlavor, descriptionParts, menuItemBody } from "../description";
import { createSaveQueue, type SaveResult } from "../saveQueue";
import { isAction, money, quantity, requestBody, sortRequests, NO_PRICE_LINE } from "../bottles";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OLD_ADDRESSES, TABS, byCategory, dayLong, homeTabOf, inboxDot, isAvailable, needsMember, partyOf, reservationWord, resultCount, searchable,
  tabOfPath, withSpirit,
} from "../shell";
import { LIMITS } from "../../rateLimit";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

type Mine = { favorite: boolean; rating: number | null; note: string };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A fake server: each save waits until the test lets it answer. */
function slowServer() {
  const state: Mine = { favorite: false, rating: null, note: "" };
  const calls: { body: Partial<Mine>; answer: (fail?: string) => void }[] = [];
  const send = (body: Partial<Mine>) => () => new Promise<SaveResult<Mine>>((resolve) => {
    calls.push({ body, answer: (fail) => {
      if (fail === "signed_out") return resolve({ ok: false, signedOut: true });
      if (fail) return resolve({ ok: false, error: fail });
      Object.assign(state, body);
      resolve({ ok: true, state: { ...state } });
    } });
  });
  return { state, calls, send };
}

(async () => {
  console.log("Menu descriptions");
  const blob = "Raking can wait. This pile has excellent lumbar support.\n\n[Toasty, Green-Aromatic, Silky]\n\nBrovo Gin, Kota Pandan Liqueur, Milk Clarified\n\nFall doesn't always need baking spice. Long notes here.";
  await test("each line is its own paragraph and the [...] line is the flavor line without brackets", () => {
    assert.deepEqual(descriptionParts(blob), [
      { kind: "text", text: "Raking can wait. This pile has excellent lumbar support." },
      { kind: "flavor", text: "Toasty, Green-Aromatic, Silky" },
      { kind: "text", text: "Brovo Gin, Kota Pandan Liqueur, Milk Clarified" },
      { kind: "text", text: "Fall doesn't always need baking spice. Long notes here." },
    ]);
  });
  await test("Windows line breaks and single line breaks work too", () => {
    assert.deepEqual(descriptionParts("A\r\n[Bright]\r\nB").map((p) => p.kind), ["text", "flavor", "text"]);
  });
  await test("brackets inside a sentence are not a flavor line", () => {
    assert.deepEqual(descriptionParts("Gin [house infused], Lime\n\nNotes"), [
      { kind: "text", text: "Gin [house infused], Lime" }, { kind: "text", text: "Notes" },
    ]);
  });
  await test("a description that lost its line breaks is split around its one flavor list", () => {
    assert.deepEqual(descriptionParts("Raking can wait. [Toasty, Silky] Brovo Gin, Lime").map((p) => p.kind), ["text", "flavor", "text"]);
  });
  await test("… but not a one-line description with brackets inside an ingredient list", () => {
    assert.deepEqual(descriptionParts("Gin [house infused], Lime"), [{ kind: "text", text: "Gin [house infused], Lime" }]);
  });
  await test("a plain one-line description stays one paragraph; empty gives nothing", () => {
    assert.deepEqual(descriptionParts("A lovely pour"), [{ kind: "text", text: "A lovely pour" }]);
    assert.deepEqual(descriptionParts("  \n "), []);
  });
  await test("a library flavor line stored with brackets is shown without them", () => {
    assert.equal(bareFlavor("[Bright, Bitter]"), "Bright, Bitter");
    assert.equal(bareFlavor("Bright, Bitter"), "Bright, Bitter");
  });

  console.log("Menu items and their cocktail cards");
  // As the Bible sends them: three Toast variants that all open the library cocktail "Pear Thee Well", and only an
  // item with the cocktail's own name carries its card.
  const pear = { tagline: "Pear tagline", ingredients: "Bourbon, Red Pear, Lemon, Cinnamon", flavor: "[Spiced, Bright]" };
  const free = { name: "Pear Thee Well - Free Spirited", description: "Red Pear, Lemon, Soda\n\n[Bright, Crisp]\n\nNo alcohol, all the fall.", cocktail_id: 7 };
  const bourbon = { name: "Pear Thee Well - Boozy With Bourbon", description: "Bourbon, Red Pear, Lemon", cocktail_id: 7 };
  const tequila = { name: "Pear Thee Well - Boozy With Tequila", description: "Tequila, Red Pear, Lemon", cocktail_id: 7 };
  await test("Pear Thee Well - Free Spirited shows its own description, by line, and never bourbon", () => {
    const b = menuItemBody(free);
    assert.equal(b.kind, "description");
    assert.deepEqual(b.kind === "description" ? b.parts : [], [
      { kind: "text", text: "Red Pear, Lemon, Soda" }, { kind: "flavor", text: "Bright, Crisp" }, { kind: "text", text: "No alcohol, all the fall." },
    ]);
    assert.ok(!/bourbon/i.test(JSON.stringify(b)));
  });
  await test("… the Boozy With Bourbon and Boozy With Tequila variants show their own descriptions", () => {
    assert.deepEqual(menuItemBody(bourbon), { kind: "description", parts: [{ kind: "text", text: "Bourbon, Red Pear, Lemon" }] });
    const t = menuItemBody(tequila);
    assert.deepEqual(t, { kind: "description", parts: [{ kind: "text", text: "Tequila, Red Pear, Lemon" }] });
    assert.ok(!/bourbon/i.test(JSON.stringify(t)));
  });
  await test("an item with the cocktail's own name shows the card the Bible sent (flavor without brackets)", () => {
    assert.deepEqual(menuItemBody({ name: "Pear Thee Well", description: "Toast text", card: pear }), { kind: "card", tagline: "Pear tagline", ingredients: "Bourbon, Red Pear, Lemon, Cinnamon", flavor: "Spiced, Bright" });
  });
  await test("an empty card falls back to the description; nothing at all shows nothing", () => {
    assert.equal(menuItemBody({ description: "Just this", card: { tagline: "", ingredients: "", flavor: "" } }).kind, "description");
    assert.equal(menuItemBody({ description: "" }).kind, "none");
  });

  console.log("A tap is never lost");
  await test("heart then a star straight away: both show at once, both are saved, in order", async () => {
    const s = slowServer();
    const views: Mine[] = [];
    const q = createSaveQueue<Mine>({ ...s.state }, { view: (v) => views.push(v), error: () => {}, signedOut: () => {} });
    const a = q.push({ patch: { favorite: true }, what: "your favorite", send: s.send({ favorite: true }) });
    const b = q.push({ patch: { rating: 4 }, what: "your rating", send: s.send({ rating: 4 }) });
    assert.deepEqual(q.current(), { favorite: true, rating: 4, note: "" }, "both taps show before any answer");
    await tick();
    assert.equal(s.calls.length, 1, "one save at a time");
    s.calls[0].answer();
    await tick();
    assert.equal(s.calls.length, 2, "the star is sent after the heart is saved");
    assert.deepEqual(s.calls[1].body, { rating: 4 });
    assert.deepEqual(q.current(), { favorite: true, rating: 4, note: "" }, "the star still shows while it is saving");
    s.calls[1].answer();
    assert.equal(await a, true);
    assert.equal(await b, true);
    assert.deepEqual(s.state, { favorite: true, rating: 4, note: "" }, "the server has both");
    assert.deepEqual(views[views.length - 1], s.state, "the screen settles on what the server saved");
  });
  await test("heart, star, note and another star in a burst: every one is saved, the last star wins", async () => {
    const s = slowServer();
    const q = createSaveQueue<Mine>({ ...s.state }, { view: () => {}, error: () => {}, signedOut: () => {} });
    const all = [
      q.push({ patch: { favorite: true }, what: "f", send: s.send({ favorite: true }) }),
      q.push({ patch: { rating: 2 }, what: "r", send: s.send({ rating: 2 }) }),
      q.push({ patch: { note: "Lovely" }, what: "n", send: s.send({ note: "Lovely" }) }),
      q.push({ patch: { rating: 5 }, what: "r", send: s.send({ rating: 5 }) }),
    ];
    for (let i = 0; i < 4; i++) { await tick(); s.calls[i].answer(); }
    assert.deepEqual(await Promise.all(all), [true, true, true, true]);
    assert.deepEqual(s.state, { favorite: true, rating: 5, note: "Lovely" });
    assert.deepEqual(q.current(), s.state);
    assert.equal(q.pending(), 0);
  });
  await test("a failed save shows a plain message, the screen settles on what the server has, later taps still go through", async () => {
    const s = slowServer();
    const errors: string[] = [];
    const q = createSaveQueue<Mine>({ ...s.state }, { view: () => {}, error: (m) => errors.push(m), signedOut: () => {} });
    const a = q.push({ patch: { favorite: true }, what: "your favorite", send: s.send({ favorite: true }) });
    const b = q.push({ patch: { rating: 3 }, what: "your rating", send: s.send({ rating: 3 }) });
    await tick();
    s.calls[0].answer("Something went wrong. Please try again.");
    await tick();
    assert.deepEqual(q.current(), { favorite: false, rating: 3, note: "" }, "the failed heart is undone; the waiting star still shows");
    s.calls[1].answer();
    assert.equal(await a, false);
    assert.equal(await b, true);
    assert.deepEqual(errors, ["Couldn't save your favorite. Something went wrong. Please try again."]);
    assert.deepEqual(q.current(), { favorite: false, rating: 3, note: "" });
    assert.deepEqual(q.current(), s.state);
  });
  await test("a network error (send throws) is a failed save, not a stuck queue", async () => {
    const q = createSaveQueue<Mine>({ favorite: false, rating: null, note: "" }, { view: () => {}, error: () => {}, signedOut: () => {} });
    assert.equal(await q.push({ patch: { rating: 1 }, what: "your rating", send: () => Promise.reject(new Error("offline")) }), false);
    assert.equal(await q.push({ patch: { rating: 2 }, what: "your rating", send: async () => ({ ok: true, state: null }) }), true);
    assert.deepEqual(q.current(), { favorite: false, rating: 2, note: "" });
  });
  await test("signed out: the waiting taps are dropped and the page is asked to refresh", async () => {
    const s = slowServer();
    let out = 0;
    const q = createSaveQueue<Mine>({ ...s.state }, { view: () => {}, error: () => {}, signedOut: () => { out++; } });
    const a = q.push({ patch: { favorite: true }, what: "f", send: s.send({ favorite: true }) });
    const b = q.push({ patch: { rating: 3 }, what: "r", send: s.send({ rating: 3 }) });
    await tick();
    s.calls[0].answer("signed_out");
    assert.deepEqual([await a, await b], [false, false]);
    assert.equal(out, 1);
    assert.equal(s.calls.length, 1);
    assert.deepEqual(q.current(), { favorite: false, rating: null, note: "" });
  });

  console.log("\nBottle requests (file 05)");
  await test("a quantity is a whole number from 1 to 12", () => {
    assert.deepEqual([1, 12, "3", " 7 "].map(quantity), [1, 12, 3, 7]);
    for (const bad of [0, 13, -1, 2.5, "two", "", null, undefined, "1e1", "012"]) assert.equal(quantity(bad), null, String(bad));
  });
  await test("from a bottle page: only the bottle, quantity and note go to the Bible", () => {
    assert.deepEqual(requestBody({ bottle_id: 5, quantity: 2, note: "gift" }), { body: { bottle_id: 5, quantity: 2, note: "gift" } });
  });
  await test("a price, status, date, cost or member number sent by the browser never reaches the Bible", () => {
    const r = requestBody({ bottle_id: "5", quantity: 1, note: "", price_cents: 1, total_cents: 1, status: "ready", eta: "2026-12-01", member_id: 99, cost_cents: 1, quote: { price_cents: 1 } });
    assert.ok("body" in r);
    assert.deepEqual(Object.keys(r.body).sort(), ["bottle_id", "note", "quantity"]);
  });
  await test("something the bar doesn't carry: a name, quantity and note", () => {
    assert.deepEqual(requestBody({ name: "  Kentucky   Owl  Rye ", quantity: 1 }), { body: { name: "Kentucky Owl Rye", quantity: 1, note: "" } });
    assert.ok("error" in requestBody({ name: "  ", quantity: 1 }));
    assert.ok("error" in requestBody({ name: "x".repeat(121), quantity: 1 }));
  });
  await test("a bad bottle number or quantity is stopped before it leaves the website", () => {
    assert.deepEqual(requestBody({ bottle_id: "abc", quantity: 1 }), { error: "Not found" });
    assert.deepEqual(requestBody({ bottle_id: -3, quantity: 1 }), { error: "Not found" });
    assert.ok("error" in requestBody({ bottle_id: 5, quantity: 13 }));
    assert.ok("error" in requestBody({ bottle_id: 5, quantity: 0 }));
    assert.ok("error" in requestBody({ bottle_id: 5, quantity: 1, note: "n".repeat(501) }));
  });
  await test("a member can only accept, decline or cancel", () => {
    assert.deepEqual(["accept", "decline", "cancel"].map(isAction), [true, true, true]);
    for (const bad of ["picked_up", "ready", "quote", "order", "", null, 1]) assert.equal(isAction(bad), false, String(bad));
  });
  await test("prices are whole cents shown as dollars", () => {
    assert.deepEqual([money(5200), money(5199), money(10400), money(5)], ["$52", "$51.99", "$104", "$0.05"]);
  });
  await test("the no-price promise is worded as the file says", () => {
    assert.equal(NO_PRICE_LINE, "We'll send you a price before anything is ordered.");
  });
  await test("open requests first, newest first; closed ones after", () => {
    const list = [{ id: 1, status: "picked_up" }, { id: 2, status: "ready" }, { id: 3, status: "cancelled" }, { id: 4, status: "submitted" }];
    assert.deepEqual(sortRequests(list).map((x) => x.id), [4, 2, 3, 1]);
  });
  await test("every bottle route acts only for the signed-in member (memberRequest), never by a member number", () => {
    const root = join(__dirname, "..", "..", "..", "app", "api", "passport", "bottles");
    for (const f of [join(root, "route.ts"), join(root, "[id]", "route.ts")]) {
      const src = readFileSync(f, "utf8");
      assert.ok(src.includes("memberRequest(req, \"passport-bottles\""), f);
      assert.ok(!/member_id|memberId/.test(src), `${f} must not take a member number`);
    }
  });


  console.log("\nThe new shell (file 06)");
  const APP = join(__dirname, "..", "..", "..", "app");
  const pageOf = (path: string) => {
    const rel = path.replace(/^\/passport\/?/, "");
    for (const base of [join(APP, "passport", "(app)"), join(APP, "passport")]) {
      for (const f of ["page.tsx", "route.ts"]) {
        const file = join(base, rel, f);
        if (existsSync(file)) return file;
      }
    }
    // A one-word address with no folder of its own is answered by the old-tab route ([tab]).
    return /^\/passport\/[a-z-]+$/.test(path) ? join(APP, "passport", "(app)", "[tab]", "page.tsx") : null;
  };
  await test("five tabs, left to right: Menu, Index, CG (Home), Events, Inbox", () => {
    assert.deepEqual(TABS.map((t) => t.label), ["Menu", "Index", "Home", "Events", "Inbox"]);
    assert.equal(TABS[2].href, "/passport", "the centre button is Home");
  });
  await test("a tab's own address is that tab; anything else opens over a tab", () => {
    assert.equal(tabOfPath("/passport"), "home");
    assert.equal(tabOfPath("/passport/menu"), "menu");
    assert.equal(tabOfPath("/passport/library"), "index");
    assert.equal(tabOfPath("/passport/library/"), "index");
    assert.equal(tabOfPath("/passport/events"), "events");
    assert.equal(tabOfPath("/passport/inbox"), "inbox");
    for (const p of ["/passport/library/12", "/passport/spirits/4", "/passport/producers/2", "/passport/lists/9", "/passport/favorites", "/passport/account", "/passport/menus"]) {
      assert.equal(tabOfPath(p), null, p);
    }
  });
  await test("a page opened straight from a link sits over the tab it belongs to", () => {
    assert.equal(homeTabOf("/passport/library/12"), "index");
    assert.equal(homeTabOf("/passport/favorites"), "index");
    assert.equal(homeTabOf("/passport/account"), "home");
  });
  await test("every old Passport address still has a page, and each move redirects to its new home", () => {
    for (const a of OLD_ADDRESSES) {
      const file = pageOf(a.path);
      assert.ok(file, `${a.path} has no page any more`);
      const src = readFileSync(file!, "utf8");
      if (a.goes === "same") assert.ok(!/\bredirect\(/.test(src) || /tabPage|redirect\("\/passport"\)|redirect\("\/passport\?/.test(src) || a.path === "/passport/set-password", `${a.path} should still open its own screen`);
      else assert.ok(src.includes(`redirect("${a.goes}")`) || src.includes(`"${a.goes}"`), `${a.path} should redirect to ${a.goes}`);
    }
    const tab = readFileSync(pageOf("/passport/[tab]")!, "utf8");
    assert.ok(tab.includes('messages: "/passport/inbox"') && tab.includes("notFound()"), "the old Messages tab goes to the Inbox; any other unknown tab is not found");
  });
  await test("the new tab addresses exist and only check the sign-in cookie (no call to the Bible, so tabs open instantly)", () => {
    for (const path of ["/passport/events", "/passport/inbox", "/passport/menu", "/passport/library"]) {
      const src = readFileSync(pageOf(path)!, "utf8");
      assert.ok(src.includes("tabPage()") && !src.includes("@/lib/passport/bible"), path);
    }
    const tp = readFileSync(join(__dirname, "..", "tabPage.ts"), "utf8");
    assert.ok(tp.includes('if (!currentAuth()) redirect("/passport")'), "a tab address with no Passport cookie goes to sign-in");
  });
  await test("search, each tab's data and the lists for the sheet are members only and rate limited", () => {
    const api = join(APP, "api", "passport");
    const find = readFileSync(join(api, "find", "route.ts"), "utf8");
    assert.ok(find.includes('memberRequest(req, "passport-search"'), "search goes through memberRequest with its own bucket");
    assert.ok(LIMITS["passport-search"] && LIMITS["passport-search"].max > 0);
    const view = readFileSync(join(api, "view", "[view]", "route.ts"), "utf8");
    assert.ok(view.includes('memberRequest(req, "passport-member"'), "tab data goes through memberRequest");
    const lists = readFileSync(join(api, "lists", "route.ts"), "utf8");
    assert.ok(/export async function GET[\s\S]*?memberRequest\(req, "passport-member"/.test(lists));
    for (const src of [find, view]) assert.ok(!/member_id|memberId|searchParams.get\("member/.test(src), "never a member number from the browser");
  });
  await test("Home sends the browser only the first name of the member's own record (and whether to ask for a phone)", () => {
    const view = readFileSync(join(APP, "api", "passport", "view", "[view]", "route.ts"), "utf8");
    assert.ok(view.includes("first_name: me.member.first_name") && view.includes("needs_phone: me.member.needs_phone"));
    assert.ok(!/\.\.\.me\b|me\.member\.(email|phone|last_name)/.test(view), "no email, phone or full record on Home");
  });
  await test("search needs two letters before anything is sent", () => {
    assert.deepEqual(["", " ", "a", " b ", "rye", "ab"].map(searchable), [false, false, false, false, true, true]);
    assert.equal(resultCount({ cocktails: [1, 2], bottles: [3], producers: [] }), 3);
    assert.equal(resultCount(null), 0);
  });
  await test("available now is a marker on the item, true only when the Bible says so", () => {
    assert.equal(isAvailable({ available: true }), true);
    assert.equal(isAvailable({ available: false }), false);
    assert.equal(isAvailable(null), false);
    const card = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "Library.tsx"), "utf8");
    assert.ok(card.includes("<Avail on={c.available} />") && card.includes("<Avail on={b.available} />"), "cocktail and bottle rows carry the marker");
    const bits = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "bits.tsx"), "utf8");
    assert.ok(/function Avail[\s\S]*?if \(!on\) return null;[\s\S]*?rounded-full[\s\S]*?Available now/.test(bits), "a small dot with words for screen readers, nothing when not available");
  });
  await test("the Index's base-spirit filter answers from the keys on each cocktail", () => {
    const cs = [{ id: 1, spirits: ["bourbon"] }, { id: 2, spirits: ["gin", "bourbon"] }, { id: 3, spirits: [] }, { id: 4 }] as never[];
    assert.deepEqual(withSpirit(cs, "bourbon").map((c: { id: number }) => c.id), [1, 2]);
    assert.deepEqual(withSpirit(cs, "").map((c: { id: number }) => c.id), [1, 2, 3, 4]);
  });
  await test("spirits group by category in the order the Bible sent (the spirits list's own order)", () => {
    const g = byCategory([{ category: "Rum", n: 1 }, { category: "Gin", n: 2 }, { category: "Rum", n: 3 }, { category: "", n: 4 }]);
    assert.deepEqual(g.map((x) => [x.name, x.items.length]), [["Rum", 2], ["Gin", 1], ["Other", 1]]);
  });
  await test("the Inbox dot: a price waiting for an answer, or a bottle ready for pickup", () => {
    assert.equal(inboxDot([{ can_answer: false, status: "ordered" }, { can_answer: false, status: "submitted" }]), false);
    assert.equal(inboxDot([{ can_answer: true, status: "quoted" }]), true);
    assert.equal(inboxDot([{ can_answer: false, status: "ready" }]), true);
    assert.equal(inboxDot([{ can_answer: false, status: "quoted" }]), false, "an expired price needs nothing from them");
    assert.equal(inboxDot(null), false);
    assert.equal(needsMember({ can_answer: false, status: "picked_up" }), false);
  });
  await test("reservations read in the member's words", () => {
    assert.deepEqual(["requested", "approved", "guest_confirmed"].map(reservationWord), ["Request received", "Booked", "Confirmed"]);
    assert.equal(dayLong("2026-12-04"), "Friday, December 4");
    assert.deepEqual([partyOf(1), partyOf(4)], ["Just you", "Party of 4"]);
  });
  await test("the recipe book is called My Cocktails, sits in the Index under Journal (file 15: was Yours) with Add a cocktail, and never in the Menu", () => {
    const comp = (f: string) => readFileSync(join(__dirname, "..", "..", "..", "components", "passport", f), "utf8");
    // File 14: the Index is a drill-down; My Cocktails is a tile under Index › Yours (lib/passport/nav.ts), and the Yours
    // level keeps "+ Add a cocktail". (Updated from the flat Index's card, which this file replaced.)
    const index = comp("tabs/IndexTab.tsx");
    const nav = readFileSync(join(__dirname, "..", "nav.ts"), "utf8");
    assert.ok(nav.includes('label: "My Cocktails"') && nav.includes('href: "/passport/bespoke"') && index.includes('href="/passport/bespoke?new=1"') && index.includes("+ Add a cocktail"));
    assert.ok(!/bespoke|My Cocktails/i.test(comp("tabs/MenuTab.tsx")), "not on the Menu tab");
    const page = readFileSync(pageOf("/passport/bespoke")!, "utf8");
    assert.ok(page.includes('title="My Cocktails"'));
    const all = [index, nav, comp("Personal.tsx"), page].join("\n");
    assert.ok(!/Bespoke (recipes|cocktails)/.test(all.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "the old label is shown nowhere");
  });
  await test("places for later files draw nothing until they have something (no empty boxes, no 'coming soon')", () => {
    const slots = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "tabs", "Slots.tsx"), "utf8");
    assert.ok(/function FromTheBar[\s\S]*?if \(!messages\?\.length\) return null;/.test(slots));
    assert.ok(/function WhatsNew[\s\S]*?if \(!cards\?\.length\) return null;/.test(slots));
    // File 07 fills Spirit of the Day and the Index's house lists: each still draws nothing until it has something.
    assert.ok(/function SpiritOfTheDay[\s\S]*?if \(!spirit\) return null;/.test(slots), "SpiritOfTheDay");
    // (file 10 adds open votes and the way to Past votes: it still draws nothing while all five are empty)
    assert.ok(/function HouseLists[\s\S]*?if \(!lists\?\.length && !charts\?\.length && !pastCount && !votes\?\.length && !pastVotes\) return null;/.test(slots), "HouseLists");
    // File 09 fills "Shared with you" and the two round buttons (components/passport/Social.tsx): still nothing until they have something.
    const social = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "Social.tsx"), "utf8");
    assert.ok(/export \{ HereButtons, SharedWithYou \} from "\.\.\/Social";/.test(slots), "the slots point at file 09's sections");
    assert.ok(/function SharedWithYou[\s\S]*?if \(!shown\.length\) return null;/.test(social), "SharedWithYou");
    assert.ok(/function HereButtons[\s\S]*?if \(!p\) return null;/.test(social), "HereButtons");
    const all = ["AppShell.tsx", "tabs/HomeTab.tsx", "tabs/MenuTab.tsx", "tabs/IndexTab.tsx", "tabs/EventsTab.tsx", "tabs/InboxTab.tsx", "tabs/Slots.tsx"]
      .map((f) => readFileSync(join(__dirname, "..", "..", "..", "components", "passport", f), "utf8")).join("\n");
    assert.ok(!/coming soon/i.test(all), "no 'coming soon' anywhere in the new shell");
  });

  console.log("File 07: From the bar (Home sections, the Index's house lists, list pages)");
  {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    // The components are compiled here without Next's JSX setup, so React must be in scope for them.
    (globalThis as { React?: unknown }).React = React;
    const S = await import("../../../components/passport/tabs/Slots");
    const B = await import("../bar");
    const html = (el: unknown) => renderToStaticMarkup(el as never);
    const msg = { id: 7, title: "A new list", body: "Five for winter.", link_kind: "list" as const, link_id: 12, link_label: "Top 5 for winter", posted_at: "2026-11-25" };
    const card = { key: "list:12", kind: "list", title: "Top 5 for winter", link_kind: "list", link_id: 12, at: "2026-11-25" };
    const list = { id: 12, title: "Rye flight", intro: "Three pours.", kind: "bottle" as const, ranked: false, by: "Sam", staff_pick: true, price: 28, count: 3, past: false };
    await test("every new Home section draws nothing when empty (no empty boxes)", () => {
      for (const [name, el] of [
        ["From the bar", React.createElement(S.FromTheBar, { messages: [] })], ["From the bar (none sent)", React.createElement(S.FromTheBar, {})],
        ["What's new", React.createElement(S.WhatsNew, { cards: [] })], ["Spirit of the Day", React.createElement(S.SpiritOfTheDay, { spirit: null })],
        ["Welcome Aperitif", React.createElement(S.WelcomeAperitif, { aperitif: null })], ["Welcome Aperitif (blank name)", React.createElement(S.WelcomeAperitif, { aperitif: { name: "", description: "x" } })],
        ["Newest list", React.createElement(S.NewestList, { list: null })], ["CG Picks", React.createElement(S.HouseLists, { lists: [], charts: [], pastCount: 0 })],
      ] as const) assert.equal(html(el), "", name);
    });
    await test("… and shows when filled", () => {
      const m = html(React.createElement(S.FromTheBar, { messages: [msg] }));
      assert.ok(m.includes("From the bar") && m.includes("Five for winter.") && m.includes('href="/passport/house/12"') && m.includes("Dismiss A new list"), m);
      const w = html(React.createElement(S.WhatsNew, { cards: [card] }));
      assert.ok(w.includes("What&#x27;s new") || w.includes("What’s new"), w);
      assert.ok(w.includes("A new list") && w.includes('href="/passport/house/12"') && w.includes("Dismiss Top 5 for winter"), w);
      const sp = html(React.createElement(S.SpiritOfTheDay, { spirit: { id: 4, name: "Rittenhouse Rye", category: "Rye", discount_pct: 10 } }));
      assert.ok(sp.includes("Spirit of the Day") && sp.includes('href="/passport/spirits/4"') && sp.includes("10% off for members today"), sp);
      const sp0 = html(React.createElement(S.SpiritOfTheDay, { spirit: { id: 4, name: "Rittenhouse Rye", category: "Rye", discount_pct: null } }));
      assert.ok(sp0.includes("Rittenhouse Rye") && !sp0.includes("% off"), "at 0% there is no discount line");
      const ap = html(React.createElement(S.WelcomeAperitif, { aperitif: { name: "Amaro spritz", description: "On us." } }));
      assert.ok(ap.includes("Welcome Aperitif") && ap.includes("Amaro spritz") && ap.includes("On us."), ap);
      const nl = html(React.createElement(S.NewestList, { list }));
      assert.ok(nl.includes("Rye flight") && nl.includes("Staff pick · by Sam") && nl.includes("Flight · $28"), nl);
      const hl = html(React.createElement(S.HouseLists, { lists: [list], charts: [{ key: "top", title: "Top of the Charts", season_name: "Winter 2026", items: [] }], pastCount: 2 }));
      // File 15: "From Common Good" is now "CG Picks" (updated from file 07's wording).
      assert.ok(hl.includes("CG Picks") && hl.includes('href="/passport/house/charts/top"') && hl.includes("Past lists") && hl.includes('href="/passport/house/past"'), hl);
    });
    await test("links from the bar only ever open pages inside Passport", () => {
      assert.equal(B.messageHref({ link_kind: "list", link_id: 3 }), "/passport/house/3");
      assert.equal(B.messageHref({ link_kind: "cocktail", link_id: 3 }), "/passport/library/3");
      assert.equal(B.messageHref({ link_kind: "bottle", link_id: 3 }), "/passport/spirits/3");
      assert.equal(B.messageHref({ link_kind: "events", link_id: null }), "/passport/events");
      assert.equal(B.messageHref({ link_kind: null, link_id: null }), null);
      assert.equal(B.messageHref({ link_kind: "https://evil.example" as never, link_id: 3 }), null);
      assert.equal(B.feedHref({ link_kind: "chart", link_id: "critics" }), "/passport/house/charts/critics");
      assert.equal(B.feedHref({ link_kind: "chart", link_id: "javascript:alert(1)" }), "/passport");
      // File 10 gave "bracket" (and file 09's "event") a page; a kind this app doesn't know yet still never makes a dead link.
      assert.equal(B.feedHref({ link_kind: "bracket", link_id: 9 }), "/passport/brackets/9");
      assert.equal(B.feedHref({ link_kind: "event", link_id: 4 }), "/passport/events/4");
      assert.equal(B.feedHref({ link_kind: "raffle" as never, link_id: 9 }), "/passport", "a later file's kind never makes a dead link");
      assert.equal(B.feedKicker("season"), "New menu");
    });
    await test("prices and pours read as the bar wrote them: whole dollars, plus tax", () => {
      assert.equal(B.flightLine(28), "Flight · $28");
      assert.equal(B.flightLine(null), null);
      assert.equal(B.TAX_LINE, "plus tax");
      assert.equal(B.pourLabel(0.75), "0.75 oz");
      assert.equal(B.discountLine(0), null);
      assert.equal(B.listKicker({ chart: "top", season_name: "Fall 2026", staff_pick: false, by: null, ranked: true, past: true }), "Final chart · Fall 2026");
    });
    await test("dismiss only ever sends a message number or a card key the Bible made", () => {
      assert.deepEqual(B.dismissBody("message", 7), { what: "message", key: 7 });
      assert.deepEqual(B.dismissBody("feed", "chart:3:top"), { what: "feed", key: "chart:3:top" });
      for (const [w, k] of [["message", "x"], ["message", -1], ["feed", "<script>"], ["feed", ""], ["other", 1]] as const) assert.equal(B.dismissBody(w, k), null, `${w} ${k}`);
    });
    await test("Home and the Index get From the bar through the one tab call; saving and dismissing are members only and rate limited", () => {
      const view = readFileSync(join(APP, "api", "passport", "view", "[view]", "route.ts"), "utf8");
      assert.ok(view.includes("getBarHome(auth)") && view.includes("getBarLists(auth)"));
      for (const f of [join(APP, "api", "passport", "dismiss", "route.ts"), join(APP, "api", "passport", "house", "save", "route.ts")]) {
        const src = readFileSync(f, "utf8");
        assert.ok(src.includes('memberRequest(req, "passport-personal"') && !/member_id|memberId/.test(src), f);
      }
      const page = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "HouseList.tsx"), "utf8");
      assert.ok(page.includes("Save a copy to my lists") && page.includes("<ItemRow") && page.includes("function ListComments() { return null; }"), "the list page: save a copy, + on every item, and the place for comments");
    });
  }


  // ── File 08: the Inbox ─────────────────────────────────────────────────────
  {
    const I = await import("../inbox");
    await test("a new message sends only the subject, the words and an attached item (never a status, staff name or member number)", () => {
      const x = I.threadBody({ subject: " Hi ", body: "A question", ref_kind: "cocktail", ref_id: "12", status: "closed", author: "staff", by: "Mike", member_id: 9 });
      assert.deepEqual(x, { body: { subject: "Hi", body: "A question", ref_kind: "cocktail", ref_id: 12 } });
      assert.deepEqual(I.threadBody({ body: "Plain" }), { body: { subject: "", body: "Plain" } });
      assert.ok("error" in I.threadBody({ body: "" }) && "error" in I.threadBody({ body: "x".repeat(2001) }) && "error" in I.threadBody({ body: "x", ref_kind: "producer", ref_id: 1 }));
    });
    await test("requests and event inquiries send only their own fields; no name, email or phone is typed again", () => {
      assert.deepEqual(I.requestBody({ kind: "access", date: "", details: " Near the door ", status: "done" }), { body: { kind: "access", date: "", details: "Near the door" } });
      assert.ok("error" in I.requestBody({ kind: "free", details: "x" }) && "error" in I.requestBody({ kind: "other", details: "x".repeat(1001) }));
      const e = I.eventBody({ kind: "tasting", preferred_date: "2027-01-08", time_of_day: "evening", guests: "10", budget: "500_1000", details: "", email: "x@y.z", deposit: 100 });
      assert.deepEqual(e, { body: { kind: "tasting", preferred_date: "2027-01-08", backup_date: "", time_of_day: "evening", guests: 10, budget: "500_1000", details: "" } });
      assert.ok("error" in I.eventBody({ kind: "tasting", preferred_date: "2027-01-08", time_of_day: "evening", guests: 0 }));
      assert.ok("error" in I.eventBody({ kind: "tasting", preferred_date: "soon", time_of_day: "evening", guests: 4 }));
    });
    await test("Ask about this: only a cocktail, bottle or list, and the item opens only while it may", () => {
      assert.deepEqual(I.parseAbout("bottle:7"), { kind: "bottle", id: 7 });
      for (const v of ["producer:1", "bottle:", "<x>", 7]) assert.equal(I.parseAbout(v), null);
      assert.equal(I.refHref({ kind: "list", id: 3, name: "x", opens: true }), "/passport/house/3");
      assert.equal(I.refHref({ kind: "cocktail", id: null, name: "x", opens: false }), null);
      assert.ok(I.askHref("cocktail", 4, "Paper Plane").startsWith("/passport/inbox/new?kind=message&about=cocktail%3A4"));
    });
    await test("Needs you and the Inbox dot: a question, an unread reply, an event reply, a price or a pickup", () => {
      const t = { id: 1, unread: true } as never;
      const q = { id: 2, question: true, unread: true } as never;
      const none = { threads: [], member_requests: [], inquiries: [] };
      assert.equal(I.inboxLit(none, []), false);
      assert.equal(I.inboxLit({ ...none, threads: [t] }, []), true);
      assert.equal(I.inboxLit({ ...none, member_requests: [q] }, []), true);
      assert.equal(I.inboxLit(none, [{ can_answer: true, status: "quoted" } as never]), true);
      const n = I.needsYou({ ...none, threads: [t], member_requests: [q] }, []);
      assert.deepEqual(n.map((x) => x.kind), ["question", "reply"], "a question waiting on the member comes first");
    });
    await test("the Inbox routes are members only and rate limited; the pages over the Inbox exist", () => {
      const api = join(APP, "api", "passport");
      const post = readFileSync(join(api, "inbox", "route.ts"), "utf8");
      const one = readFileSync(join(api, "inbox", "[what]", "[id]", "route.ts"), "utf8");
      const prefs = readFileSync(join(api, "notifications", "route.ts"), "utf8");
      assert.ok(post.includes('memberRequest(req, "passport-inbox"') && one.includes('memberRequest(req, "passport-inbox-read"') && one.includes('memberRequest(req, "passport-inbox"') && prefs.includes("memberRequest(req,"));
      for (const src of [post, one, prefs]) assert.ok(!/member_id|memberId/.test(src));
      assert.ok(LIMITS["passport-inbox"].max > 0 && LIMITS["passport-inbox-read"].max > 0);
      for (const p of ["/passport/inbox/new", "/passport/inbox/messages/[id]", "/passport/inbox/requests/[id]", "/passport/inbox/events/[id]"]) {
        assert.ok(pageOf(p), p);
        assert.equal(homeTabOf(p.replace("[id]", "4")), "inbox", p);
        assert.equal(tabOfPath(p.replace("[id]", "4")), null, `${p} opens over the Inbox`);
      }
    });
  }

  // ── File 09: friends, messages, sharing, Let's go, I'm here, Passport events, and the instant search ─────────────
  console.log("File 09: friends, direct messages, sharing, Let's go, I'm here and Passport events");
  {
    const S = await import("../social");
    const { localFind } = await import("../shell");
    await test("finding a friend: exactly one of an email, a phone or a friend code, never a name", () => {
      assert.deepEqual(S.lookupBody({ email: " sam@x.example " }), { body: { email: "sam@x.example" } });
      assert.deepEqual(S.lookupBody({ phone: "(312) 555-0123" }), { body: { phone: "3125550123" } });
      assert.deepEqual(S.lookupBody({ code: "abcd-2345" }), { body: { code: "ABCD2345" } });
      for (const b of [{ name: "Sam" }, {}, { email: "sam@x.example", phone: "3125550123" }, { email: "not an email" }, { phone: "123" }, { code: "ABC" }, { code: "ABCD-23456" }]) assert.ok("error" in S.lookupBody(b), JSON.stringify(b));
      assert.equal(S.cleanCode("ab cd 23 45"), "ABCD2345");
      assert.ok(S.friendLink("https://x.example/", "ABCD-2345").endsWith("/passport/friends?code=ABCD2345"));
      assert.ok(S.isTarget("friend:12") && S.isTarget("ask:3") && S.isTarget("thread:9") && !S.isTarget("member:4") && !S.isTarget("friend:") && !S.isTarget(7));
    });
    await test("messages, shares, plans and answers send only their own fields (never a member number)", () => {
      assert.deepEqual(S.messageBody({ body: " Hi ", member_id: 4, to: 9 }), { body: { body: "Hi" } });
      assert.ok("error" in S.messageBody({ body: "" }) && "error" in S.messageBody({ body: "x".repeat(1001) }));
      assert.deepEqual(S.shareBody({ kind: "list", id: "5", to: [3, "4", 3, "x"], note: " For you ", member_id: 1, stars: 5 }), { body: { kind: "list", id: 5, to: [3, 4], note: "For you" } });
      assert.ok("error" in S.shareBody({ kind: "member", id: 1, to: [1] }) && "error" in S.shareBody({ kind: "cocktail", id: 1, to: [] }) && "error" in S.shareBody({ kind: "cocktail", id: 1, to: Array.from({ length: 21 }, (_, i) => i + 1) }));
      assert.deepEqual(S.letsgoBody({ day: "2026-12-04", time: "evening", note: "", to: "all", member_ids: [1] }), { body: { day: "2026-12-04", time: "evening", note: "", to: "all" } });
      assert.ok("error" in S.letsgoBody({ day: "Friday", time: "evening", to: "all" }) && "error" in S.letsgoBody({ day: "2026-12-04", time: "midnight", to: "all" }) && "error" in S.letsgoBody({ day: "2026-12-04", time: "late", to: [] }));
      assert.deepEqual(S.rsvpBody({ answer: "going", guests: "1", capacity: 999 }), { body: { answer: "going", guests: 1 } });
      assert.deepEqual(S.rsvpBody({ answer: "cant", guests: 4 }), { body: { answer: "cant", guests: 0 } });
      assert.ok("error" in S.rsvpBody({ answer: "maybe" }) && "error" in S.rsvpBody({ answer: "going", guests: -1 }));
    });
    await test("a ticket link opens only when it is a plain https address", () => {
      assert.equal(S.ticketHref("https://tickets.example.com/x"), "https://tickets.example.com/x");
      for (const u of ["http://tickets.example.com", "javascript:alert(1)", "https://u:p@tickets.example.com", "not a link", null]) assert.equal(S.ticketHref(u as string | null), null, String(u));
    });
    await test("friends going, shares and the Inbox dot in members' words", () => {
      assert.equal(S.friendsGoingLine(null), "");
      assert.equal(S.friendsGoingLine({ names: ["Sam"], count: 1 }), "Sam is going");
      assert.equal(S.friendsGoingLine({ names: ["Sam", "Ana"], count: 2 }), "Sam and Ana are going");
      assert.equal(S.friendsGoingLine({ names: ["Sam", "Ana"], count: 3 }), "Sam and 2 friends are going");
      assert.equal(S.shareHref({ id: 4, kind: "cocktail", ref_id: 12, opens: true }), "/passport/library/12");
      assert.equal(S.shareHref({ id: 4, kind: "event", ref_id: 3, opens: true }), "/passport/events/3");
      assert.equal(S.shareHref({ id: 4, kind: "list", ref_id: null, opens: true }), "/passport/shared/4");
      assert.equal(S.shareHref({ id: 4, kind: "bottle", ref_id: null, opens: false }), null, "something the receiver may not open opens nothing");
      const none = { conversations: [], incoming: [], notices: [] };
      assert.equal(S.socialLit(none), false);
      assert.equal(S.socialLit({ ...none, incoming: [{ id: 1, name: "Sam S.", at: "" }] }), true);
      assert.equal(S.socialLit({ ...none, conversations: [{ id: 1, available: true, name: "Sam S.", unread: true }] }), true);
      assert.equal(S.nextDays(new Date("2026-12-04T18:00:00Z"), 3).map((d) => d.label)[0], "Tonight");
      assert.equal(S.PRIVATE_LINE, "Private between you and your friend. If something is reported, our team can review it.");
    });
    await test("the friends, messages, sharing, plans and events routes are members only, rate limited, and never take a member number", () => {
      const api = join(APP, "api", "passport");
      const files = [["friends", "route.ts"], ["conversations", "route.ts"], ["conversations", "[id]", "route.ts"], ["share", "route.ts"], ["shares", "[id]", "route.ts"], ["meetups", "route.ts"], ["events", "[id]", "route.ts"]];
      for (const f of files) {
        const src = readFileSync(join(api, ...f), "utf8");
        assert.ok(/memberRequest\(req, (bucket|"passport-(social|social-read|member|friends)")/.test(src), f.join("/"));
        assert.ok(!/member_id|memberId|searchParams\.get\("member/.test(src), `${f.join("/")} never takes a member number`);
      }
      assert.ok(LIMITS["passport-friends"].max > 0 && LIMITS["passport-social"].max > 0 && LIMITS["passport-social-read"].max > 0);
      for (const p of ["/passport/friends", "/passport/inbox/friends/[id]", "/passport/events/[id]", "/passport/letsgo", "/passport/shared/[id]"]) assert.ok(pageOf(p), p);
      assert.equal(homeTabOf("/passport/inbox/friends/4"), "inbox");
      assert.equal(homeTabOf("/passport/events/4"), "events");
      assert.equal(homeTabOf("/passport/friends"), "home");
      assert.equal(tabOfPath("/passport/events/4"), null, "an event opens over the Events tab");
      const msg = readFileSync(join(APP, "..", "components", "passport", "Social.tsx"), "utf8");
      assert.ok(msg.includes("{PRIVATE_LINE}"), "where members write to a friend, the app says it is private between them");
      const ev = readFileSync(join(APP, "..", "components", "passport", "Events.tsx"), "utf8");
      assert.ok(ev.includes('target="_blank" rel="noopener noreferrer"') && ev.includes("ticketHref("), "Get tickets opens outside the app, only for an https link");
    });
    await test("search answers at once from the Index data: the same names, in the Bible's order and limits", () => {
      const c = (id: number, name: string, menu_status: "current" | "past" = "current") => ({ id, name, flavor: "", menu_name: "M", menu_status, passport: null, available: false });
      const b = (id: number, name: string) => ({ id, name, category: "Rum", status_label: null, available: true });
      const index = { cocktails: [c(1, "Zombie", "past"), c(2, "Café Royale"), c(3, "Old Fashioned"), c(4, "Zingara")], bottles: [b(5, "Zacapa 23"), b(6, "Plantation Xaymaca"), b(7, "El Dorado 12")] };
      const r = localFind(index, "z")!;
      assert.deepEqual(r, { cocktails: [], bottles: [] }, "one letter is not a search");
      assert.deepEqual(localFind(index, "Z  i")!.cocktails.map((x) => x.id), [4, 1], "every word must match; current menus first, then by name");
      assert.deepEqual(localFind(index, "a 2")!.bottles.map((x) => x.id), [7, 5], "bottles by name");
      assert.deepEqual(localFind(index, "cafe")!.cocktails.map((x) => x.id), [2], "accents are ignored, as at the Bible");
      assert.equal(localFind(null, "rum"), null, "with no Index data, it waits for the Bible as before");
      const many = { cocktails: Array.from({ length: 30 }, (_, i) => c(i + 1, `Rum ${String(i).padStart(2, "0")}`)), bottles: Array.from({ length: 30 }, (_, i) => b(i + 100, `Rum ${i}`)) };
      assert.ok(localFind(many, "rum")!.cocktails.length === 20 && localFind(many, "rum")!.bottles.length === 25, "the Bible's limits");
      const src = readFileSync(join(APP, "..", "components", "passport", "Search.tsx"), "utf8");
      assert.ok(src.includes('useView<IndexData>("index")') && src.includes("/api/passport/find"), "the Index data answers first; the Bible's answer still comes (producers, ingredients)");
    });
  }

  // ── File 10: comments on curated content, flights to vote on, and brackets ─────────────────────────────────────────
  console.log("File 10: comments, flights to vote on, and brackets");
  {
    const V = await import("../votes");
    const B10 = await import("../bar");
    await test("comments send only plain words and a reply's parent number; nothing else passes", () => {
      assert.deepEqual(V.commentBody({ body: "  Lovely list  " }), { body: { body: "Lovely list" } });
      assert.deepEqual(V.commentBody({ body: "Agreed", parent_id: "12" }), { body: { body: "Agreed", parent_id: 12 } });
      for (const b of [{}, { body: "" }, { body: "   " }, { body: "x".repeat(501) }, { body: "ok", parent_id: "abc" }, { body: "ok", parent_id: -3 }]) assert.ok("error" in V.commentBody(b), JSON.stringify(b).slice(0, 60));
      const got = V.commentBody({ body: "hi", member_id: 4, world: "test", name: "x" } as Record<string, unknown>);
      assert.ok(!("error" in got) && Object.keys(got.body).join() === "body", "a member number, a world or a name never passes");
      assert.equal(V.PG_LINE, "Please keep it PG and respectful.");
      assert.equal(V.REMOVED_LINE, "Removed by Common Good");
      assert.ok(V.isCommentType("list") && V.isCommentType("bracket") && !V.isCommentType("cocktail") && !V.isCommentType("bottle") && !V.isCommentType("personal"), "only the bar's curated content takes comments");
    });
    await test("a vote sends one slot and one option; a bracket vote one matchup and a or b", () => {
      assert.deepEqual(V.flightVoteBody({ slot_id: 3, option_id: "9" }), { body: { slot_id: 3, option_id: 9 } });
      for (const b of [{}, { slot_id: 3 }, { slot_id: "x", option_id: 2 }, { slot_id: 0, option_id: 2 }]) assert.ok("error" in V.flightVoteBody(b));
      assert.deepEqual(V.bracketVoteBody({ matchup_id: "5", pick: "b" }), { body: { matchup_id: 5, pick: "b" } });
      for (const b of [{ matchup_id: 5 }, { matchup_id: 5, pick: "c" }, { pick: "a" }]) assert.ok("error" in V.bracketVoteBody(b));
    });
    await test("links stay inside Passport; shares are words only when the bar sent a number", () => {
      assert.equal(V.itemHref("list", 3), "/passport/house/3");
      assert.equal(V.itemHref("message", 3), "/passport/from-the-bar/3");
      assert.equal(V.itemHref("event", 3), "/passport/events/3");
      assert.equal(V.itemHref("flight", 3), "/passport/votes/3");
      assert.equal(V.itemHref("bracket", 3), "/passport/brackets/3");
      assert.equal(V.itemHref("https://evil.example", 3), null);
      assert.equal(V.itemHref("list", "javascript:alert(1)"), null);
      assert.equal(V.voteHref({ kind: "flight", id: 7 }), "/passport/votes/7");
      assert.equal(V.pctLabel(67), "67%");
      assert.equal(V.pctLabel(0), "0%");
      assert.equal(V.pctLabel(null), null, "no share unless the bar sent one");
      assert.equal(B10.feedKicker("bracket_winner"), "We have a winner");
      assert.equal(V.voteKicker({ kind: "flight", status: "open" }), "Voting is open");
      assert.equal(V.voteKicker({ kind: "bracket", status: "closed" }), "We have a winner");
    });
    await test("editing a comment stops after its 10 minutes; a bracket opens on its current round", () => {
      const now = Date.parse("2026-11-25T18:00:00Z");
      assert.ok(V.canStillEdit("2026-11-25T18:05:00Z", now) && !V.canStillEdit("2026-11-25T17:59:00Z", now) && !V.canStillEdit(null, now));
      const rounds = [1, 2, 3].map((round) => ({ round, name: "", when: "", state: "upcoming" as const, matchups: [] }));
      assert.equal(V.startRound({ rounds, current_round: 2, status: "open" }), 1);
      assert.equal(V.startRound({ rounds, current_round: 3, status: "closed" }), 2);
      assert.equal(V.startRound({ rounds, current_round: 0, status: "open" }), 0);
    });
    await test("the comments and votes routes are members only, rate limited, and never take a member number or a count", () => {
      const api = join(APP, "api", "passport");
      const files = [["comments", "[type]", "[id]", "route.ts"], ["comment", "[id]", "route.ts"], ["votes", "[id]", "route.ts"], ["brackets", "[id]", "route.ts"]];
      for (const f of files) {
        const src = readFileSync(join(api, ...f), "utf8");
        assert.ok(/memberRequest\(req, "passport-(comments|votes|member)"/.test(src), f.join("/"));
        assert.ok(!/member_id|memberId|searchParams\.get\("member|world|totals|voters/.test(src), `${f.join("/")} never takes a member number, a world or a count`);
      }
      assert.ok(LIMITS["passport-comments"].max > 0 && LIMITS["passport-votes"].max > 0);
      for (const p of ["/passport/votes/[id]", "/passport/votes/past", "/passport/brackets/[id]", "/passport/from-the-bar/[id]"]) assert.ok(pageOf(p), p);
      assert.equal(homeTabOf("/passport/votes/4"), "index");
      assert.equal(homeTabOf("/passport/brackets/4"), "index");
      assert.equal(homeTabOf("/passport/from-the-bar/4"), "home");
      const comments = readFileSync(join(APP, "..", "components", "passport", "Comments.tsx"), "utf8");
      assert.ok(comments.includes("if (!loaded || !t) return null;"), "comments draw nothing while they are off: no empty box");
      assert.ok(comments.includes("PG_LINE") && comments.includes("first_time"), "before the first comment, and under the box always: Please keep it PG and respectful.");
      const votes = readFileSync(join(APP, "..", "components", "passport", "Votes.tsx"), "utf8");
      assert.ok(votes.includes("if (!open?.length && !results?.length) return null;"), "Home's votes card draws nothing when there are none");
      assert.ok(votes.includes("overflow-x-auto snap-x") && votes.includes("startRound("), "the bracket scrolls sideways by round, the current round first");
      for (const page of ["house/[id]/page.tsx", "events/[id]/page.tsx", "votes/[id]/page.tsx", "brackets/[id]/page.tsx", "from-the-bar/[id]/page.tsx"]) {
        assert.ok(readFileSync(join(APP, "passport", "(app)", ...page.split("/")), "utf8").includes("<Comments type="), `${page} has the comments place`);
      }
    });
  }

  {
    console.log("\nPhotos (file 11)");
    const T11 = await import("../types");
    const { BarPhoto, Thumb } = await import("../../../components/passport/PhotoBits");
    const comp11 = (f: string) => readFileSync(join(APP, "..", "components", "passport", f), "utf8");
    await test("a photo is shown only from the member's own signed-in address, never a public one or the image optimizer", () => {
      assert.equal(T11.barPhotoSrc("cocktail", 12, "abc123", "thumb"), "/passport/photo/bar/cocktail/12/thumb?v=abc123");
      assert.equal(T11.myPhotoSrc("0123456789abcdef01234567", "full"), "/passport/photo/mine/0123456789abcdef01234567/full");
      for (const f of ["PhotoBits.tsx", "Photos.tsx"]) assert.ok(!/next\/image|_next\/image|\/uploads\/|\/public\//.test(comp11(f)), f);
    });
    await test("the photo routes ask the Bible for the signed-in member only, and never let a shared cache keep a picture", () => {
      const lib = readFileSync(join(__dirname, "..", "photoRoute.ts"), "utf8");
      assert.ok(lib.includes("currentAuth()") && lib.includes('limited(req, "passport-photo-read")') && lib.includes('PHOTO_TYPES = ["image/jpeg", "image/webp"]') && lib.includes("!PHOTO_TYPES.includes(type)"), "signed in, rate limited, only a JPEG (file 15: or a cut-out WebP) the Bible made goes on; never an SVG");
      const bar = readFileSync(join(APP, "passport", "(app)", "photo", "bar", "[kind]", "[id]", "[size]", "route.ts"), "utf8");
      const mine = readFileSync(join(APP, "passport", "(app)", "photo", "mine", "[token]", "[size]", "route.ts"), "utf8");
      assert.ok(bar.includes('"private, max-age=31536000, immutable"'), "the bar's photos: long cache, in the member's own browser only");
      assert.ok(mine.includes('"private, no-store"') && mine.includes("/^[a-f0-9]{24}$/"), "a member's own photo: never stored by a cache; only a real photo code is passed on");
      for (const src of [bar, mine, lib]) assert.ok(!/public,|s-maxage|member_id|memberId/.test(src), "never public, never a member number");
    });
    await test("adding and deleting photos: same site, rate limited, only the signed-in member's, over 15 MB refused before the Bible", () => {
      const api = readFileSync(join(APP, "api", "passport", "photos", "route.ts"), "utf8");
      assert.ok(api.includes("sameOrigin(req)") && api.includes('limited(req, "passport-photos")') && api.includes('memberRequest(req, "passport-photos"') && api.includes("15 * 1024 * 1024"));
      assert.ok(!/member_id|memberId/.test(api), "never takes a member number");
      assert.ok(LIMITS["passport-photos"].max > 0 && LIMITS["passport-photo-read"].max > 0);
    });
    await test("the privacy line shows where a member adds a photo; My photos is under Index → Journal (file 15: was Yours)", () => {
      const photos = comp11("Photos.tsx");
      assert.ok(photos.includes('"Only you and the Common Good team can see your photos."') && /MyItemPhotos[\s\S]*PHOTO_PRIVATE_LINE/.test(photos));
      assert.ok(photos.includes("MAX_SIDE = 1600") && photos.includes("TARGET = 400 * 1024") && photos.includes('"image/jpeg"'), "shrunk on the device: 1600px, JPEG, under 400 KB");
      assert.ok(photos.includes("Removed by Common Good"));
      assert.ok(pageOf("/passport/photos"), "My photos page");
      assert.equal(homeTabOf("/passport/photos"), "index");
      // File 14: the Yours tiles live in the navigation model (updated from the flat Index's list of links).
      assert.ok(readFileSync(join(APP, "..", "lib", "passport", "nav.ts"), "utf8").includes('href: "/passport/photos"'));
      for (const page of ["library/[id]/page.tsx", "spirits/[id]/page.tsx"]) assert.ok(readFileSync(join(APP, "passport", "(app)", ...page.split("/")), "utf8").includes("<MyItemPhotos"), page);
    });
    await test("a page or card without a photo draws nothing for it (it looks finished, not missing something)", () => {
      assert.equal(BarPhoto({ kind: "cocktail", id: 3, photo: null, name: "X" }), null);
      assert.equal(Thumb({ kind: "bottle", id: 3, photo: undefined }), null);
      assert.equal(Thumb({ kind: "bottle", id: null, photo: "abc" }), null);
      assert.ok(BarPhoto({ kind: "cocktail", id: 3, photo: "abc", name: "X" }) !== null);
    });
  }

  console.log("File 12: For you");
  {
    const comp12 = (f: string) => readFileSync(join(APP, "..", "components", "passport", f), "utf8");
    const view12 = readFileSync(join(APP, "api", "passport", "view", "[view]", "route.ts"), "utf8");
    await test("Home asks the Bible for four suggestions in its one tab call; the Index's own answer carries up to twelve", () => {
      assert.ok(view12.includes("getForYou(auth, 4).catch(() => null)") && view12.includes("for_you: forYou?.recommendations ?? []"));
      const lib = readFileSync(join(__dirname, "..", "bible.ts"), "utf8");
      assert.ok(lib.includes('/recommendations?limit=') && lib.includes("Math.min(12"), "never more than twelve");
      assert.ok(comp12("tabs/IndexTab.tsx").includes("<ForYouIndex items={d.recommendations} enough={d.enough} suggest={d.suggest} />"));
    });
    await test("Home draws nothing for For you when there is nothing; the Index says one quiet line for too little history", () => {
      const fy = comp12("ForYou.tsx");
      assert.ok(fy.includes("if (!shown.length) return null;"), "Home: nothing empty");
      assert.ok(fy.includes("Favorite or rate a few things and we&rsquo;ll suggest what to try next."));
      assert.ok(fy.includes(".slice(0, 4)") && fy.includes(".slice(0, 12)"));
    });
    await test("\"Not for me\" responds at once, puts it back if the bar can't be reached, and sends only kind and number", () => {
      const fy = comp12("ForYou.tsx");
      assert.ok(/setHidden\(new Set\(hidden\)\.add\(k\)\)[\s\S]*postJson\("\/api\/passport\/recommendations\/dismiss", \{ kind: r\.kind, id: r\.id \}\)[\s\S]*n\.delete\(k\)/.test(fy));
      const api = readFileSync(join(APP, "api", "passport", "recommendations", "dismiss", "route.ts"), "utf8");
      assert.ok(api.includes('memberRequest(req, "passport-personal"') && api.includes("isKind(b.kind)") && api.includes("posInt(b.id)"));
      assert.ok(!/member_id|memberId/.test(api), "never takes a member number");
    });
    await test("Account has the \"Suggest things for me\" switch, and it goes to the member's own record only", () => {
      assert.ok(comp12("Account.tsx").includes(">Suggest things for me</Check>"));
      const me = readFileSync(join(APP, "api", "passport", "me", "route.ts"), "utf8");
      assert.ok(me.includes('if (typeof body.suggest === "boolean") change.suggest = body.suggest;'));
    });
  }

  console.log("File 12: the polish pass");
  {
    const compP = (f: string) => readFileSync(join(APP, "..", "components", "passport", f), "utf8");
    await test("Home reads in the agreed order: welcome and buttons, Right now, Tonight, votes, For you, From the bar, What's new, Shared, newest list, exclusives", () => {
      const home = compP("tabs/HomeTab.tsx");
      const order = ["Welcome, {d.first_name}", "<HereButtons", "pp-now", "<LetsGoCards", "<Tonight", "<VotesHome", "<ForYouHome", "<FromTheBar", "<WhatsNew", "<SharedWithYou", "<NewestList", "pp-exclusives"];
      const at = order.map((x) => home.indexOf(x));
      assert.ok(at.every((n) => n > 0), `all present: ${order.filter((_, i) => at[i] < 0)}`);
      assert.deepEqual([...at].sort((x, y) => x - y), at, "in this order");
      assert.ok(home.includes("<SeeAll items={now}") && home.includes("<SeeAll items={d.exclusives}") && compP("Votes.tsx").includes("<SeeAll"), "more than three behind See all");
    });
    await test("\"Keep it handy\": Not now lasts 30 days; never once installed", () => {
      const ih = compP("InstallHint.tsx");
      assert.ok(ih.includes("30 * 24 * 60 * 60 * 1000") && ih.includes('"appinstalled"') && ih.includes("store(INSTALLED, \"1\")"));
    });
    await test("the faint text passes WCAG AA on the background; the Index's jump chips stick; Back slides the page out", async () => {
      const { C } = await import("../../../components/passport/theme");
      const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      for (const bg of [C.bg, C.card]) assert.ok(ratio(C.faint, bg) >= 4.5, `faint on ${bg}: ${ratio(C.faint, bg).toFixed(2)}`);
      // File 14: the jump chips are gone (the Index drills down); what sticks under the top bar now is the "where you
      // are" trail and the Menu tab's sideways tabs. (Updated from the flat Index's jump chips.)
      assert.ok(compP("Drill.tsx").includes('aria-label="Where you are" className="sticky') && compP("tabs/MenuTab.tsx").includes('className="sticky z-20'));
      assert.ok(compP("AppShell.tsx").includes('{ transform: "translateX(100%)" }'));
    });
  }

  console.log("File 13: notifications on this device");
  {
    const root = join(APP, "..", "..");
    const sw = readFileSync(join(root, "public", "passport", "sw.js"), "utf8");
    const compP = (f: string) => readFileSync(join(APP, "..", "components", "passport", f), "utf8");
    await test("the helper has no fetch handler (it never changes how any page loads) and only opens /passport addresses", () => {
      assert.ok(!/addEventListener\(\s*["']fetch["']/.test(sw), "no fetch handler");
      assert.ok(sw.includes('addEventListener("push"') && sw.includes('addEventListener("notificationclick"'));
      const m = sw.match(/function safeUrl\(u\) \{\s*return ([^;]+);/);
      assert.ok(m, "safeUrl found");
      // eslint-disable-next-line no-new-func
      const safeUrl = new Function("u", `return ${m![1]};`) as (u: unknown) => string;
      assert.equal(safeUrl("/passport/inbox/messages/4"), "/passport/inbox/messages/4");
      for (const bad of ["https://evil.example/passport", "//evil.example/x", "/passport/../admin", "/passport/%2e%2e/admin", "/admin", "javascript:alert(1)", "/passport\\x", 5, null]) assert.equal(safeUrl(bad), "/passport", String(bad));
    });
    await test("it is registered for /passport only, and the site allows exactly that scope", () => {
      const pc = compP("pushClient.ts");
      assert.ok(pc.includes('const SW_URL = "/passport/sw.js"') && pc.includes('const SCOPE = "/passport"') && pc.includes("{ scope: SCOPE }"));
      const cfg = readFileSync(join(root, "next.config.mjs"), "utf8");
      assert.ok(/source: "\/passport\/sw\.js"[\s\S]{0,200}Service-Worker-Allowed", value: "\/passport"/.test(cfg));
    });
    await test("the browser's permission box opens only from our own button, and Home's card never on a first open", () => {
      const pc = compP("pushClient.ts");
      const calls = pc.split("Notification.requestPermission(").length - 1;
      assert.equal(calls, 1, "one place asks");
      assert.ok(/export async function turnOn\(\)[\s\S]*?Notification\.requestPermission\(/.test(pc), "inside turnOn");
      const prompt = compP("PushPrompt.tsx");
      assert.ok(prompt.includes("usedForABit()") && prompt.includes("promptDone()") && prompt.includes("installHintShowing()"));
      assert.ok(/p\.n >= 4 && Array\.isArray\(p\.days\) && p\.days\.length >= 2/.test(pc), "four opens on two days");
      assert.ok(!compP("tabs/HomeTab.tsx").includes("turnOn("), "Home never asks by itself");
    });
    await test("Account says plainly that on iPhone it works once Passport is on the home screen", () => {
      assert.ok(compP("Account.tsx").includes("On iPhone, notifications work once Passport is on your home screen"));
    });
    await test("the push route passes only an https endpoint and its two keys to the Bible, never a member number", () => {
      const route = readFileSync(join(APP, "api", "passport", "push", "route.ts"), "utf8");
      assert.ok(route.includes("memberRequest(") && !/member_id|memberId:/.test(route.replace("auth", "")));
      assert.ok(route.includes('subscription: { endpoint, keys: { p256dh, auth: key } }, label'));
    });
  }

  console.log("File 13: order history with a household");
  {
    const compP = (f: string) => readFileSync(join(APP, "..", "components", "passport", f), "utf8");
    await test("Account has the member's own \"Share order history with my household\" switch, sent only as true or false", () => {
      assert.ok(compP("Account.tsx").includes("Share order history with my household") && compP("Account.tsx").includes('{ household_history: on }'));
      const me = readFileSync(join(APP, "api", "passport", "me", "route.ts"), "utf8");
      assert.ok(me.includes('typeof body.household_history === "boolean"'));
    });
    await test("History offers Me and my household and Just me; a household-only row shows no date", () => {
      const page = readFileSync(join(APP, "passport", "(app)", "history", "page.tsx"), "utf8");
      assert.ok(page.includes("Me and my household") && page.includes("/passport/history?view=me") && page.includes('"Ordered by your household"'));
    });
    await test("an item page says \"You or your household have ordered this\" only when the Bible says so", () => {
      const p = compP("Personal.tsx");
      assert.ok(p.includes("mine.ordered_household") && p.includes("You or your household have ordered this"));
    });
  }

  console.log("File 15, Part F: beer, wine and cider open their own pages");
  {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    (globalThis as { React?: unknown }).React = React;
    const D = await import("../../../components/passport/Drill");
    const html = (el: unknown) => renderToStaticMarkup(el as never);
    await test("a beer row with a Bible item opens its bottle page (file 06's \"no page of its own\" rows are replaced)", () => {
      const row = html(React.createElement(D.CompactBottle, { b: { id: 7001, name: "Pils", photo: "pp", available: true, status_label: null }, out: false }));
      assert.ok(row.includes('href="/passport/spirits/7001"') && row.includes("Pils"), row);
      const index = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "tabs", "IndexTab.tsx"), "utf8");
      assert.ok(/case "drinks":[\s\S]*?x\.id\s*\?\s*<CompactBottle/.test(index), "the Index's Beer & wine rows use the bottle row when the item has a page");
    });
    await test("a row with no Bible item stays a plain row; \"Request a bottle for home\" hides when the Bible says can_request false", () => {
      const index = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "tabs", "IndexTab.tsx"), "utf8");
      assert.ok(/case "drinks":[\s\S]*?: \(\s*<li key=\{`\$\{x\.name\}/.test(index));
      const page = readFileSync(join(__dirname, "..", "..", "..", "app", "passport", "(app)", "spirits", "[id]", "page.tsx"), "utf8");
      assert.ok(page.includes("can_request !== false && <RequestBottle"));
    });
  }

  console.log("File 15, Part G: the public website's events in the Events tab");
  {
    const PE = await import("../publicEvents");
    const pev = (id: number, date: string, start = "7:00 PM") => ({ id, title: `P${id}`, description: "", date, start, end: null, price_text: "", ticket_url: null, rsvp: true, guest_limit: 0, status: "announced" as const, status_label: "", cancel_note: "", my_rsvp: null, friends_going: null });
    const raw = { id: "abc-123", title: "Jazz Night", start: "2026-12-05", description: "Live trio\nSecond line", imageUrl: "https://x.supabase.co/storage/v1/object/public/e.jpg", linkUrl: "https://tickets.example/j", linkLabel: "Tickets", location: "Main bar",
      visibleFrom: "2026-11-01", recurrence: "none", internal: "STAFF NOTE", capacity: 80 } as never;
    await test("a public event carries only what the public page shows (never anything else from its row)", () => {
      const e = PE.toPublicEvent(raw, "open")!;
      assert.deepEqual(Object.keys(e).sort(), [...PE.PUBLIC_EVENT_KEYS].sort());
      assert.ok(!JSON.stringify(e).includes("STAFF NOTE") && !JSON.stringify(e).includes("80"));
      assert.equal(e.line, "Live trio");
      assert.equal(e.book, true, "the public page offers booking when the Bible says the event is open");
      assert.equal(PE.publicBookHref(e), "/events?event=abc-123");
      assert.equal(PE.toPublicEvent({ ...(raw as object), linkUrl: "http://insecure.example" } as never)!.link_url, null, "only an https link");
      assert.equal(PE.toPublicEvent({ ...(raw as object), id: "../x" } as never), null);
      assert.ok(PE.isPublicEventId("abc-123::2026-12-05") && !PE.isPublicEventId("a/b"));
    });
    await test("Passport shows exactly the public page's list: the same function and the same booking state", () => {
      const srv = readFileSync(join(__dirname, "..", "publicEventsServer.ts"), "utf8");
      assert.ok(srv.includes("getEventsData()") && srv.includes("getEventStatuses(") && srv.includes("TTL_MS = 5 * 60 * 1000"));
      assert.ok(/catch \{\s*return cache\?\.events \?\? \[\];/.test(srv), "unavailable: Passport events only, no error");
      const ev = readFileSync(join(__dirname, "..", "..", "eventsdata.ts"), "utf8");
      assert.ok(ev.includes("visible_from") && ev.includes("visibleUntil") && ev.includes("start_date.gte."), "hidden (outside its window) and past events never come through");
    });
    await test("the two tabs: All events mixes both kinds by date (soonest first); Passport exclusives has only Passport events", () => {
      const pub = [PE.toPublicEvent({ ...(raw as object), id: "w1", start: "2026-12-03" } as never)!, PE.toPublicEvent({ ...(raw as object), id: "w2", start: "2026-12-10T18:30" } as never)!];
      const pass = [pev(1, "2026-12-05"), pev(2, "2026-12-10", "6:00 PM"), pev(3, "2026-12-01")];
      const all = PE.eventRows(pass as never, pub, "all");
      assert.deepEqual(all.map((r) => r.key), ["p3", "ww1", "p1", "p2", "ww2"]);
      assert.ok(all.filter((r) => r.kind === "passport").every((r) => r.members_only) && all.filter((r) => r.kind === "public").every((r) => !r.members_only));
      assert.deepEqual(PE.eventRows(pass as never, pub, "exclusives").map((r) => r.key), ["p3", "p1", "p2"]);
      assert.deepEqual(PE.EVENTS_TABS.map((t) => t.label), ["All events", "Passport exclusives"]);
      assert.deepEqual(PE.eventRows(null, null, "all"), []);
    });
    await test("a public event opens its own page with a way back; a share opens it too", async () => {
      const nav = readFileSync(join(__dirname, "..", "nav.ts"), "utf8");
      assert.ok(nav.includes('route: "events/public/[id]"'));
      const { shareHref } = await import("../social");
      assert.equal(shareHref({ id: 1, kind: "event", ref_id: null, opens: true, public_event_id: "w1::2026-12-05" }), "/passport/events/public/w1%3A%3A2026-12-05");
      const route = readFileSync(join(__dirname, "..", "..", "..", "app", "api", "passport", "share", "route.ts"), "utf8");
      assert.ok(route.includes("findPublicEvent(") && route.includes('public: { id: e.id, title: e.title, date: e.date }'), "only an event the public page shows, and only its id, title and date");
    });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
