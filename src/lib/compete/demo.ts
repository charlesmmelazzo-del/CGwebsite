// ─── The Cascahuín demo competition ──────────────────────────────────────────
//
// A complete, realistic event for trying the feature end to end on the test
// site: an approved brand partner with real Cascahuín product info and photos
// (bundled in public/compete/demo), six fictional contestants with their
// cocktails, three at-home recipes, and ticket codes for every tier.
//
// Created (or reset) from Admin → Competitions → "Create demo event". Every
// person and bar here is made up.

import { getSupabaseAdmin } from "@/lib/supabase";
import { createEvent, generateCodes, getEventById, getEventBySlug, newToken } from "./data";
import type { Answers, Recipe, SponsorProfile, Tier } from "./types";

export const DEMO_SLUG = "cascahuin-cup-demo";
const IMG = "/compete/demo";

const PROFILE: SponsorProfile = {
  brandName: "Tequila Cascahuín",
  logoUrl: `${IMG}/logo.webp`,
  tagline: "Family-made tequila from El Arenal, Jalisco — since 1904.",
  story:
    "Cascahuín has been making tequila in El Arenal, Jalisco, since 1904. The name comes from a pre-Hispanic phrase usually translated as “hill of light” or “celebration on the hill,” chosen by founder Salvador Rosales Briseño.\n\nThe Rosales family still runs the distillery today, in the region known as the gateway to the agave landscape. Their agave is cooked slowly in traditional stone ovens, which gives every expression its signature cooked-agave sweetness, bright citrus, and the mineral notes of El Arenal’s soil.\n\nTheir Tahona expression goes a step further: the cooked agave is crushed with a tahona, the traditional volcanic stone wheel, for a richer and more complex spirit. It’s tequila made the way it was a century ago, and it has become a favorite of bartenders everywhere.",
  photos: [`${IMG}/jima-1.webp`, `${IMG}/historic.webp`, `${IMG}/jima-2.webp`, `${IMG}/jima-3.webp`],
  products: [
    {
      id: "blanco",
      name: "Cascahuín Blanco",
      category: "Blanco Tequila · 100% Blue Weber Agave",
      origin: "El Arenal, Jalisco",
      abv: "42% ABV",
      howMade: "Agave cooked in traditional stone ovens, then fermented and distilled at the family distillery.",
      tastingNotes: "Cooked agave, fresh citrus, and a distinct mineral finish from the soil of El Arenal.",
      photoUrl: `${IMG}/blanco.webp`,
    },
    {
      id: "plata48",
      name: "Cascahuín Plata 48",
      category: "Blanco Tequila · Still Strength",
      origin: "El Arenal, Jalisco",
      abv: "48% ABV",
      howMade:
        "Bottled without dilution or filtration, in honor of founder Salvador Rosales Briseño. Each production batch is no larger than 2,500 liters.",
      tastingNotes: "Bigger and more complex — concentrated agave, pepper, and herbs.",
      photoUrl: `${IMG}/plata48.webp`,
    },
    {
      id: "tahona",
      name: "Cascahuín Tahona",
      category: "Blanco Tequila · Tahona-Crushed",
      origin: "El Arenal, Jalisco",
      abv: "42% ABV",
      howMade: "Juice extracted entirely with a tahona, the traditional volcanic stone wheel used to crush cooked agave.",
      tastingNotes: "Sweet cooked agave up front, with a rounder, earthier body.",
      photoUrl: `${IMG}/tahona.webp`,
    },
    {
      id: "reposado",
      name: "Cascahuín Reposado",
      category: "Reposado Tequila",
      origin: "El Arenal, Jalisco",
      howMade: "Rested six to eight months in American oak barrels that have aged tequila for more than 20 years.",
      tastingNotes: "Cooked agave and minerality, softened with gentle oak.",
      photoUrl: `${IMG}/reposado.webp`,
    },
    {
      id: "anejo",
      name: "Cascahuín Añejo",
      category: "Añejo Tequila",
      origin: "El Arenal, Jalisco",
      howMade: "Aged 14 to 16 months in American oak barrels.",
      photoUrl: `${IMG}/anejo.webp`,
    },
    {
      id: "extra",
      name: "Cascahuín Extra Añejo",
      category: "Extra Añejo Tequila",
      origin: "El Arenal, Jalisco",
      howMade: "Forty-eight months in American oak, then rested four more years in the distillery’s decades-old vats.",
      tastingNotes: "Sweet barrel notes and a touch of astringency over a robust cooked-agave finish.",
      photoUrl: `${IMG}/extra-anejo.webp`,
    },
  ],
  links: {
    website: "https://www.tequilacascahuin.com",
    instagram: "@tequilacascahuin",
  },
};

type DemoContestant = { bartender: Answers; cocktail: Answers; email: string; phone: string };

const CONTESTANTS: DemoContestant[] = [
  {
    email: "maya.demo@example.com",
    phone: "630-555-0101",
    bartender: {
      name: "Maya Ortiz",
      bar: "The Copper Fox",
      love: "Watching someone’s face when the first sip lands. Bartending is hospitality first — the drink is just how I say hello.",
      menu_pick:
        "The Garden Party — gin, cucumber, elderflower, and a little black pepper. It’s the drink I make for people who swear they don’t like gin.",
    },
    cocktail: {
      name: "Cerro de Luz",
      ingredients:
        "1½ oz Cascahuín Blanco\n1 oz fresh pink grapefruit\n½ oz fresh lime\n½ oz hibiscus–cinnamon syrup\nTop with 2 oz soda\nGarnish: smoked salt half-rim, grapefruit swath",
      inspiration:
        "Cascahuín means “hill of light,” so I wanted a drink that glows. Hibiscus gives it a sunset color, grapefruit keeps it bright, and the smoked salt is a nod to the stone ovens.",
    },
  },
  {
    email: "jordan.demo@example.com",
    phone: "630-555-0102",
    bartender: {
      name: "Jordan Reyes",
      bar: "Lantern & Lime",
      love: "The rush of a full rail on a Saturday. Every ticket is a tiny puzzle, and the team feels like a band.",
      menu_pick: "Smoke Signals — mezcal, pineapple, Campari, and lime. Bitter, smoky, tropical. Trust me.",
    },
    cocktail: {
      name: "Tahona Two-Step",
      ingredients:
        "2 oz Cascahuín Plata 48\n¾ oz pineapple–habanero shrub\n¾ oz fresh lime\n¼ oz agave syrup\n6 cilantro leaves (shaken)\nGarnish: pineapple frond, Tajín dust",
      inspiration:
        "My grandfather danced at every family party. This drink is a little sweet, a little spicy, and it doesn’t sit still — the Plata 48 has the backbone to lead.",
    },
  },
  {
    email: "priya.demo@example.com",
    phone: "630-555-0103",
    bartender: {
      name: "Priya Natarajan",
      bar: "Hollow Oak Tavern",
      love: "Stirred drinks. There’s nowhere to hide — just you, the ice, and patience.",
      menu_pick:
        "The Library Card — rye, amaro, and a cardamom tincture. It tastes like a leather armchair in the best way.",
    },
    cocktail: {
      name: "Slow Burn Sunday",
      ingredients:
        "2 oz Cascahuín Reposado\n¼ oz piloncillo syrup\n2 dashes mole bitters\n1 dash orange bitters\nGarnish: expressed orange peel, cinnamon stick",
      inspiration:
        "Sunday mornings at my neighbor’s house meant café de olla. This is that memory, stirred down — piloncillo, cinnamon, and a reposado that already tastes like home.",
    },
  },
  {
    email: "theo.demo@example.com",
    phone: "630-555-0104",
    bartender: {
      name: "Theo Lindqvist",
      bar: "Juniper Room",
      love: "Making something that looks simple and tastes complicated.",
      menu_pick: "Our house martini, 50/50 with a lemon twist. Order it ice cold and thank me later.",
    },
    cocktail: {
      name: "The Green Room",
      ingredients:
        "2 oz Cascahuín Tahona\n¾ oz blanc vermouth\n¼ oz celery–lime shrub\n1 barspoon olive brine\nGarnish: Castelvetrano olive and a celery leaf",
      inspiration:
        "A tequila martini for people who love savory drinks. The Tahona’s earthy sweetness plays perfectly with celery and olive — it’s the backstage drink before the show.",
    },
  },
  {
    email: "dani.demo@example.com",
    phone: "630-555-0105",
    bartender: {
      name: "Dani Brooks",
      bar: "The Velvet Owl",
      love: "Late nights and regulars. I love being part of someone’s ritual.",
      menu_pick: "The Night Owl — espresso, amaro, and vanilla. It’s dessert and a second wind in one glass.",
    },
    cocktail: {
      name: "Midnight at the Mercado",
      ingredients:
        "1½ oz Cascahuín Añejo\n1½ oz house horchata\n½ oz cinnamon demerara syrup\n1 whole egg\nGarnish: freshly grated nutmeg and a cinnamon-sugar rim",
      inspiration:
        "Walking through a night market with a cup of horchata. The añejo brings vanilla and oak, the egg makes it plush — it’s a nightcap that tastes like a memory.",
    },
  },
  {
    email: "marcus.demo@example.com",
    phone: "630-555-0106",
    bartender: {
      name: "Marcus Bell",
      bar: "Sundial Social",
      love: "Tiki! Big flavors, big garnishes, and nobody takes themselves too seriously.",
      menu_pick: "The Sundial Swizzle — three rums, falernum, mint, and crushed ice. It’s a vacation.",
    },
    cocktail: {
      name: "Fiesta en el Cerro",
      ingredients:
        "1½ oz Cascahuín Tahona\n¾ oz passion fruit syrup\n¾ oz fresh lime\n½ oz falernum\n½ oz Cascahuín Plata 48 float\nGarnish: mint bouquet, dehydrated lime wheel, edible flower",
      inspiration:
        "The other translation of Cascahuín is “celebration on the hill” — so I built a party in a glass. Tiki structure, tequila soul, and a Plata 48 float to light it up.",
    },
  },
];

const RECIPES: Recipe[] = [
  {
    id: "paloma",
    name: "Cascahuín Paloma",
    description: "The highball Mexico actually drinks. Bright, salty, and endlessly refreshing.",
    ingredients:
      "2 oz Cascahuín Blanco\n½ oz fresh lime juice\nPinch of salt\n4 oz grapefruit soda\nGarnish: grapefruit wedge",
    method:
      "Add tequila, lime, and salt to a tall glass. Fill with ice, top with grapefruit soda, and stir gently. Garnish with a grapefruit wedge.",
  },
  {
    id: "ranch-water",
    name: "Tahona Ranch Water",
    description: "Three ingredients, zero fuss — and the Tahona makes it taste like more.",
    ingredients: "2 oz Cascahuín Tahona\n¾ oz fresh lime juice\n4 oz mineral water (Topo Chico)\nGarnish: lime wheel",
    method:
      "Fill a highball glass with ice. Add tequila and lime juice, top with mineral water, and give it one gentle stir. Garnish with a lime wheel.",
  },
  {
    id: "repo-old-fashioned",
    name: "Reposado Old Fashioned",
    description: "A slow sipper for cold Glen Ellyn nights.",
    ingredients:
      "2 oz Cascahuín Reposado\n¼ oz agave syrup\n2 dashes Angostura bitters\n1 dash orange bitters\nGarnish: orange peel",
    method:
      "Add everything to a mixing glass with ice and stir for 20–30 seconds until well chilled. Strain over a large ice cube in a rocks glass. Express an orange peel over the top and drop it in.",
  },
];

const TIERS: Tier[] = [
  { id: "judges", label: "Judges", weight: 50, isJudge: true, count: 3 },
  { id: "vip", label: "VIP", weight: 20, isJudge: false, count: 10 },
  { id: "general", label: "General Admission", weight: 30, isJudge: false, count: 40 },
];

const JUDGE_NAMES = ["Elena Park", "Sam Whitaker", "Rosa Delgado"];

/** Create the demo — replacing any earlier copy, so this doubles as "reset". */
export async function createDemoEvent(): Promise<{ id: string; slug: string }> {
  const sb = getSupabaseAdmin();
  const old = await getEventBySlug(DEMO_SLUG);
  if (old) await sb.from("comp_events").delete().eq("id", old.id);

  const created = await createEvent({ name: "The Cascahuín Cup", isDemo: true });
  const now = new Date().toISOString();

  await sb
    .from("comp_events")
    .update({
      slug: DEMO_SLUG,
      featured_spirit: "Tequila Cascahuín",
      event_date: "2026-10-22",
      start_time: "7:00 PM",
      arrival_time: "5:30 PM",
      intro:
        "Six of the area’s best bartenders, one legendary tequila. Taste each cocktail, score it live from your phone, and help crown the winner.",
      accent_color: "#B8975A",
      status: "published",
      contestant_deadline: "2026-10-15T23:59:00-05:00",
      partner_deadline: "2026-10-12T23:59:00-05:00",
      recipes: RECIPES,
      tiers: TIERS,
      big_screen: true,
    })
    .eq("id", created.id);

  await sb.from("comp_sponsors").insert([
    {
      event_id: created.id,
      token: newToken(),
      sort: 0,
      is_primary: true,
      label: "Cascahuín",
      status: "approved",
      contact: { name: "Demo Contact", email: "partner.demo@example.com", phone: "" },
      profile: PROFILE,
      submitted_at: now,
      approved_at: now,
    },
    {
      event_id: created.id,
      token: newToken(),
      sort: 1,
      is_primary: false,
      label: "Co-sponsor (demo — not submitted yet)",
      status: "invited",
    },
  ]);

  await sb.from("comp_contestants").insert(
    CONTESTANTS.map((c, i) => ({
      event_id: created.id,
      token: newToken(),
      sort: i,
      label: c.bartender.name,
      status: "approved",
      contact: { email: c.email, phone: c.phone },
      bartender: c.bartender,
      cocktail: c.cocktail,
      agreed_at: now,
      submitted_at: now,
      approved_at: now,
    }))
  );

  const ev = await getEventById(created.id);
  if (ev) {
    await generateCodes(ev);
    const { data: judges } = await sb
      .from("comp_codes")
      .select("id")
      .eq("event_id", ev.id)
      .eq("tier_id", "judges")
      .order("created_at");
    await Promise.all(
      (judges ?? []).map((j, i) => sb.from("comp_codes").update({ name: JUDGE_NAMES[i] ?? `Judge ${i + 1}` }).eq("id", j.id))
    );
  }
  return { id: created.id, slug: DEMO_SLUG };
}
