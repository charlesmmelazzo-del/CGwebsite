# Menu Page — Continuous Looping Carousel with Tab Quick-Scroll

**For:** Claude Code
**Scope:** Replace the current tab-filtered, per-category carousel on `/menu` with a single continuous looping carousel that contains every menu item across all tabs. Tabs become section markers / quick-scroll anchors.

---

## Current behavior (what to change)

- `MenuPageClient.tsx` tracks `activeTabId` in state and filters items by it: only items matching the selected tab are passed to `MenuCarousel.tsx`.
- Switching tabs unmounts the current carousel items and mounts a new set — the user "jumps" between four separate carousels.
- Embla is configured with `loop: true` and `align: "center"`.

## Target behavior

- **One continuous carousel** containing *all* active items from *all* active tabs, ordered: Tab 1 items (by `order`), then Tab 2 items, then Tab 3, then Tab 4, etc. — exactly the order tabs appear left-to-right, with each tab's items sorted internally by their `order` field.
- The carousel is **centered on the page**, as it already is, and the user can **scroll left or right continuously** — it loops seamlessly (Embla `loop: true` stays).
- **Tab bar stays at the top.** Clicking a tab **quick-scrolls** (smooth animated scroll via Embla `scrollTo`) the carousel to the **first item of that tab's section**. The tab bar does *not* filter items out — all items remain in the carousel at all times.
- As the user manually scrolls through the carousel, the **active tab in the tab bar updates** to reflect which section the centered/active slide belongs to. This gives the user a persistent sense of "where they are" in the full menu.

---

## Implementation plan

### 1. Build the ordered item list

In `MenuPageClient.tsx`, replace the per-tab filter with a single flat list:

```
const allItems = activeTabs
  .sort((a, b) => a.order - b.order)
  .flatMap(tab =>
    activeItems
      .filter(item => item.tabId === tab.id)
      .sort((a, b) => a.order - b.order)
  );
```

This produces one array: `[...Seasonal items, ...Classics items, ...NA items, ...Beer & Wine items]`.

### 2. Compute section start indices

Build a map of tab ID → index of that tab's first item in the flat array. This powers the quick-scroll:

```
const sectionStartIndices: Record<string, number> = {};
let idx = 0;
for (const tab of activeTabs.sort((a, b) => a.order - b.order)) {
  sectionStartIndices[tab.id] = idx;
  idx += activeItems.filter(i => i.tabId === tab.id).length;
}
```

### 3. Pass the full list + section indices to `MenuCarousel`

Update the `MenuCarousel` props:

- `items` — the full flat list (replaces the current per-tab-filtered list).
- `sectionStartIndices` — `Record<string, number>` mapping tab ID to first-item index.
- `tabs` — the sorted active tabs array (for building the tab bar inside the carousel or for the callback).
- `onActiveSectionChange` — callback `(tabId: string) => void` that fires when the centered slide crosses a section boundary.

### 4. Tab quick-scroll

When the user clicks a tab in the tab bar:

```
emblaApi.scrollTo(sectionStartIndices[clickedTabId]);
```

This smooth-scrolls the carousel to the first item in that section. Embla supports `scrollTo(index)` natively — no extra library needed.

### 5. Active tab tracking on manual scroll

On Embla's `select` event (fires whenever the centered slide changes):

```
const currentIndex = emblaApi.selectedScrollSnap();
// Find which section this index belongs to
let currentTabId = activeTabs[0].id;
for (const tab of activeTabs) {
  if (currentIndex >= sectionStartIndices[tab.id]) {
    currentTabId = tab.id;
  }
}
onActiveSectionChange(currentTabId);
```

In `MenuPageClient.tsx`, update `activeTabId` state from this callback so the tab bar highlight follows the scroll position.

### 6. Visual section dividers (optional but recommended)

To give the user a sense of sections flowing into one another, insert a lightweight **section divider slide** at each boundary — a non-interactive card the same size as a menu card that shows only the next section's name (e.g. "Classics") in the heading font, styled as a subtle label. This way as users scroll they see "…last Seasonal item → 'Classics' divider → first Classics item…" and know they've entered a new section.

Implementation:
- Before building the flat list, interleave divider items at each tab boundary (give them a special `type: 'divider'` field or a flag like `isDivider: true`).
- In the carousel render, check for dividers and render a simple styled `<div>` instead of a FlipCard. Dividers are not clickable, not flippable, and have no back content.
- Update section start indices to account for the divider slides (each divider adds +1 to subsequent indices).
- **Do not** show dot indicators for divider slides — only for real menu items.

### 7. Embla config adjustments

Current Embla options are `{ loop: true, align: 'center' }`. Keep both. Additionally consider:

- `skipSnaps: false` — ensure every card is a valid snap point so quick-scroll lands precisely.
- `dragFree: false` — keep snapping behavior so centered card is always clean.
- If the total item count is very small (<4), looping may look odd (same cards repeating immediately). Add a guard: if total items < some threshold (say 5), disable `loop` to avoid visual stutter.

### 8. Dot indicators

The current carousel shows dots per item. With all items in one carousel the dot count may grow large (e.g. 15+ cocktails). Options:

- **Replace dots with a thin progress bar** that shows position in the overall carousel — cleaner at scale.
- Or **show section dots only** (one dot per tab, 4 dots), styled to indicate which section is active. Clicking a section dot scrolls to that section (same as clicking the tab).
- **[DECIDE]**: progress bar vs. section dots vs. keep per-item dots. I'd recommend section dots — they reinforce the tab structure and stay compact.

### 9. Flip card behavior in continuous mode

The existing FlipCard component should work unchanged. One addition: **when the user scrolls (manually or via tab-click), auto-reset any flipped card back to its front side.** The current code already does `setFlippedId(null)` on carousel navigation — verify this still fires in the new single-carousel setup.

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/menu/MenuPageClient.tsx` | Remove per-tab filtering. Build flat item list + section indices. Pass to carousel. Update `activeTabId` from carousel callback. |
| `src/components/ui/MenuCarousel.tsx` | Accept new props (`sectionStartIndices`, `tabs`, `onActiveSectionChange`). Add `scrollTo` on tab click. Add `select` event listener to track active section. Optionally render divider slides. Update dot indicators. |
| `src/types/index.ts` | No changes needed unless you add a `divider` type — if so, add a `isDivider?: boolean` to `MenuItem` or create a union type. |
| `src/app/menu/page.tsx` | No changes (data fetching stays the same — still fetch all tabs + all items). |

Admin panel, API routes, and Supabase schema are **not touched** — this is purely a front-end rendering change.

---

## Acceptance criteria

- All active menu items from all active tabs appear in a single centered carousel.
- User can scroll left/right continuously and the carousel loops.
- Clicking a tab smooth-scrolls to the first item in that tab's section.
- The active tab highlight updates as the user manually scrolls through sections.
- Section dividers (if implemented) appear between sections and are not interactive.
- Flip cards work exactly as before (click to flip, click to flip back, auto-reset on scroll).
- On mobile: touch-swipe works, cards are properly sized, tab bar is scrollable if it overflows.
- Existing admin panel, data model, and API are unchanged.

## Out of scope

- Everything in `CLAUDE_CODE_TASK_PLAN.md` and `CLAUDE_CODE_FOLLOWUP_PLAN.md` that isn't this carousel change.
- Coffee page — leave it using the current per-tab carousel for now (it can be migrated later if Mike likes how the menu page feels).

# Common Good — Follow-up Task Plan

**For:** Claude Code
**Scope:** four focused feature changes. Nothing else in this file — leave the rest of the site alone.

---

## Task 1 — Menu carousel: click-to-flip card (replaces prior lightbox idea)

**Goal:** On `/menu`, each cocktail card shows a photo + name on the front. Clicking/tapping the card flips (or cross-fades) it in place to reveal extra details. **No lightbox, no modal, no expanded larger image** — the card stays the same size, only its contents change.

### Admin changes (`/admin/menu`)
Add these fields to each cocktail item (alongside the existing name field):

- `image` — hero photo (upload)
- `alt` — alt text for the image
- `ingredients` — free text
- `tastingNotes` — free text
- `tagLine` — short free text
- `notableNotes` — free text

All new text fields are optional. Persist them in whatever store the existing menu items use.

### Front-end changes (`/menu`)
- **Card front:** cocktail photo + name. If no image is uploaded, fall back to a styled text-only front (name centered on brand background) — don't show a broken image.
- **Card back:** reveals the values the admin entered, in this order:
  1. `tagLine`
  2. `ingredients`
  3. `tastingNotes`
  4. `notableNotes`
- **Critical display rules:**
  - Render **only the values**, never the field labels/headers. The user should never see the word "Ingredients" or "Tasting Notes" on the card.
  - If a field is empty, skip it entirely — no blank rows, no empty headings, no placeholder dashes.
  - If all four are empty, clicking the card should do nothing (or not be clickable) rather than flipping to a blank back side.
- **Interaction:**
  - Click/tap to flip front → back. Click/tap again to flip back → front.
  - Use a CSS 3D flip or a smooth cross-fade — whichever renders more cleanly in the existing carousel.
  - While a card is flipped, it should stay flipped even if the carousel auto-advances — pause auto-advance on flip, resume on flip-back.
  - Keep existing swipe/arrow carousel navigation working. Swiping to a new card should auto-reset any flipped card back to its front.
  - Keyboard: Enter/Space flips the focused card. Add `aria-pressed` and a sensible `aria-label` ("Show details for {cocktail name}" / "Hide details").
- **Styling:** the back side should match the existing card dimensions and brand palette. Use comfortable line-height and a legible size — this is a reading surface, not a label. Leave enough padding so long ingredient lists don't touch the card edge.

### Acceptance
- Admin can fill in image + all four text fields per cocktail and save.
- Front of card shows photo + name (or text-only front if no photo).
- Click flips to back showing only the non-empty values, no labels, in the order above.
- Click again flips back. Swipe/arrow still work. No lightbox or size change on click.
- Empty fields never render. Empty-everything cards don't flip.

---

## Task 2 — Home carousel: Instagram slide type

**Goal:** In addition to the existing Text / Image / Form slide types in the home-page carousel, add an **Instagram slide** type. When the admin pastes an Instagram post URL, the slide displays that post's photo and caption.

### Admin changes (`/admin/home`)
- Add a fourth slide type: **Instagram Slide** (buttons currently read "Text Slide / Image Slide / Form Slide Add" — add "Instagram Slide" next to them).
- Instagram Slide fields:
  - `instagramUrl` — required, the full post URL (e.g. `https://www.instagram.com/p/XXXXXXXXX/`)
  - `active` — toggle (consistent with existing slide types)
  - Optional `captionOverride` — if the admin wants to shorten or replace the scraped caption for layout reasons.
- On save, the server should:
  1. Validate the URL matches an Instagram post/reel pattern.
  2. Fetch the post's photo URL and caption via the Instagram oEmbed endpoint (or, if oEmbed is unavailable / rate-limited, fall back to scraping the OpenGraph `og:image` and `og:description` from the public post page).
  3. Cache the fetched `imageUrl` + `caption` + `fetchedAt` alongside the slide in the DB, so the public site doesn't hit Instagram on every page load.
  4. Re-fetch on a schedule (once every 24 hours is plenty) or whenever the admin re-saves the slide. Add a "Refresh now" button on the slide in admin that forces a re-fetch.
  5. If the fetch fails (post deleted, private, rate-limited), keep the last successful cache and surface a small warning in admin ("Last refresh failed — showing cached content from {date}"). Do not break the public site.

### Front-end changes (home carousel)
- Render Instagram slides alongside the existing Text / Image / Form slides in the same carousel.
- Layout: show the cached photo as the slide's visual, with the caption overlaid or shown below (match the style of the existing Image Slide as closely as possible so the carousel feels consistent).
- Use `captionOverride` if set, otherwise the cached `caption`. Truncate gracefully (e.g. ~200 characters) with a subtle "…" if longer — full caption is not the point, the photo is.
- Make the slide clickable → opens the original Instagram post in a new tab (`target="_blank" rel="noopener"`).
- Add a small Instagram glyph in a corner of the slide so users understand it's social content, not a promotional image.
- Respect the existing carousel auto-advance timing and text-color field behavior (if caption is overlaid, allow the same text color field the other slide types use).

### Env / config
- No Meta developer app is required for the oEmbed fallback route, but Instagram's oEmbed endpoint is flaky for unauthenticated callers. If we find it's unreliable in testing, add a `META_OEMBED_TOKEN` env var and use the authenticated endpoint instead. Document whichever we end up using in the README.
- Do **not** store any user credentials or login to Instagram to fetch private posts — public posts only.

### Acceptance
- Admin clicks "Instagram Slide", pastes a public Instagram post URL, saves.
- The slide appears in the home carousel with the post's photo and caption.
- Clicking the slide opens the original post in a new tab.
- "Refresh now" in admin re-fetches the photo/caption on demand.
- If Instagram is unreachable, the last cached version keeps showing and the admin sees a warning.
- Existing Text / Image / Form slides continue to work unchanged.

---

## Task 3 — Home carousel: scheduled visibility (start date / end date per slide)

**Goal:** Let the admin schedule when each carousel slide appears and disappears, so seasonal promos, event announcements, and holiday content can be queued in advance and auto-expire without anyone needing to log in and toggle them off.

### Current state

Each `CarouselItem` has an `active` boolean (manual on/off toggle). The admin home page (`src/app/admin/home/page.tsx`) renders it as an "Active / Hidden" button per slide. The types live in `src/types/index.ts` under `CarouselItemBase`.

### Type changes (`src/types/index.ts`)

Add two optional fields to `CarouselItemBase`:

```typescript
export interface CarouselItemBase {
  id: string;
  type: CarouselItemType;
  order: number;
  active: boolean;
  // NEW — scheduling
  startDate?: string;   // ISO 8601 datetime string, e.g. "2026-04-15T00:00:00"
  endDate?: string;     // ISO 8601 datetime string, e.g. "2026-05-01T23:59:59"
}
```

Both are optional. If neither is set, the slide behaves exactly as today (controlled only by the `active` toggle). If only `startDate` is set, the slide appears from that moment onward (no auto-expire). If only `endDate` is set, the slide is visible until that moment. If both are set, the slide is visible only during the window.

### Admin changes (`src/app/admin/home/page.tsx`)

Add a **Schedule** section to each `SortableCard`, below the existing Active/Hidden toggle:

- Two `<input type="datetime-local">` fields, labeled **Starts** and **Ends**.
- Both are optional (can be cleared). Use native datetime-local inputs — no extra datepicker library needed.
- Show a small human-readable status line below the inputs:
  - If no dates set: "Always visible (when active)"
  - If start is in the future: "Scheduled — starts {date}"
  - If currently inside the window: "Live now — ends {date}"
  - If end is in the past: "Expired — ended {date}" (render in muted red/amber)
- The `active` toggle and the schedule work **independently**: `active: false` always hides the slide regardless of schedule. Think of `active` as a master override and the schedule as a time window within that.

### Front-end filtering (home page rendering)

Wherever the public home page filters carousel items (the component that reads `carouselItems` and renders the carousel), add a time-aware filter:

```typescript
const now = new Date();
const visibleItems = items.filter(item => {
  if (!item.active) return false;
  if (item.startDate && new Date(item.startDate) > now) return false;
  if (item.endDate && new Date(item.endDate) < now) return false;
  return true;
});
```

This runs on every page load / revalidation. No cron job needed — Next.js server-side rendering (or ISR) will evaluate the filter at request time.

### Acceptance
- Admin can set a start date, end date, both, or neither on any carousel slide (Text, Image, Form, Instagram).
- A slide with a future start date does not appear on the public site even if `active` is true.
- A slide past its end date does not appear on the public site.
- A slide within its window and `active: true` appears normally.
- Clearing both dates reverts to the current always-on behavior.
- The admin UI shows a clear status line so staff know at a glance whether a slide is scheduled, live, or expired.

---

## Task 4 — Home carousel: configurable auto-advance timer

**Goal:** Let the admin control how fast the home carousel automatically cycles between slides, and allow disabling auto-advance entirely.

### Current state

The home page carousel component (likely in `src/components/` — find whichever component renders the home carousel using Embla or similar) either has auto-advance hardcoded or doesn't have it at all. The `CarouselSection` type in `src/types/index.ts` already has `autoplay?: boolean` and `autoplayInterval?: number` fields, but these are for the **Page Builder** carousel section — not the **Home Page** carousel. The `HomeSettings` type has no auto-advance fields.

### Type changes (`src/types/index.ts`)

Add two fields to `HomeSettings`:

```typescript
export interface HomeSettings {
  backgroundImageUrl?: string;
  backgroundTheme: ThemeName;
  carouselItems: CarouselItem[];
  // NEW — auto-advance
  autoAdvance?: boolean;         // default true
  autoAdvanceInterval?: number;  // seconds, default 6
}
```

### Admin changes (`src/app/admin/home/page.tsx`)

Add a **Carousel Settings** section above or below the "Background Image" section. Keep it simple:

- A checkbox: **Auto-advance slides** (defaults to checked/true).
- When checked, show a slider or number input: **Interval (seconds)** — min 2, max 30, default 6, step 1. Show the current value as "{N} seconds" next to the input.
- These values are saved alongside the existing `bgUrl` and `carouselItems` in the same POST to `/api/admin/home`.

### API changes (`src/app/api/admin/home/route.ts`)

Accept and persist `autoAdvance` (boolean) and `autoAdvanceInterval` (number) alongside the existing payload. Return them on GET so the admin can load the saved values.

### Front-end changes (home page carousel component)

- Read `autoAdvance` and `autoAdvanceInterval` from the home settings data.
- If `autoAdvance` is true (or undefined, for backward compat), enable Embla autoplay with the specified interval (default 6 seconds if not set). Use the `embla-carousel-autoplay` plugin if not already installed — it handles pause-on-hover and pause-on-interaction out of the box.
- If `autoAdvance` is false, do not auto-advance — user must swipe or click arrows.
- **Important interaction with flip cards (if applicable):** if a user has interacted with a slide (e.g. flipped a card, started filling a form), pause auto-advance until they disengage. The Embla autoplay plugin's `stopOnInteraction` option handles this.

### Acceptance
- Admin can toggle auto-advance on/off and set the interval in seconds.
- On the public site, the carousel auto-cycles at the configured speed (or doesn't, if disabled).
- Changing the interval in admin and saving immediately affects the public site on next load.
- User interaction (swipe, click, form focus) pauses auto-advance; it resumes after a short delay.
- If the admin has never configured these fields (existing data), the carousel defaults to auto-advance on, 6 seconds — no breaking change.

---

## Out of scope for this PR
- Everything else in `CLAUDE_CODE_TASK_PLAN.md` (P0 bugs, mobile nav, Toast/OZNR wiring, events, forms builder, etc.) is tracked separately — do not touch it here unless a change is strictly required to make these four features work.
