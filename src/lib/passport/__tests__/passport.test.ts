// npm run test:passport — the Menu tab's description layout, its cocktail cards, the "a tap is never lost" save queue,
// and (file 05) what a bottle request may send to the Bible.

import assert from "node:assert/strict";
import { bareFlavor, descriptionParts, menuItemBody } from "../description";
import { createSaveQueue, type SaveResult } from "../saveQueue";
import { isAction, money, quantity, requestBody, sortRequests, NO_PRICE_LINE } from "../bottles";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
