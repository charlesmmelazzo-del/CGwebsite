// npm run test:passport — the Menu tab's description layout, its cocktail cards, the "a tap is never lost" save queue,
// (file 05) what a bottle request may send to the Bible, and (file 06) the new shell: tabs, old addresses, search,
// the available-now marker, the Inbox dot and reservations.

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
  await test("the recipe book is called My Cocktails, sits in the Index under Yours with Add a cocktail, and never in the Menu", () => {
    const comp = (f: string) => readFileSync(join(__dirname, "..", "..", "..", "components", "passport", f), "utf8");
    const index = comp("tabs/IndexTab.tsx");
    assert.ok(index.includes(">My Cocktails<") && index.includes('href="/passport/bespoke?new=1"') && index.includes("+ Add a cocktail"));
    assert.ok(!/bespoke|My Cocktails/i.test(comp("tabs/MenuTab.tsx")), "not on the Menu tab");
    const page = readFileSync(pageOf("/passport/bespoke")!, "utf8");
    assert.ok(page.includes('title="My Cocktails"'));
    const all = [index, comp("Personal.tsx"), page].join("\n");
    assert.ok(!/Bespoke (recipes|cocktails)/.test(all.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "the old label is shown nowhere");
  });
  await test("places for later files draw nothing until they have something (no empty boxes, no 'coming soon')", () => {
    const slots = readFileSync(join(__dirname, "..", "..", "..", "components", "passport", "tabs", "Slots.tsx"), "utf8");
    assert.ok(/function FromTheBar[\s\S]*?if \(!messages\?\.length\) return null;/.test(slots));
    assert.ok(/function WhatsNew[\s\S]*?if \(!cards\?\.length\) return null;/.test(slots));
    // File 07 fills Spirit of the Day and the Index's house lists: each still draws nothing until it has something.
    assert.ok(/function SpiritOfTheDay[\s\S]*?if \(!spirit\) return null;/.test(slots), "SpiritOfTheDay");
    assert.ok(/function HouseLists[\s\S]*?if \(!lists\?\.length && !charts\?\.length && !pastCount\) return null;/.test(slots), "HouseLists");
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
        ["Newest list", React.createElement(S.NewestList, { list: null })], ["From Common Good", React.createElement(S.HouseLists, { lists: [], charts: [], pastCount: 0 })],
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
      assert.ok(hl.includes("From Common Good") && hl.includes('href="/passport/house/charts/top"') && hl.includes("Past lists from Common Good") && hl.includes('href="/passport/house/past"'), hl);
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
      assert.equal(B.feedHref({ link_kind: "bracket", link_id: 9 }), "/passport", "a later file's kind never makes a dead link");
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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
