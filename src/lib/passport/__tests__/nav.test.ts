// npm run test:passport (second part) — file 14: nested navigation, section accents (Part 7) and the type scale (Part 8).
// Every check is on the models in lib/passport (nav.ts, accents.ts, typescale.ts), never on pixels.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EXCLUSIVES_TAB, NOW_ALBUM, PRODUCER_THRESHOLD, ROW_LIMIT, SPIRITS_TAB, allLevels, chosenTab, coverOf, indexHref, indexLevel, indexPathOf, isFinal,
  jumpBackIn, letterOf, menuTabs, parseAt, coversOf, mergeCovers, partyBanner, normalizePath, favoriteCovers, PAGE_PARENTS, NOT_PAGES, parentOf, tabPress, isTabRoot, COLLAGE_MAX, pathOfHref, rowsBeforeChoice, shortLine, spiritCategories, spiritLevel, spiritsFromIndex, type IndexInput, type SpiritEntry,
} from "../nav";
import { ACCENTS, APP_BG, APP_CARD, BRASS, CARD_SECTIONS, GREEN_DOT, SECTION_IDS, STATUS_COLORS, contrast, deltaE } from "../accents";
import { TYPE, px } from "../typescale";
import { OLD_ADDRESSES } from "../shell";
import { photoList, storageUrlOk } from "../websitePhotosCore";
import type { IndexBottle, IndexCocktail, MenuGroup, MenuItem, ToastMenu } from "../types";

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}
const ROOT = join(__dirname, "..", "..", "..");

// ── Realistic data: about 300 cocktails over several seasons, about 990 bottles ──
const SEASONS = ["2026 Winter Seasonal Cocktails", "2026 Spring Seasonal Cocktails", "2026 Summer Seasonal Cocktails", "2026 Fall Seasonal Cocktails", "2025 Fall Seasonal Cocktails", "Classic Cocktails"];
const SPIRITS = ["gin", "mezcal", "bourbon", "rye", "rum", "tequila", "brandy", "scotch", "vodka", "amaro"];
const WORDS = ["Pear", "Thee", "Well", "Smoke", "Signal", "Velvet", "Hour", "Garden", "Party", "Last", "Word", "Paper", "Plane", "Night", "Owl", "Copper", "Fox"];
function bigIndex(): IndexInput {
  const cocktails: IndexCocktail[] = [];
  for (let i = 0; i < 300; i++) {
    const season = SEASONS[i % SEASONS.length];
    const menus = i % 17 === 0 ? [season, SEASONS[(i + 1) % SEASONS.length]] : [season];
    cocktails.push({
      id: i + 1, name: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]} ${i}`, flavor: "Bright, Bitter", menu_name: season,
      menu_status: season.includes("2026 Fall") ? "current" : "past", passport: null, available: i % 9 === 0, spirits: [SPIRITS[i % SPIRITS.length]],
      photo: i % 13 === 0 ? `p${i}` : null, menus,
    });
  }
  const cats = ["Bourbon", "Rye", "Scotch", "Irish", "Japanese Whisky", "Gin", "Rum", "Agave", "Brandy", "Amaro", "Liqueur", "Other Whiskey"];
  const bottles: IndexBottle[] = [];
  for (let i = 0; i < 990; i++) {
    const cat = cats[i % 3 === 0 ? 0 : i % cats.length];
    bottles.push({ id: 5000 + i, name: `Bottle ${i}`, category: cat, status_label: i % 11 === 0 ? "No longer carried" : null, available: i % 11 !== 0 && i % 23 !== 0,
      on_list: i % 11 !== 0, producer: `Producer ${i % 61}`, photo: i % 50 === 0 ? `b${i}` : null });
  }
  return {
    cocktails, bottles,
    drinks: [{ name: "Pils", kind: "Beer", description: "", status_label: null, available: true }, { name: "Rosé", kind: "Wine", description: "", status_label: null, available: false }],
    base_spirits: SPIRITS.map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), count: 30 })),
    albums: SEASONS.map((n) => ({ name: n, current: n.includes("2026 Fall") })).sort((a, b) => b.name.localeCompare(a.name)),
    lists: [], house_lists: [{ id: 1, title: "Gin Week", intro: "", kind: "cocktail", ranked: false, by: null, staff_pick: false, price: null, count: 5, past: false }],
    charts: [], past_count: 2, votes: [], past_votes_count: 0,
  };
}
const item = (name: string, extra: Partial<MenuItem> = {}): MenuItem => ({ name, description: "", prices: [{ label: null, price: 14 }], cocktail_id: null, bottle_id: null, unavailable: false, ...extra });
const group = (name: string, n: number): MenuGroup => ({ name, items: Array.from({ length: n }, (_, i) => item(`${name} ${i}`)) });

(async () => {
  console.log("File 14: the Menu tab's tabs");
  const menus: ToastMenu[] = [
    { name: "Cocktail Hours", groups: [group("Fall Seasonals", 8), group("Classics", 6), group("Cocktail Flights", 3)] },
    { name: "Highballs & Free Spirited", groups: [group("Highballs", 5), group("Free Spirited", 4)] },
    { name: "Beer, Wine, Cider", groups: [group("Beer", 4), group("Wine", 6), group("Cider", 2), group("Sake", 2)] },
  ];
  const tabsSetting = [
    { label: "Fall Seasonals", menu: 0, groups: [0] }, { label: "Classics", menu: 0, groups: [1] }, { label: "Flights", menu: 0, groups: [2] },
    { label: "Highballs & Free Spirited", menu: 1, groups: null }, { label: "Beer, Wine, Cider", menu: 2, groups: null },
  ];
  const spirits: ToastMenu = { name: "Spirits List", groups: [{ name: "Bourbon", items: [item("Old Fox", { bottle_id: 1, producer: "Fox Co", photo: "x1" }), item("Out Bottle", { bottle_id: 2, unavailable: true })] }] };
  const tabs = menuTabs({ exclusives: [{ id: 9, name: "Members Sour" }], menus, tabs: tabsSetting, spirits, available: true });
  await test("Exclusives first, then the admin's tabs in order, Spirits last", () => {
    assert.deepEqual(tabs.map((t) => t.label), ["Exclusives", "Fall Seasonals", "Classics", "Flights", "Highballs & Free Spirited", "Beer, Wine, Cider", "Spirits"]);
    assert.equal(tabs[0].id, EXCLUSIVES_TAB);
    assert.equal(tabs[tabs.length - 1].id, SPIRITS_TAB);
  });
  await test("a \"groups as tabs\" menu never shows its own name; a \"one tab\" menu does", () => {
    assert.ok(!tabs.some((t) => t.label === "Cocktail Hours" || t.groups.some((g) => g.name === "Cocktail Hours")));
    assert.ok(!JSON.stringify(tabs.map((t) => t.label)).includes("Cocktail Hours"));
    const hb = tabs.find((t) => t.label === "Highballs & Free Spirited")!;
    assert.equal(hb.groups.length, 2);
    assert.equal(hb.chips, false, "two groups: sub-headings");
    assert.equal(tabs.find((t) => t.label === "Beer, Wine, Cider")!.chips, true, "more than three groups: a row of chips");
    assert.equal(tabs.find((t) => t.label === "Beer, Wine, Cider")!.section, "beer-wine");
  });
  await test("an older Bible with no tabs: each menu is one tab under its own name", () => {
    const t = menuTabs({ exclusives: [], menus, spirits: null, available: true });
    assert.deepEqual(t.map((x) => x.label), menus.map((m) => m.name));
  });
  await test("menus not available: only Exclusives and Spirits", () => {
    assert.deepEqual(menuTabs({ exclusives: [{ id: 1, name: "X" }], menus, tabs: tabsSetting, spirits, available: false }).map((t) => t.id), [EXCLUSIVES_TAB, SPIRITS_TAB]);
  });
  await test("the chosen tab: the address, else the one remembered while the app is open, else the first", () => {
    assert.equal(chosenTab(tabs, "spirits", "classics"), "spirits");
    assert.equal(chosenTab(tabs, null, "classics"), "classics");
    assert.equal(chosenTab(tabs, "gone", null), EXCLUSIVES_TAB);
  });
  await test("a tab's cover: the admin's \"Use as cover\" first, else the first item with a photo", () => {
    const items = [{ id: 1, name: "A", photo: "a" }, { id: 2, name: "B", photo: "b", cover: true }, { id: 3, name: "C" }];
    assert.equal(coverOf(items, "cocktail")!.id, 2);
    assert.equal(coverOf(items.map((x) => ({ ...x, cover: false })), "cocktail")!.id, 1);
    assert.equal(coverOf([{ id: 3, name: "C" }], "cocktail"), null);
    // File 15: the two-letter monogram tiles are gone (a place with no photo shows its section's icon instead).
  });
  await test("a compact row's one line: the flavor line, else the tagline, else the description's first line", () => {
    assert.equal(shortLine({ card: { flavor: "[Bright, Bitter]", tagline: "T" } }), "Bright, Bitter");
    assert.equal(shortLine({ card: { tagline: "Raking can wait." } }), "Raking can wait.");
    assert.equal(shortLine({ description: "Gin, Lime\n\n[Tart]\n\nNotes" }), "Tart");
  });

  console.log("File 14: spirits drill-down thresholds");
  const entries = (n: number, producers = 5): SpiritEntry[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `B${i}`, category: "Bourbon", producer: `P${i % producers}`, out: i === 0 }));
  await test(`${PRODUCER_THRESHOLD} bottles in a category: the bottles at once; out right now sinks to the bottom`, () => {
    const l = spiritLevel(entries(40), "Bourbon");
    assert.equal(l.kind, "bottles");
    if (l.kind === "bottles") { assert.equal(l.items.length, 40); assert.equal(l.items[l.items.length - 1].id, 1); }
  });
  await test(`${PRODUCER_THRESHOLD + 1} bottles: producers first (name and how many), then that producer's bottles`, () => {
    const l = spiritLevel(entries(41), "Bourbon");
    assert.equal(l.kind, "producers");
    if (l.kind === "producers") { assert.equal(l.producers.length, 5); assert.equal(l.producers.reduce((n, p) => n + p.count, 0), 41); }
    const p = spiritLevel(entries(41), "Bourbon", "P0");
    assert.equal(p.kind, "bottles");
    if (p.kind === "bottles") { assert.ok(p.items.every((x) => x.producer === "P0")); assert.equal(p.items[p.items.length - 1].out, true); }
    assert.equal(spiritLevel(entries(41), "Bourbon", "Nobody").kind, "missing");
  });
  await test("category tiles carry counts and a cover when a bottle in them has a photo", () => {
    const tiles = spiritCategories([...entries(3), { id: 99, name: "G", category: "Gin", producer: "", out: false, photo: "g" }]);
    assert.deepEqual(tiles.map((t) => [t.name, t.count]), [["Bourbon", 3], ["Gin", 1]]);
    assert.deepEqual(tiles[0].covers, []);
    assert.equal(tiles[1].covers[0].id, 99);
  });
  await test("the Index's \"Pouring now\" keeps the spirits list; \"Everything\" adds the archive", () => {
    const d = bigIndex();
    assert.ok(spiritsFromIndex(d.bottles, false).length < spiritsFromIndex(d.bottles, true).length);
    assert.equal(spiritsFromIndex(d.bottles, true).length, 990);
  });

  console.log("File 14: the Index tree");
  const d = bigIndex();
  await test("the top level is six tiles with counts, nothing else (Jump back in aside)", () => {
    const top = indexLevel(d, []);
    assert.equal(top.kind, "tiles");
    if (top.kind === "tiles") {
      // File 15: "From Common Good" is "CG Picks" and "Yours" is "Journal" (updated from file 14's names).
      assert.deepEqual(top.tiles.map((t) => t.label), ["Cocktails", "Spirits", "Beer & wine", "Lists", "CG Picks", "Journal"]);
      assert.equal(top.tiles[0].count, 300);
    }
  });
  await test("Cocktails: By menu, By spirit, A to Z, Available now", () => {
    const l = indexLevel(d, ["cocktails"]);
    assert.ok(l.kind === "tiles" && l.tiles.map((t) => t.label).join() === "By menu,By spirit,A to Z,Available now");
  });
  await test("By menu: \"On the menu now\" first, then albums newest first; a cocktail on two menus is in each", () => {
    const l = indexLevel(d, ["cocktails", "menu"]);
    assert.ok(l.kind === "tiles");
    if (l.kind !== "tiles") return;
    assert.equal(l.tiles[0].label, NOW_ALBUM);
    assert.deepEqual(l.tiles.slice(1).map((t) => t.label), d.albums!.map((a) => a.name));
    const both = d.cocktails.find((c) => (c.menus || []).length === 2)!;
    for (const m of both.menus!) { const a = indexLevel(d, ["cocktails", "menu", m]); assert.ok(a.kind === "cocktails" && a.items.some((c) => c.id === both.id), m); }
    const now = indexLevel(d, ["cocktails", "menu", NOW_ALBUM]);
    assert.ok(now.kind === "cocktails" && now.items.every((c) => c.menu_status === "current") && now.items.length === l.tiles[0].count);
  });
  await test("By spirit: the base-spirit keys as tiles with counts; each opens its cocktails", () => {
    const l = indexLevel(d, ["cocktails", "spirit"]);
    assert.ok(l.kind === "tiles" && l.tiles.length === SPIRITS.length && l.tiles.every((t) => t.count === 30));
    const m = indexLevel(d, ["cocktails", "spirit", "mezcal"]);
    assert.ok(m.kind === "cocktails" && m.items.length === 30 && m.items.every((c) => c.spirits!.includes("mezcal")));
    assert.deepEqual(m.trail.map((c) => c.label), ["Index", "Cocktails", "By spirit", "Mezcal"]);
  });
  await test("A to Z: a strip of the letters that have cocktails, counts adding up; a letter opens that letter", () => {
    const l = indexLevel(d, ["cocktails", "az"]);
    assert.ok(l.kind === "letters");
    if (l.kind !== "letters") return;
    assert.equal(l.letters.reduce((n, x) => n + x.count, 0), 300);
    const p = indexLevel(d, ["cocktails", "az", "P"]);
    assert.ok(p.kind === "cocktails" && p.items.every((c) => letterOf(c.name) === "P"));
    assert.equal(letterOf("The Last Word"), "L");
  });
  await test("Spirits: categories → producers (over 40) → bottles, with the trail", () => {
    const l = indexLevel(d, ["spirits"], { everything: true });
    assert.ok(l.kind === "tiles" && l.tiles.find((t) => t.label === "Bourbon")!.count! > PRODUCER_THRESHOLD);
    const b = indexLevel(d, ["spirits", "Bourbon"], { everything: true });
    assert.equal(b.kind, "producers");
    const p = indexLevel(d, ["spirits", "Bourbon", "Producer 3"], { everything: true });
    assert.ok(p.kind === "bottles" && p.items.length > 0);
    assert.deepEqual(p.trail.map((c) => c.label), ["Index", "Spirits", "Bourbon", "Producer 3"]);
  });
  await test("Beer & wine, Lists, CG Picks (only tiles that have something) and Journal (file 15 names)", () => {
    const bw = indexLevel(d, ["beer-wine"]);
    assert.ok(bw.kind === "tiles" && bw.tiles.map((t) => t.label).join() === "Beer,Wine");
    const cg = indexLevel(d, ["cg"]);
    assert.ok(cg.kind === "tiles" && cg.tiles.map((t) => t.label).join() === "House lists,Past lists");
    assert.equal(indexLevel(d, ["cg", "staff"]).kind, "missing", "no staff picks: no tile, and an old link says so");
    const y = indexLevel(d, ["journal"]);
    assert.ok(y.kind === "tiles" && y.tiles.map((t) => t.label).join() === "For you,Favorites,My Cocktails,Notes,History,My photos");
    assert.equal(indexLevel(d, ["lists"]).kind, "lists");
  });
  await test(`no screen shows more than ${ROW_LIMIT} rows before a choice is made (every level of the tree, both spirit switches)`, () => {
    for (const everything of [false, true]) {
      const levels = allLevels(d, { everything });
      assert.ok(levels.length > 40, `walked ${levels.length} levels`);
      for (const l of levels) {
        if (isFinal(l)) continue;
        assert.ok(rowsBeforeChoice(l) <= ROW_LIMIT, `${l.path.join(" › ") || "top"}: ${rowsBeforeChoice(l)} rows`);
      }
    }
  });

  console.log("File 14: old and new addresses");
  const at = (s: string, hash = "") => indexPathOf(new URLSearchParams(s), hash);
  await test("?at= round-trips, even for names with slashes, spaces and accents", () => {
    for (const p of [["cocktails", "menu", "2026 Fall/Winter Seasonal"], ["spirits", "Agave", "Destilería Ñ & Co"]]) {
      assert.deepEqual(pathOfHref(indexHref(p)), p);
    }
    assert.deepEqual(parseAt(null), []);
  });
  await test("every old Index address opens the right level", () => {
    assert.deepEqual(at("spirit=mezcal"), ["cocktails", "spirit", "mezcal"]);
    assert.deepEqual(at("q=gin"), []);
    for (const [h, p] of [["#lists", "lists"], ["#from-common-good", "cg"], ["#yours", "journal"], ["#cocktails", "cocktails"], ["#spirits", "spirits"], ["#beer-wine", "beer-wine"]]) assert.deepEqual(at("", h), [p]);
    assert.equal(indexLevel(d, at("spirit=mezcal")).kind, "cocktails");
    assert.equal(OLD_ADDRESSES.find((a) => a.path === "/passport/lists")!.goes, "/passport/library?at=lists");
    assert.equal(OLD_ADDRESSES.find((a) => a.path === "/passport/spirits")!.goes, "/passport/menu?tab=spirits");
    assert.equal(indexLevel(d, pathOfHref("/passport/library?at=lists")!).kind, "lists");
  });
  await test("the redirect pages go where the table says", () => {
    const page = (p: string) => readFileSync(join(ROOT, "app", "passport", "(app)", ...p.split("/"), "page.tsx"), "utf8");
    assert.ok(page("lists").includes('redirect("/passport/library?at=lists")'));
    assert.ok(page("spirits").includes('redirect("/passport/menu?tab=spirits")'));
  });
  await test("an unknown level says so instead of an empty screen", () => {
    assert.equal(indexLevel(d, ["cocktails", "menu", "No Such Menu"]).kind, "missing");
    assert.equal(indexLevel(d, ["nowhere"]).kind, "missing");
  });

  console.log("File 14: Jump back in");
  await test("only things the Index still holds, newest first, at most three, no repeats", () => {
    const recent = [{ kind: "cocktail" as const, id: 99999, name: "Hidden by the Index rule" }, { kind: "cocktail" as const, id: 1, name: "x" }, { kind: "bottle" as const, id: 5001, name: "y" },
      { kind: "cocktail" as const, id: 1, name: "x" }, { kind: "cocktail" as const, id: 2, name: "z" }, { kind: "cocktail" as const, id: 3, name: "w" }];
    const j = jumpBackIn(recent, d);
    assert.deepEqual(j.map((x) => `${x.kind}:${x.id}`), ["cocktail:1", "bottle:5001", "cocktail:2"]);
    assert.ok(!j.some((x) => x.id === 99999));
    assert.equal(j[0].name, d.cocktails[0].name, "the name comes from the Index, never from what the device kept");
  });

  console.log("File 14, Part 7: section accents");
  await test("every section's label passes AA on its tint, body and secondary text pass AA on it too, and its edge shows on the page", () => {
    for (const a of Object.values(ACCENTS)) {
      assert.ok(contrast(a.ink, a.tint) >= 4.5, `${a.id} label on tint ${contrast(a.ink, a.tint).toFixed(2)}`);
      assert.ok(contrast(a.ink, APP_BG) >= 4.5, `${a.id} heading on the page ${contrast(a.ink, APP_BG).toFixed(2)}`);
      assert.ok(contrast("#EDE6D3", a.tint) >= 4.5 && contrast("#97A586", a.tint) >= 4.5, `${a.id} text on tint`);
      assert.ok(contrast(a.edge, APP_BG) >= 3, `${a.id} edge is visible (3:1 for a graphic) ${contrast(a.edge, APP_BG).toFixed(2)}`);
    }
  });
  await test("the green \"available now\" dot and the brass stay apart from every accent; accents stay apart from each other", () => {
    for (const a of Object.values(ACCENTS)) {
      assert.ok(deltaE(a.edge, GREEN_DOT) >= 20 && deltaE(a.ink, GREEN_DOT) >= 20, `${a.id} vs the green dot`);
      assert.ok(deltaE(a.edge, BRASS) >= 15, `${a.id} edge vs brass ${deltaE(a.edge, BRASS).toFixed(1)}`);
    }
    const ids = Object.values(ACCENTS);
    for (const x of ids) for (const y of ids) if (x.id < y.id) assert.ok(deltaE(x.edge, y.edge) >= 15, `${x.id} vs ${y.id}: ${deltaE(x.edge, y.edge).toFixed(1)}`);
  });
  await test("the accents come from the public site's palette (or tints of it)", () => {
    const brand = readFileSync(join(ROOT, "lib", "brandColors.ts"), "utf8").toUpperCase();
    for (const a of Object.values(ACCENTS)) assert.ok(brand.includes(a.edge.toUpperCase()) && brand.includes(a.ink.toUpperCase()), a.id);
  });
  await test("every card kind maps to exactly one known section, and every section is used", () => {
    for (const [k, s] of Object.entries(CARD_SECTIONS)) assert.ok(SECTION_IDS.includes(s), `${k} → ${s}`);
    assert.deepEqual(Array.from(new Set(Object.values(CARD_SECTIONS))).sort(), [...SECTION_IDS].sort());
    assert.equal(new Set(Object.keys(CARD_SECTIONS)).size, Object.keys(CARD_SECTIONS).length);
  });
  await test("status chips keep their own colours, none of them a section accent", () => {
    for (const c of Object.values(STATUS_COLORS)) for (const a of Object.values(ACCENTS)) assert.ok(c.toUpperCase() !== a.edge.toUpperCase() && c.toUpperCase() !== a.ink.toUpperCase());
    assert.ok(contrast(APP_CARD, APP_BG) > 1, "cards differ from the page");
  });

  console.log("File 14, Part 8: the type scale");
  // File 16, Part 9 raised the bar from 1.3 to 1.6 (the section heading went from 1.5rem to 1.75rem).
  await test("section heading ≥ 1.6 × body; body ≥ 16px; secondary ≥ 14px; page title above the section heading", () => {
    assert.ok(px(TYPE.section) / px(TYPE.body) >= 1.6);
    assert.ok(px(TYPE.body) >= 16);
    assert.ok(px(TYPE.secondary) >= 14);
    assert.ok(px(TYPE.page) > px(TYPE.section) && px(TYPE.section) > px(TYPE.card) && px(TYPE.card) > px(TYPE.body));
    assert.ok(TYPE.body.lineHeight >= 1.45 && TYPE.body.lineHeight <= 1.55 && TYPE.body.weight >= 400 && TYPE.secondary.weight >= 400);
    assert.equal(TYPE.section.family, "display");
    assert.equal(TYPE.body.family, "body");
  });
  await test("the CSS tokens are the same numbers, in rem, and headings never get a synthetic bold", () => {
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
    for (const [k, v] of [["page", TYPE.page], ["section", TYPE.section], ["card", TYPE.card], ["body", TYPE.body], ["secondary", TYPE.secondary], ["eyebrow", TYPE.eyebrow]] as const) {
      assert.ok(css.includes(`--pp-fs-${k}: ${v.rem}rem`), k);
    }
    assert.ok(/\.pp-t-page, \.pp-t-section, \.pp-t-card \{[^}]*font-synthesis: none/.test(css));
  });
  console.log("File 16, Part 9: section headings that say \"you're in a different section\"");
  await test("every section's heading colour and its rule pass contrast on the page (text AA 4.5, the rule 3:1)", () => {
    for (const id of SECTION_IDS) {
      assert.ok(contrast(ACCENTS[id].ink, APP_BG) >= 4.5, `${id} heading ${contrast(ACCENTS[id].ink, APP_BG).toFixed(2)}`);
      assert.ok(contrast(ACCENTS[id].ink, APP_BG) >= 3, `${id} rule`);
    }
  });
  await test("a heading is a band (icon, accent, rule), more space above than below; no h2 without an accent", () => {
    const comp = (f: string) => readFileSync(join(ROOT, "components", "passport", f), "utf8");
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
    assert.ok(/\.pp-band \{[^}]*border-bottom: 1px solid currentColor/.test(css) && /\.pp-band-wrap \{ margin-top: 2\.5rem; margin-bottom: 0\.75rem; \}/.test(css));
    assert.ok(/export function SectionHeading[\s\S]*?<SectionIcon[\s\S]*?className="pp-band"/.test(comp("Drill.tsx")) || /export function SectionHeading[\s\S]*?className="pp-band"[\s\S]*?<SectionIcon/.test(comp("Drill.tsx")));
    assert.ok(comp("tabs/HomeTab.tsx").includes('<SectionHeading id="pp-now" section="inbox">Right now'), "Right now: Messages teal");
    assert.ok(/<Band section="bar" id="pp-tonight"/.test(comp("tabs/Slots.tsx")), "Tonight: From the bar cream");
    assert.ok(/<Band section="yours" id="pp-for-you"/.test(comp("ForYou.tsx")), "For you: Journal olive");
    const files = ["tabs/HomeTab.tsx", "tabs/Slots.tsx", "tabs/IndexTab.tsx", "tabs/MenuTab.tsx", "tabs/EventsTab.tsx", "tabs/InboxTab.tsx", "Social.tsx", "Messages.tsx", "Votes.tsx", "ForYou.tsx", "Library.tsx", "Search.tsx", "Account.tsx", "Comments.tsx", "Personal.tsx", "Photos.tsx", "Events.tsx", "AddToList.tsx"];
    for (const f of files) assert.ok(!/<h2[^>]*pp-t-section[^>]*style=\{\{ color: C\.text/.test(comp(f)), `${f}: an h2 without an accent`);
    assert.ok(/section=\{level\.path\.length \? level\.section : null\}/.test(comp("tabs/IndexTab.tsx")), "an Index level's title is a band in its section's accent");
  });
  await test("each tab draws exactly one h1 (its page title) and its section headings as h2", () => {
    const comp = (f: string) => readFileSync(join(ROOT, "components", "passport", f), "utf8");
    const lib = comp("Library.tsx");
    assert.ok(/export function PageTitle[\s\S]*?<h1 className="pp-t-page/.test(lib) && /export function SectionTitle[\s\S]*?<h2 className="pp-t-section/.test(lib));
    assert.ok(/export function SectionHeading[\s\S]*?as = "h2"/.test(comp("Drill.tsx")));
    for (const f of ["tabs/MenuTab.tsx", "tabs/IndexTab.tsx", "tabs/HomeTab.tsx", "tabs/InboxTab.tsx", "tabs/EventsTab.tsx"]) {
      // A tab's loading placeholder shows the same title while its data arrives (never both at once): left out here.
      const src = comp(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/function \w*Skeleton\(\) \{[\s\S]*?\n\}\n/g, "");
      const h1s = (src.match(/<h1\b/g) || []).length + (src.match(/<PageTitle\b/g) || []).length;
      assert.equal(h1s, 1, `${f}: ${h1s} page titles`);
      assert.ok(!/<h2 className="font-body text-\[1[01]px\]/.test(src), `${f}: no tiny small-caps h2`);
    }
  });

  console.log("File 14: the website's photos for the Bible");
  await test("only pictures in the site's own Supabase Storage are listed; titles carry the name", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    const list = photoList([
      { id: "a1", tabId: "t", title: "Pear Thee Well", active: true, carouselImageUrl: "https://abc.supabase.co/storage/v1/object/public/menu/pear.jpg", menuPageImageUrl: "https://evil.example/x.jpg" },
      { id: "a2", tabId: "t", title: "Off", active: false, carouselImageUrl: "https://abc.supabase.co/storage/v1/object/public/menu/off.jpg" },
      { id: "a3", tabId: "t", title: "Other project", active: true, carouselImageUrl: "https://zzz.supabase.co/storage/v1/object/public/menu/x.jpg" },
    ], [{ id: "t", label: "Fall", active: true }]);
    assert.deepEqual(list, [{ key: "a1/carousel", name: "Pear Thee Well", menu: "Fall", path: "/api/passport/website-photos/a1/carousel" }]);
    assert.equal(storageUrlOk("http://abc.supabase.co/storage/v1/object/public/x.jpg"), null);
    assert.equal(storageUrlOk("https://abc.supabase.co/rest/v1/menu_items"), null);
    assert.equal(storageUrlOk("https://abc.supabase.co.evil.example/storage/v1/object/public/x.jpg"), null);
  });
  await test("both routes answer only the Bible's key and never follow a redirect", () => {
    const r1 = readFileSync(join(ROOT, "app", "api", "passport", "website-photos", "route.ts"), "utf8");
    const r2 = readFileSync(join(ROOT, "app", "api", "passport", "website-photos", "[id]", "[which]", "route.ts"), "utf8");
    assert.ok(r1.includes("if (!fromBible(req))") && r2.includes("if (!fromBible(req))") && r2.includes('redirect: "manual"') && r2.includes("MAX_BYTES"));
  });


  // ── File 15 ────────────────────────────────────────────────────────────────
  console.log("File 15, Part A: names and where things live");
  const vote = (id: number, status: "open" | "closed", covers: { kind: "cocktail" | "bottle"; id: number; photo: string }[] = []) =>
    ({ kind: "flight" as const, id, title: `Vote ${id}`, status, line: "", winner: null, done: false, covers });
  const withVotes: IndexInput = { ...d, votes: [vote(1, "open", [{ kind: "bottle", id: 5000, photo: "b0" }]), vote(2, "open")], vote_results: [], past_votes_count: 3 };
  await test("CG Picks holds only curated things; votes and brackets are in Party Picks", () => {
    const cg = indexLevel({ ...withVotes, charts: [{ key: "top", title: "Top", season_name: "W", items: [] }] }, ["cg"]);
    assert.ok(cg.kind === "tiles" && !cg.tiles.some((t) => /vote/i.test(t.label)), "no votes in CG Picks");
    assert.equal(cg.title, "CG Picks");
    const p = indexLevel(withVotes, ["party"]);
    assert.ok(p.kind === "party" && p.open.length === 2 && p.past === 3);
    assert.deepEqual(p.trail.map((c) => c.label), ["Index", "Party Picks"]);
  });
  await test("the Party Picks banner sits above the tiles with its status line, and is absent when there is nothing", () => {
    const top = indexLevel(withVotes, []);
    assert.ok(top.kind === "tiles" && top.banner && top.banner.label === "Party Picks" && top.banner.line === "Voting is open: 2" && top.banner.section === "party");
    assert.equal(partyBanner({ votes: [], vote_results: [], past_votes_count: 4 })!.line, "See past votes");
    assert.equal(partyBanner({ votes: [], vote_results: [], past_votes_count: 0 }), null);
    const none = indexLevel(d, []);
    assert.ok(none.kind === "tiles" && !none.banner);
    assert.equal(rowsBeforeChoice(top), 4, "three rows of tiles and the banner");
  });
  await test("Journal holds For you, Favorites, My Cocktails, Notes, History, My photos", () => {
    const j = indexLevel(d, ["journal"]);
    assert.ok(j.kind === "tiles" && j.title === "Journal" && j.tiles.map((t) => t.label).join() === "For you,Favorites,My Cocktails,Notes,History,My photos");
  });
  await test("old addresses land in the new places", () => {
    assert.deepEqual(at("at=yours"), ["journal"]);
    assert.deepEqual(at("at=yours%2Ffor-you"), ["journal", "for-you"]);
    assert.deepEqual(at("at=cg%2Fvotes"), ["party"]);
    assert.deepEqual(at("", "#from-common-good"), ["cg"]);
    assert.deepEqual(normalizePath(["cg", "house"]), ["cg", "house"]);
    assert.equal(indexLevel(withVotes, ["cg", "votes"]).kind, "party", "Home's old See all link");
    assert.equal(indexLevel(d, ["yours", "for-you"]).kind, "for-you");
  });
  await test("Party Picks has its own accent from the site's palette (copper), passing the same tests as the others", () => {
    assert.equal(ACCENTS.party.edge, "#C97D5A");
    assert.equal(CARD_SECTIONS.vote, "party");
  });

  console.log("File 15, Part B: always a way back");
  await test("tapping the tab you are on: deep → its top level → scroll up → nothing (each of the five tabs)", () => {
    for (const tab of ["menu", "index", "home", "events", "inbox"] as const) {
      assert.equal(tabPress({ overlay: true, atRoot: false, scrollY: 900 }), "root", `${tab}: a page over it`);
      assert.equal(tabPress({ overlay: false, atRoot: false, scrollY: 0 }), "root", `${tab}: a deeper level`);
      assert.equal(tabPress({ overlay: false, atRoot: true, scrollY: 600 }), "top", `${tab}: scrolled down`);
      assert.equal(tabPress({ overlay: false, atRoot: true, scrollY: 0 }), "none", `${tab}: second tap at the top`);
    }
    assert.equal(isTabRoot("index", "/passport/library", "?at=lists"), false);
    assert.equal(isTabRoot("index", "/passport/library", ""), true);
    assert.equal(isTabRoot("menu", "/passport/menu", "?tab=spirits&s=Bourbon"), false);
    assert.equal(isTabRoot("menu", "/passport/menu", "?tab=spirits", false), false, "a Menu section other than the first");
    assert.equal(isTabRoot("menu", "/passport/menu", "", true), true);
    assert.equal(isTabRoot("inbox", "/passport/inbox/messages/3"), false);
    assert.equal(isTabRoot("inbox", "/passport/inbox"), true);
    assert.equal(isTabRoot("events", "/passport/events"), true);
    assert.equal(isTabRoot("home", "/passport/account"), false);
    assert.equal(isTabRoot("home", "/passport"), true);
  });
  await test("every route in the app has a parent in the navigation model (or is a tab's top level)", () => {
    const base = join(ROOT, "app", "passport", "(app)");
    const routes: string[] = [];
    const walk = (dir: string, rel: string) => {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) walk(full, rel ? `${rel}/${f}` : f);
        else if (f === "page.tsx" || f === "route.ts") routes.push(rel);
      }
    };
    walk(base, "");
    const known = new Set(PAGE_PARENTS.map((p) => p.route));
    for (const r of routes) {
      if (NOT_PAGES.includes(r) || r.startsWith("photo/")) continue;
      assert.ok(known.has(r), `${r} has no parent in nav.ts PAGE_PARENTS`);
    }
    const sample = (r: string) => `/passport/${r.replace(/\[key\]/, "top").replace(/\[id\]/g, "7")}`;
    for (const p of PAGE_PARENTS) { const got = parentOf(sample(p.route)); assert.ok(got && got.href === p.parent.href, `${p.route} → ${got?.href}`); }
    for (const tab of ["/passport", "/passport/menu", "/passport/library", "/passport/events", "/passport/inbox"]) assert.equal(parentOf(tab), null, tab);
  });
  await test("an Index level's Back is the trail's previous step; a Spirits level's goes up one", () => {
    assert.deepEqual(parentOf("/passport/library", "?at=cocktails%2Fspirit%2Fmezcal"), { href: indexHref(["cocktails", "spirit"]), label: "By spirit", tab: "index" });
    assert.equal(parentOf("/passport/library", "?at=journal")!.href, "/passport/library");
    assert.equal(parentOf("/passport/menu", "?tab=spirits&s=Bourbon%2FFox")!.label, "Bourbon");
    assert.equal(parentOf("/passport/menu", "?tab=spirits&s=Bourbon")!.label, "Spirits");
    assert.equal(parentOf("/passport/votes/4")!.label, "Party Picks");
    assert.equal(parentOf("/passport/house/4")!.label, "CG Picks");
    assert.equal(parentOf("/passport/favorites")!.label, "Journal");
    for (const l of allLevels(withVotes)) if (l.trail.length > 1) assert.ok(l.trail[l.trail.length - 2].href.startsWith("/passport/library"), l.path.join("/"));
  });

  console.log("File 15, Part C: covers like playlist art");
  const pic = (id: number, photo: string | null, cover = false) => ({ id, name: `I${id}`, photo, cover });
  await test("four photos, chosen stably: the cover-marked item first, then the collection's own order; never twice", () => {
    const xs = [pic(1, null), pic(2, "b"), pic(3, "c"), pic(4, "d", true), pic(5, "e"), pic(6, "f")];
    assert.deepEqual(coversOf(xs, "cocktail").map((c) => c.id), [4, 2, 3, 5]);
    assert.deepEqual(coversOf(xs, "cocktail").map((c) => c.id), coversOf([...xs], "cocktail").map((c) => c.id), "the same on every visit");
    assert.equal(coversOf(xs, "cocktail").length, COLLAGE_MAX);
    assert.deepEqual(coversOf([pic(1, "a"), pic(2, "b")], "bottle").map((c) => c.id), [1, 2], "two photos: a split of two");
    assert.deepEqual(coversOf([pic(1, null)], "bottle"), [], "none: the section's icon");
    assert.deepEqual(coversOf([pic(9, "z"), ...xs], "cocktail").map((c) => c.id), [4, 9, 2, 3], "changes when the collection changes");
  });
  await test("a transparent photo is marked so it is drawn without a box", () => {
    assert.equal(coversOf([{ id: 1, name: "x", photo: "p", photo_clear: true }], "bottle")[0].clear, true);
  });
  await test("several collections: one from each first (Lists, CG Picks, Party Picks)", () => {
    const a = [{ kind: "cocktail" as const, id: 1, photo: "a", name: "" }, { kind: "cocktail" as const, id: 2, photo: "b", name: "" }];
    const b = [{ kind: "bottle" as const, id: 1, photo: "c", name: "" }];
    assert.deepEqual(mergeCovers([a, b]).map((c) => `${c.kind}${c.id}`), ["cocktail1", "bottle1", "cocktail2"]);
  });
  await test("Spirits, Beer & wine, Journal and Party Picks tiles use their own items' photos", () => {
    const dd: IndexInput = { ...withVotes, drinks: [{ name: "Pils", kind: "Beer", description: "", status_label: null, available: true, id: 7001, photo: "pp" }], marks: { "cocktail:1": { kind: "cocktail", id: 1, favorite: true, rating: null } } };
    const top = indexLevel(dd, []);
    assert.ok(top.kind === "tiles");
    if (top.kind !== "tiles") return;
    const t = (id: string) => top.tiles.find((x) => x.id === id)!;
    assert.ok(t("spirits").covers.length > 0 && t("spirits").covers.every((c) => c.kind === "bottle"));
    assert.deepEqual(t("beer-wine").covers.map((c) => c.id), [7001]);
    assert.deepEqual(t("journal").covers.map((c) => c.id), [1], "Journal: the member's own favorites");
    assert.deepEqual(favoriteCovers({ ...dd, marks: {} }), []);
    assert.deepEqual(top.banner!.covers.map((c) => c.id), [5000]);
  });

  console.log("File 17: brand logos when there is no bottle photo");
  const logo = (id: number, photo: string | null, cover = false) => ({ id, name: `L${id}`, photo, cover, photo_logo: true });
  await test("a collage never uses a logo while any bottle photo exists in the collection", () => {
    assert.deepEqual(coversOf([logo(1, "a"), pic(2, "b"), logo(3, "c"), pic(4, "d")], "bottle").map((c) => c.id), [2, 4]);
    assert.deepEqual(coversOf([logo(1, "a", true), pic(2, "b")], "bottle").map((c) => c.id), [2], "an admin's cover mark on a logo is never used");
    assert.equal(coverOf([logo(1, "a"), pic(2, "b")], "bottle")!.id, 2, "a single cover: the real photo");
  });
  await test("a collection with only logos gets no collage (the section's icon, as with no photos)", () => {
    assert.deepEqual(coversOf([logo(1, "a"), logo(2, "b")], "bottle"), []);
    assert.equal(coverOf([logo(1, "a")], "bottle"), null);
    const groups: MenuGroup[] = [{ name: "Rye", items: [{ name: "L1", description: "", prices: [], cocktail_id: null, bottle_id: 1, unavailable: false, photo: "a", photo_logo: true }] }];
    const tabs = menuTabs({ exclusives: [], menus: [], spirits: { name: "Spirits", groups }, available: true });
    assert.equal(tabs.find((t) => t.id === SPIRITS_TAB)!.cover, null, "the Menu tab's Spirits cover is never a logo");
    assert.deepEqual(spiritCategories(spiritsFromIndex([{ id: 1, name: "L1", category: "Rye", status_label: null, available: true, photo: "a", photo_logo: true, on_list: true }], true)).map((c) => c.covers.length), [0]);
  });
  await test("the Spirits and Beer & wine tiles prefer real bottles too; a logo-only bottle still shows in lists", () => {
    const bottles: IndexBottle[] = [
      { id: 1, name: "L1", category: "Rye", status_label: null, available: true, photo: "a", photo_logo: true, on_list: true },
      { id: 2, name: "B2", category: "Rye", status_label: null, available: true, photo: "b", on_list: true },
    ];
    const dd: IndexInput = { ...withVotes, bottles, drinks: [{ name: "Pils", kind: "Beer", description: "", status_label: null, available: true, id: 7001, photo: "pp", photo_logo: true }] };
    const top = indexLevel(dd, []);
    assert.ok(top.kind === "tiles");
    if (top.kind !== "tiles") return;
    assert.deepEqual(top.tiles.find((x) => x.id === "spirits")!.covers.map((c) => c.id), [2]);
    assert.deepEqual(top.tiles.find((x) => x.id === "beer-wine")!.covers, []);
  });
  await test("Jump back in knows a logo, so it is drawn on the light panel (never cover-cropped)", () => {
    const d = { cocktails: [], bottles: [{ id: 1, name: "L1", category: "Rye", status_label: null, available: true, photo: "a", photo_logo: true }] as IndexBottle[] };
    assert.equal(jumpBackIn([{ kind: "bottle", id: 1, name: "L1" }], d)[0].photo_logo, true);
  });
  await test("every place a bottle picture is drawn passes photo_logo on (rows, tiles, page, search, shares, Bottles in this drink, lists, My bottles)", () => {
    const comp = (f: string) => readFileSync(join(ROOT, "components", "passport", f), "utf8");
    assert.ok(/RowThumb[^\n]*logo=\{b\.photo_logo\}/.test(comp("Drill.tsx")) && /logo=\{!it\.cocktail_id && it\.photo_logo\}/.test(comp("Drill.tsx")), "compact rows");
    assert.ok(comp("Library.tsx").includes("logo={r.photo_logo} logoLight={r.photo_logo_light} producer={b.producer}"), "the bottle page");
    assert.ok(/Bottles in this drink[\s\S]*logo=\{b\.photo_logo\}/.test(comp("Library.tsx")), "Bottles in this drink");
    assert.ok(comp("Search.tsx").includes("logo={b.photo_logo}"), "search results");
    assert.ok(comp("Social.tsx").includes('logo={s.kind === "bottle" && s.photo_logo}'), "shares and cards in Messages");
    assert.ok(comp("Rooms.tsx").includes("p.share.photo_logo"), "a share in a group or channel");
    assert.ok(comp("HouseList.tsx").includes("logo={it.photo_logo}"), "house lists");
    assert.ok(comp("Bottles.tsx").includes("logo={r.photo_logo}"), "My bottles");
    assert.ok(comp("ForYou.tsx").includes("logo={r.photo_logo}"), "For you");
    assert.ok(comp("tabs/IndexTab.tsx").includes("x.photo_logo") && comp("tabs/MenuTab.tsx").includes("photo_logo: x.photo_logo"), "Index and Menu");
  });
  await test("a logo is drawn on the light cream panel, contain-fit inside 15% padding, never on the dark tint", () => {
    const bits = readFileSync(join(ROOT, "components", "passport", "PhotoBits.tsx"), "utf8");
    const theme = readFileSync(join(ROOT, "components", "passport", "theme.ts"), "utf8");
    assert.ok(theme.includes('LOGO_PANEL = "#F5F0E8"') && ACCENTS.bar && bits.includes("background: LOGO_PANEL"));
    assert.ok(bits.includes('left: "15%", top: "15%", width: "70%", height: "70%"') && /LogoImg[\s\S]*object-contain/.test(bits) && !/LogoImg[^\n]*object-cover/.test(bits));
    assert.ok(bits.includes('loading={eager ? "eager" : "lazy"}'), "lazy by default");
    assert.ok(contrast("#1d1d1d", "#F5F0E8") > 7, "dark lettering reads on the panel");
  });

  // ── File 17b: light logos on a dark panel ──────────────────────────────────
  await test("a light logo is drawn on the dark panel (the site's Mid Olive), same corners, padding and contain-fit, with a hairline border", () => {
    const bits = readFileSync(join(ROOT, "components", "passport", "PhotoBits.tsx"), "utf8");
    const theme = readFileSync(join(ROOT, "components", "passport", "theme.ts"), "utf8");
    const brand = readFileSync(join(ROOT, "lib", "brandColors.ts"), "utf8");
    assert.ok(theme.includes('LOGO_PANEL_DARK = "#2A3020"') && /Mid Olive",\s*hex: "#2a3020"/i.test(brand), "the dark panel is from the public site's palette");
    assert.ok(theme.includes('LOGO_PANEL_DARK_EDGE = "#5A6A4A"') && /"#5a6a4a"/i.test(brand), "the hairline border is too");
    assert.ok(/light \? \{ background: LOGO_PANEL_DARK, boxShadow: `inset 0 0 0 1px \$\{LOGO_PANEL_DARK_EDGE\}` \} : \{ background: LOGO_PANEL \}/.test(bits), "light → dark panel; else cream");
    assert.ok(/size=\{size\} light=\{logoLight\}/.test(bits) && /aspect-\[2\/1\]" light=\{logoLight\}/.test(bits), "Thumb and the bottle page pass it");
    // White, cream and pale gold lettering read on the dark panel; the panel stands apart from the app background.
    for (const ink of ["#FFFFFF", "#F2E6C9", "#E6D08F"]) assert.ok(contrast(ink, "#2A3020") > 7, ink);
    assert.ok(contrast("#FFFFFF", "#F5F0E8") < 1.2, "white lettering would vanish on cream");
    assert.ok(deltaE("#2A3020", APP_BG) > 5, "the dark panel is distinguishable from the app background");
  });
  await test("every place a logo is drawn passes photo_logo_light on with photo_logo", () => {
    const comp = (f: string) => readFileSync(join(ROOT, "components", "passport", f), "utf8");
    const files = ["Drill.tsx", "Library.tsx", "Search.tsx", "Social.tsx", "HouseList.tsx", "Bottles.tsx", "ForYou.tsx", "tabs/IndexTab.tsx", "tabs/MenuTab.tsx"];
    for (const f of files) {
      const src = comp(f);
      const logos = src.match(/logo=\{[^{}]*photo_logo\}/g) || [];
      const lights = src.match(/logoLight=\{[^{}]*photo_logo_light\}/g) || [];
      assert.equal(lights.length, logos.length, `${f}: every logo= has its logoLight=`);
      assert.equal((src.match(/photo_logo: x\.photo_logo\b/g) || []).length, (src.match(/photo_logo_light: x\.photo_logo_light/g) || []).length, `${f}: object literals`);
    }
    assert.ok(comp("tabs/IndexTab.tsx").includes("light={x.photo_logo_light}"), "Jump back in");
    assert.ok(comp("Rooms.tsx").includes("p.share.photo_logo_light ? { photo_logo_light: true }"), "a share in a group or channel");
    const d = { cocktails: [], bottles: [{ id: 1, name: "L1", category: "Rye", status_label: null, available: true, photo: "a", photo_logo: true, photo_logo_light: true }, { id: 2, name: "L2", category: "Rye", status_label: null, available: true, photo: "b", photo_logo_light: true }] as IndexBottle[] };
    const j = jumpBackIn([{ kind: "bottle", id: 1, name: "L1" }, { kind: "bottle", id: 2, name: "L2" }], d);
    assert.equal(j[0].photo_logo_light, true);
    assert.equal(j[1].photo_logo_light, undefined, "never without photo_logo");
  });
  await test("light logos still never go into a collage or cover", () => {
    const logo = (id: number) => ({ id, name: `L${id}`, photo: "x", cover: true, photo_logo: true, photo_logo_light: true });
    assert.deepEqual(spiritCategories(spiritsFromIndex([{ ...logo(1), category: "Rye", status_label: null, available: true, on_list: true }] as IndexBottle[], true)).map((c) => c.covers.length), [0]);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
