// ─── Cocktail Competitions — defaults for a new event ────────────────────────
//
// Every one of these is editable per event in the admin panel. They are only
// the starting point a new event is created with.

import type { FieldDef, ScoreCategory, Superlative, Tier } from "./types";

export const DEFAULT_CONTACT_EMAIL = "hello@cgcocktails.com";
export const DEFAULT_LOCATION = "Common Good Cocktail House, Glen Ellyn";
export const DEFAULT_ACCENT = "#C97D5A";

export const DEFAULT_BARTENDER_FIELDS: FieldDef[] = [
  { id: "name", role: "name", type: "text", label: "Name", hint: "As you’d like it to appear to guests." },
  { id: "bar", role: "bar", type: "text", label: "Bar You Represent" },
  {
    id: "love",
    type: "textarea",
    label: "What do you love most about bartending?",
    hint: "A sentence or two is plenty.",
  },
  {
    id: "menu_pick",
    type: "textarea",
    label: "Which cocktail on your bar’s current menu should someone try—and why?",
    hint: "Give us your personal recommendation.",
  },
];

export const DEFAULT_COCKTAIL_FIELDS: FieldDef[] = [
  { id: "name", role: "name", type: "text", label: "Cocktail Name" },
  {
    id: "ingredients",
    type: "textarea",
    label: "Ingredients & Measurements",
    hint:
      "List each ingredient with its quantity and unit **for one full-size cocktail, not the guest sample or full batch**. Include the garnish and any finishing touches.",
  },
  {
    id: "inspiration",
    type: "textarea",
    label: "The Inspiration",
    hint: "What inspired this drink? Tell us about the idea, flavors, or story behind it.",
  },
];

export const DEFAULT_SCORE_CATEGORIES: ScoreCategory[] = [
  { id: "presentation", label: "Presentation" },
  { id: "flavor", label: "Flavor" },
  { id: "balance", label: "Balance" },
  { id: "creativity", label: "Creativity" },
];

export const DEFAULT_SUPERLATIVES: Superlative[] = [
  { id: "crowd_favorite", label: "Crowd Favorite" },
  { id: "best_name", label: "Best Cocktail Name" },
  { id: "best_garnish", label: "Best Garnish" },
  { id: "funniest", label: "Funniest Cocktail" },
];

export const DEFAULT_TIERS: Tier[] = [
  { id: "judges", label: "Judges", weight: 50, isJudge: true, count: 3 },
  { id: "vip", label: "VIP", weight: 20, isJudge: false, count: 0 },
  { id: "general", label: "General Admission", weight: 30, isJudge: false, count: 0 },
];

/**
 * The contestant rules, written by the owner. Placeholders in double braces
 * fill in from the event's settings — see fillTemplate().
 *
 * Formatting: "### " starts a heading, "- " a bullet, **bold**, *italic*.
 */
export const DEFAULT_RULES_TEXT = `### Here’s how the night works.

This is an **in-person cocktail competition** at {{location}}. You’ll prepare the same cocktail in two ways: **batched samples for guests** and **“hero” cocktails made live.**

Our staff will handle the guest pours so you can focus on presenting your drink, interacting with the judges, and having fun—not making dozens of individual cocktails.

### 1. Guest Samples — Batch Ahead of Time

Each guest will taste a sample of your cocktail, **typically a half-size serving, served in a plastic cup.**

Please arrive with these portions **already batched together in Cambros or deli containers** so our staff can quickly and easily pour them for guests while you make your hero cocktails.

We can provide **fresh citrus for you to add to your batch on site**. Apart from that final addition, your guest batch should be prepared before you arrive.

### 2. Hero Cocktails — Make Live at the Event

Your hero cocktails are the full-size, fully presented versions of your drink. You’ll make a handful of these live, present them to the judges, and show them to the guests.

Bring your chosen **glassware and complete garnishes**. These are your showpiece drinks, so feel free to go all out on presentation.

**Hero cocktails must not be pre-batched.** Prepare your individual ingredients—such as syrups and infusions—and garnishes ahead of time, but build the cocktails themselves live at the event.

### How Much to Prepare

We’ll email you before the event with the **exact number of guest samples to batch** and the **number of hero cocktails you’ll make live**.

Please account for both: your prepared guest batch **plus separate ingredients for your hero cocktails**.

### The Featured Spirit

Your cocktail should put **{{spirit}}** front and center.

We’ll provide the featured spirit you need for the event, including any used for infusions or advance prep. Email **{{email}}** with the quantity you need to arrange a pickup time.

### What You’re Responsible For

Bring your prepared guest batch, the ingredients needed to build your hero cocktails, your presentation glassware, and your prepped garnishes.

Aside from the featured spirit and fresh citrus we provide, **all other ingredients are your responsibility**, including other spirits, modifiers, syrups, and infusions. Please complete your ingredient and garnish prep before arrival.

### When to Arrive

Please arrive at **{{location}}**, by **{{arrival_time}}** on **{{date}}**.

### Your Submitted Content

Common Good may edit submitted content for clarity, length, or formatting before publication.

**Questions about prep or how your cocktail will be served?** Email **{{email}}** before the event so we can work through the details together.`;

/** The placeholders admins can use in the rules text, for the editor's help line. */
export const TEMPLATE_KEYS = ["spirit", "email", "location", "arrival_time", "date", "event"] as const;

export function formatEventDate(date: string | null): string {
  if (!date) return "the event date";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  });
}

export function fillTemplate(
  text: string,
  ev: {
    name: string;
    featuredSpirit: string;
    contactEmail: string;
    location: string;
    arrivalTime: string;
    eventDate: string | null;
  }
): string {
  const values: Record<string, string> = {
    spirit: ev.featuredSpirit || "the featured spirit",
    email: ev.contactEmail || DEFAULT_CONTACT_EMAIL,
    location: ev.location || DEFAULT_LOCATION,
    arrival_time: ev.arrivalTime || "the arrival time we’ll send you",
    date: formatEventDate(ev.eventDate),
    event: ev.name,
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) => values[key] ?? m);
}
