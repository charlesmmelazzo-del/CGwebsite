/**
 * File 14, Part 7: one accent colour per section of the guest app, taken only from the public site's own palette
 * (tailwind.config.ts "theme-*" pairs and src/lib/brandColors.ts) or tints and shades of it. The dark background and the
 * brass stay the app's own colours (primary buttons, the CG button, the current tab); the green "available now" dot
 * keeps its meaning and is kept well apart from every accent (checked in the tests).
 *
 * Each section has three tones:
 *   tint  a soft card background: the brand theme's dark colour laid over the app background
 *   edge  the strong tone, for a card's left edge and a section heading (the brand theme's "text" colour)
 *   ink   the colour of the small label on the tint (the same "text" colour; AA against the tint, tested)
 * Plain functions and constants only (shared by server and browser code, and by the tests).
 */
export type SectionId = "cocktails" | "spirits" | "beer-wine" | "events" | "inbox" | "friends" | "bar" | "yours" | "party";

export const APP_BG = "#13170F";
export const APP_CARD = "#1B2016";
export const BRASS = "#C9A96E";
export const GREEN_DOT = "#86C07A";

/** The public site's palette (brandColors.ts): each theme's dark, muted and text colours. */
export const BRAND = {
  terracotta: { dark: "#9D5242", muted: "#b07868", text: "#D4A898" },
  amber: { dark: "#866515", muted: "#a08030", text: "#D4B870" },
  plum: { dark: "#4E3456", muted: "#8a6892", text: "#C0A0C8" },
  blue: { dark: "#364260", muted: "#5a72a0", text: "#90A8C8" },
  teal: { dark: "#2F4A4E", muted: "#5a8a8e", text: "#90B8BC" },
  green: { dark: "#3B5040", muted: "#6a8a72", text: "#A8C4A0" },
  olive: { dark: "#2a3020", muted: "#5a6a4a", text: "#8A9A78" },
  cream: { dark: "#F5F0E8", muted: "#F5F0E8", text: "#F5F0E8" },
  // File 15: the site's "Accent / CTA" copper, the one colour of its palette no section used yet (Party Picks).
  copper: { dark: "#C97D5A", muted: "#C97D5A", text: "#C97D5A" },
} as const;

// ── Colour arithmetic (sRGB, WCAG 2.x) ───────────────────────────────────────
const rgb = (hex: string) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hexOf = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
/** `amount` of colour a laid over colour b (0 = all b, 1 = all a). */
export const mix = (a: string, b: string, amount: number) => { const x = rgb(a); const y = rgb(b); return hexOf(x.map((v, i) => v * amount + y[i] * (1 - amount))); };
const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = (hex: string) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** How far apart two colours look (CIE76 ΔE in Lab): about 2 is barely visible, above 20 clearly different. */
export function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const [r, g, bl] = rgb(hex).map(lin);
    const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const X = f((0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047);
    const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * bl);
    const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const p = lab(a); const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

export interface Accent { id: SectionId; label: string; brand: keyof typeof BRAND; tint: string; edge: string; ink: string }
const make = (id: SectionId, label: string, brand: keyof typeof BRAND, tintAmount = 0.26, edgeTone: "text" | "muted" = "text"): Accent => {
  const b = BRAND[brand];
  // Cream has no dark tone of its own: its tint is a faint wash of cream, its strong tone cream itself.
  // Copper has only one tone too: its tint is a low wash of it (12%), dark enough for body text at AA.
  const tint = brand === "cream" ? mix(b.text, APP_BG, 0.07) : brand === "copper" ? mix(b.text, APP_BG, 0.12) : mix(b.dark, APP_BG, tintAmount);
  return { id, label, brand, tint, edge: b[edgeTone], ink: b.text };
};

/** One accent per section (the brand theme it comes from in brackets in the comment). */
export const ACCENTS: Record<SectionId, Accent> = {
  cocktails: make("cocktails", "Cocktails", "terracotta", 0.3), // terracotta
  // Golden amber. Its edge is the deeper amber (#a08030) so a spirits card never reads as the brass of the app's own
  // buttons; its small label keeps the lighter amber for contrast.
  spirits: make("spirits", "Spirits", "amber", 0.3, "muted"),
  "beer-wine": make("beer-wine", "Beer & wine", "plum", 0.45), // deep plum
  events: make("events", "Events", "blue", 0.45), // steel blue
  inbox: make("inbox", "Messages", "teal", 0.5), // dark teal (file 16: the Inbox is now Messages)
  friends: make("friends", "Friends", "green", 0.4), // forest green
  // File 15: "From the bar" cream stays on CG Picks (the bar's curated lists) and the bar's messages.
  bar: make("bar", "CG Picks", "cream"), // cream
  yours: make("yours", "Journal", "olive", 0.7), // olive (file 15: "Yours" is now "Journal")
  // File 15: Party Picks (votes, brackets, anything a member takes part in): the site's Accent / CTA copper.
  party: make("party", "Party Picks", "copper"), // copper
};
export const SECTION_IDS = Object.keys(ACCENTS) as SectionId[];

/** CSS custom properties for the app root: --pp-<section>-tint / -edge / -ink. */
export function accentVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of Object.values(ACCENTS)) { out[`--pp-${a.id}-tint`] = a.tint; out[`--pp-${a.id}-edge`] = a.edge; out[`--pp-${a.id}-ink`] = a.ink; }
  return out;
}

/**
 * Every kind of card the app shows on Home and in the Index, and the one section it belongs to. Status chips (ready,
 * waiting, declined…) are not sections: they keep their own meaning colours, drawn as outlined pills with words, never
 * as a tinted card with a coloured edge.
 */
export const CARD_SECTIONS = {
  // Right now
  "event-notice": "events", reservation: "events", "request-question": "inbox", "bar-reply": "inbox", "event-reply": "inbox",
  "bottle-ready": "inbox", "bottle-price": "inbox",
  // Friends and sharing
  letsgo: "friends", "friends-here": "friends", shared: "friends", "friend-message": "friends",
  // From the bar
  aperitif: "bar", "bar-message": "bar", "house-list": "bar", chart: "bar", "whats-new": "bar",
  // Party Picks (file 15)
  vote: "party",
  // Drinks
  "spirit-of-the-day": "spirits", exclusive: "cocktails", cocktail: "cocktails", bottle: "spirits", drink: "beer-wine",
  // Journal
  "for-you": "yours", favorite: "yours", note: "yours", list: "yours",
} as const satisfies Record<string, SectionId>;
export type CardKind = keyof typeof CARD_SECTIONS;
export const sectionOf = (k: CardKind): SectionId => CARD_SECTIONS[k];

/** Status chips keep their own meaning colours (outlined pills with a word): never a section accent. */
export const STATUS_COLORS = { ready: GREEN_DOT, waiting: BRASS, declined: "#E2A08A" } as const;
