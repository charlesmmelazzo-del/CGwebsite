// npm run test:passport (second part) — file 14: nested navigation, section accents (Part 7) and the type scale (Part 8).
// Every check is on the models in lib/passport (nav.ts, accents.ts, typescale.ts), never on pixels.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXCLUSIVES_TAB, NOW_ALBUM, PRODUCER_THRESHOLD, ROW_LIMIT, SPIRITS_TAB, allLevels, chosenTab, coverOf, indexHref, indexLevel, indexPathOf, isFinal,
  jumpBackIn, letterOf, menuTabs, monogram, parseAt, pathOfHref, rowsBeforeChoice, shortLine, spiritCategories, spiritLevel, spiritsFromIndex, type IndexInput, type SpiritEntry,
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
    assert.equal(monogram("Beer, Wine, Cider"), "Bw");
    assert.equal(monogram("Spirits"), "Sp");
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
    assert.equal(tiles[0].cover, null);
    assert.equal(tiles[1].cover!.id, 99);
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
      assert.deepEqual(top.tiles.map((t) => t.label), ["Cocktails", "Spirits", "Beer & wine", "Lists", "From Common Good", "Yours"]);
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
  await test("Beer & wine, Lists, From Common Good (only tiles that have something) and Yours", () => {
    const bw = indexLevel(d, ["beer-wine"]);
    assert.ok(bw.kind === "tiles" && bw.tiles.map((t) => t.label).join() === "Beer,Wine");
    const cg = indexLevel(d, ["cg"]);
    assert.ok(cg.kind === "tiles" && cg.tiles.map((t) => t.label).join() === "House lists,Past lists");
    assert.equal(indexLevel(d, ["cg", "staff"]).kind, "missing", "no staff picks: no tile, and an old link says so");
    const y = indexLevel(d, ["yours"]);
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
    for (const [h, p] of [["#lists", "lists"], ["#from-common-good", "cg"], ["#yours", "yours"], ["#cocktails", "cocktails"], ["#spirits", "spirits"], ["#beer-wine", "beer-wine"]]) assert.deepEqual(at("", h), [p]);
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
  await test("section heading ≥ 1.3 × body; body ≥ 16px; secondary ≥ 14px; page title above the section heading", () => {
    assert.ok(px(TYPE.section) / px(TYPE.body) >= 1.3);
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
  await test("each tab draws exactly one h1 (its page title) and its section headings as h2", () => {
    const comp = (f: string) => readFileSync(join(ROOT, "components", "passport", f), "utf8");
    const lib = comp("Library.tsx");
    assert.ok(/export function PageTitle[\s\S]*?<h1 className="pp-t-page/.test(lib) && /export function SectionTitle[\s\S]*?<h2 className="pp-t-section/.test(lib));
    assert.ok(/export function SectionHeading[\s\S]*?as = "h2"/.test(comp("Drill.tsx")));
    for (const f of ["tabs/MenuTab.tsx", "tabs/IndexTab.tsx", "tabs/HomeTab.tsx", "tabs/InboxTab.tsx", "tabs/EventsTab.tsx"]) {
      const src = comp(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      const h1s = (src.match(/<h1\b/g) || []).length + (src.match(/<PageTitle\b/g) || []).length - (f.endsWith("IndexTab.tsx") ? 1 : 0); // IndexTab's skeleton shows the same title while loading
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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
