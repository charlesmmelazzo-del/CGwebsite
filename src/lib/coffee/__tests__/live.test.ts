// npm run test:coffee — Coffee 01: building the coffee page's tabs from the Bible's Toast feed.
// The feed here is a made-up sample (../__fixtures__/sample-coffee-feed.json), not the café's real menu.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeTabs, formatPrice, priceLine, sanitizeFeed, tabKind, groupLine, type CoffeeFeed, type TabInput } from "../live";

let checks = 0;
function test(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`  ✓ ${name}`);
}

const feed = sanitizeFeed(JSON.parse(readFileSync(join(__dirname, "../__fixtures__/sample-coffee-feed.json"), "utf8"))) as CoffeeFeed;
const TABS: TabInput[] = [
  { id: "coffee", label: "Coffee Menu", hasPdf: true },
  { id: "food", label: "Food Menu", hasPdf: true },
  { id: "ltd", label: "Limited Time Lattes", hasPdf: true },
];
const names = (t: { sections: { items: { name: string }[] }[] }) => t.sections.flatMap((s) => s.items.map((i) => i.name));
const PEACH = "i_0a1b2c3d4e43";
const HONEY = "i_0a1b2c3d4e44";
const MATCHA = "i_0a1b2c3d4e32";
const SPECIALTY = "s_0a1b2c3d4e04";

test("prices read 6.00, sizes 12 oz 3.00 / 16 oz 3.50", () => {
  assert.equal(formatPrice(6), "6.00");
  assert.equal(formatPrice(5.5), "5.50");
  assert.equal(priceLine([{ label: "12 oz", price: 3 }, { label: "16 oz", price: 3.5 }]), "12 oz 3.00 / 16 oz 3.50");
});

test("tab kinds come from the tab name", () => {
  assert.equal(tabKind("Food Menu"), "food");
  assert.equal(tabKind("Limited Time Lattes"), "limited");
  assert.equal(tabKind("LTD Lattes"), "limited");
  assert.equal(tabKind("Coffee Menu"), "coffee");
});

test("defaults: Food takes the Food sections, Coffee takes everything else, an LTD tab with no LTD section shows its PDF", () => {
  const { tabs } = composeTabs(TABS, feed);
  const [coffee, food, ltd] = tabs;
  assert.deepEqual(food.sections.map((s) => s.heading), ["Food", "Food Sweets"]);
  assert.deepEqual(coffee.sections.map((s) => s.heading), ["Espresso", "Drip & Pour Over", "Oat Milk Lattes", "Specialty Lattes", "Tea & More"]);
  assert.equal(coffee.showing, "live");
  assert.equal(ltd.showing, "pdf");
  assert.equal(ltd.sections.length, 0);
});

test("picking the two LTD lattes moves them off the Coffee Menu and onto the LTD tab", () => {
  const tabs = TABS.map((t) => (t.id === "ltd" ? { ...t, live: { items: [PEACH, HONEY], labels: { [SPECIALTY]: "Limited Time Lattes" } } } : t));
  const { tabs: out, notShown } = composeTabs(tabs, feed);
  assert.ok(!names(out[0]).includes("Ain't You Just A Peach"));
  assert.ok(!names(out[0]).includes("She's So Honey"));
  assert.ok(names(out[0]).includes("Earl Grey Latte"));
  assert.equal(out[2].showing, "live");
  assert.deepEqual(names(out[2]), ["Ain't You Just A Peach", "She's So Honey"]);
  assert.equal(out[2].sections[0].heading, "Limited Time Lattes");
  assert.equal(notShown.length, 0);
});

test("rename, note lines, hide, reorder and an item note (the matcha flavor line)", () => {
  const tabs = TABS.map((t) => (t.id === "coffee" ? { ...t, live: {
    labels: { s_0a1b2c3d4e03: "OAT MILK LATTES" },
    notes: { s_0a1b2c3d4e03: "Iced or Hot\n(Whole / Non-Fat / 2% Upon Request)" },
    hiddenSections: ["s_0a1b2c3d4e05"],
    hiddenItems: ["i_0a1b2c3d4e14"],
    order: ["s_0a1b2c3d4e03", "s_0a1b2c3d4e01"],
    itemNotes: { [MATCHA]: "Add any latte flavor +0.50" },
  } } : t));
  const { tabs: out, notShown } = composeTabs(tabs, feed);
  const c = out[0];
  assert.deepEqual(c.sections.map((s) => s.heading), ["OAT MILK LATTES", "Espresso", "Drip & Pour Over", "Specialty Lattes"]);
  assert.equal(c.sections[0].note, "Iced or Hot\n(Whole / Non-Fat / 2% Upon Request)");
  assert.equal(c.sections[0].items.find((i) => i.id === MATCHA)?.note, "Add any latte flavor +0.50");
  assert.ok(!names(c).includes("Cappuccino"));
  assert.ok(notShown.some((n) => n.name === "Cappuccino" && /hidden/.test(n.reason)));
  assert.ok(notShown.some((n) => n.name === "Hot Tea" && /section "Tea & More" is hidden/.test(n.reason)));
});

test("chosen sections replace the default, and a section on no tab is reported", () => {
  const tabs = TABS.map((t) => (t.id === "food" ? { ...t, live: { sections: ["s_0a1b2c3d4e06"] } } : t));
  const { tabs: out } = composeTabs(tabs, feed);
  assert.deepEqual(out[1].sections.map((s) => s.heading), ["Food"]);
  // The Coffee tab takes everything no other tab took, so Food Sweets moves to it.
  assert.ok(out[0].sections.some((s) => s.heading === "Food Sweets"));
  const onlyTwo = composeTabs([{ ...TABS[0], live: { sections: ["s_0a1b2c3d4e01"] } }, TABS[1]], feed);
  assert.ok(onlyTwo.notShown.some((n) => n.name === "Latte" && /isn't on any tab/.test(n.reason)));
});

test("Show PDF instead: on shows the PDF, off always the live menu (tidy empty state when empty)", () => {
  const on = composeTabs([{ ...TABS[0], live: { showPdf: true } }], feed).tabs[0];
  assert.equal(on.showing, "pdf");
  assert.equal(on.sections.length, 0);
  const off = composeTabs([TABS[0], { ...TABS[2], live: { showPdf: false } }], feed).tabs[1];
  assert.equal(off.showing, "empty");
});

test("no feed at all: every tab falls back to its PDF (never blank when there is one)", () => {
  const { tabs } = composeTabs(TABS, null);
  assert.ok(tabs.every((t) => t.showing === "pdf"));
  assert.equal(composeTabs([{ id: "x", label: "Coffee Menu" }], null).tabs[0].showing, "empty");
});

test("sanitizeFeed keeps only guest fields and drops malformed entries", () => {
  const f = sanitizeFeed({
    updated_at: "2026-11-26T10:00:00Z", menu_read_at: "nope",
    sections: [
      { id: "s_abcdef012345", name: "Espresso", ordinal: 0, cost: 1, items: [
        { id: "i_abcdef012345", name: "Shot", description: "x", prices: [{ label: null, price: 3 }], cost: 0.4, guid: "12345678-1234-1234-1234-123456789012" },
        { id: "12345678-1234-1234-1234-123456789012", name: "Bad id", prices: [{ label: null, price: 3 }] },
        { id: "i_abcdef0123ff", name: "No price", prices: [] },
      ] },
      { id: "bad", name: "Bad", items: [] },
    ],
  });
  assert.ok(f);
  assert.equal(f!.menu_read_at, null);
  assert.equal(f!.sections.length, 1);
  assert.deepEqual(Object.keys(f!.sections[0].items[0]).sort(), ["addon_groups", "description", "id", "name", "ordinal", "prices"]);
  assert.equal(f!.sections[0].items.length, 1);
  assert.equal(sanitizeFeed({ error: "x" }), null);
});

// ── Coffee 02 ────────────────────────────────────────────────────────────────
const F2 = sanitizeFeed({
  updated_at: "2026-11-27T10:00:00Z", menu_read_at: "2026-11-27T10:00:00Z",
  sections: [
    { id: "s_000000000001", name: "Specialty Lattes", ordinal: 0,
      addon_groups: [{ name: "Milk Option", price: null, options: ["Whole", "2%", "Oat"] }, { name: "Temperature Option", price: null, options: ["Iced", "Hot"] }, { name: "FIRE: Kitchen", price: null, options: ["Rush"] }],
      items: [{ id: "i_000000000011", name: "Madagascar Vanilla", description: "", prices: [{ label: null, price: 6 }], ordinal: 0, addon_groups: [] }] },
    { id: "s_000000000002", name: "Tea", ordinal: 1, addon_groups: [], items: [
      { id: "i_000000000021", name: "Masala Chai Latte", description: "", prices: [{ label: null, price: 5 }], ordinal: 0, addon_groups: [] },
      { id: "i_000000000022", name: "Matcha Latte", description: "", prices: [{ label: null, price: 6 }], ordinal: 1, addon_groups: [{ name: "Syrup Flavors", price: 0.5, options: ["Madagascar Vanilla", "Charred Cinnamon"] }] },
      { id: "i_000000000023", name: "Jasmine Blossom Hot Green Tea", description: "", prices: [{ label: null, price: 4 }], ordinal: 2, addon_groups: [] },
      { id: "i_000000000024", name: "Iced Rishi Black Tea", description: "", prices: [{ label: null, price: 4 }], ordinal: 3, addon_groups: [] },
      { id: "i_000000000025", name: "New Tea From Toast", description: "", prices: [{ label: null, price: 4 }], ordinal: 4, addon_groups: [] },
    ] },
  ],
}) as CoffeeFeed;
const ONE: TabInput[] = [{ id: "coffee", label: "Coffee Menu", hasPdf: true }];

test("option lines: friendly names, Iced or Hot, flavor price; kitchen groups never pass", () => {
  assert.equal(groupLine({ name: "Milk Option", price: null, options: ["Whole", "Oat"] }), "Milk options: Whole, Oat");
  assert.equal(groupLine({ name: "Temperature Option", price: null, options: ["Iced", "Hot"] }), "Iced or Hot");
  assert.equal(groupLine({ name: "Syrup Flavors", price: 0.5, options: ["A", "B"] }), "Available syrup flavors (+0.50): A, B");
  assert.equal(groupLine({ name: "Milk Option", price: null, options: ["Whole"] }, "Milks"), "Milks: Whole");
  const lattes = composeTabs(ONE, F2).tabs[0].sections[0];
  assert.deepEqual(lattes.options, ["Milk options: Whole, 2%, Oat", "Iced or Hot"]);
  assert.ok(!JSON.stringify(F2).includes("Kitchen"));
});

test("item-level groups show under the item; the admin can rename or hide a group", () => {
  const tea = composeTabs(ONE, F2).tabs[0].sections[1];
  assert.deepEqual(tea.items.find((i) => i.name === "Matcha Latte")!.flavors, ["Available syrup flavors (+0.50): Madagascar Vanilla, Charred Cinnamon"]);
  const cfg = { groupLabels: { "Syrup Flavors": "Add a flavor" }, hiddenGroups: ["temperature option"] };
  const t = composeTabs([{ ...ONE[0], live: cfg }], F2).tabs[0];
  assert.deepEqual(t.sections[0].options, ["Milk options: Whole, 2%, Oat"]);
  assert.deepEqual(t.sections[1].items.find((i) => i.name === "Matcha Latte")!.flavors, ["Add a flavor (+0.50): Madagascar Vanilla, Charred Cinnamon"]);
});

test("display sections split Toast's Tea without losing a new item", () => {
  const live = { displaySections: [
    { id: "d_00000000000a", heading: "Tea Lattes", items: ["i_000000000021", "i_000000000022"] },
    { id: "d_00000000000b", heading: "Hot Tea", items: ["i_000000000023"] },
    { id: "d_00000000000c", heading: "Iced Tea", items: ["i_000000000024"] },
  ] };
  const { tabs, notShown } = composeTabs([{ ...ONE[0], live }], F2);
  const heads = tabs[0].sections.map((s) => s.heading);
  assert.deepEqual(heads, ["Specialty Lattes", "Tea", "Tea Lattes", "Hot Tea", "Iced Tea"]);
  assert.deepEqual(tabs[0].sections[1].items.map((i) => i.name), ["New Tea From Toast"]);
  assert.equal(notShown.length, 0);
  assert.ok(tabs[0].sections[2].items.find((i) => i.name === "Matcha Latte")!.flavors[0].startsWith("Available syrup flavors"));
});

test("Toast subgroups under Food (partners) stay on the Food tab", () => {
  const f = sanitizeFeed({ updated_at: null, menu_read_at: null, sections: [
    { id: "s_00000000aa01", name: "Specialty Lattes", group: "Specialty Lattes", ordinal: 0, items: [{ id: "i_00000000aa11", name: "Latte", description: "", prices: [{ label: null, price: 6 }], ordinal: 0 }] },
    { id: "s_00000000aa02", name: "Bang Bang Pie & Biscuits", group: "Food", ordinal: 1, items: [{ id: "i_00000000aa21", name: "Scratch Biscuit", description: "", prices: [{ label: null, price: 5 }], ordinal: 0 }] },
  ] }) as CoffeeFeed;
  const { tabs } = composeTabs([{ id: "coffee", label: "Coffee Menu" }, { id: "food", label: "Food Menu" }], f);
  assert.deepEqual(tabs[1].sections.map((s) => s.heading), ["Bang Bang Pie & Biscuits"]);
  assert.deepEqual(tabs[0].sections.map((s) => s.heading), ["Specialty Lattes"]);
});

test("a display section shows the options its items share once, under the heading", () => {
  const live = { displaySections: [{ id: "d_00000000000f", heading: "Limited", items: ["i_000000000011"] }] };
  const t = composeTabs([{ ...ONE[0], live }], F2).tabs[0];
  const d = t.sections.find((s) => s.heading === "Limited")!;
  assert.deepEqual(d.options, ["Milk options: Whole, 2%, Oat", "Iced or Hot"]);
  assert.deepEqual(d.items[0].flavors, []);
});

console.log(`\n${checks} passed`);
