# Menu Page — Tinder-Style Swipe (Mobile) + Captions (Desktop) + Favorites

**For:** Claude Code
**Scope:** Mobile gets a Tinder-style swipe card interface for browsing cocktails with fun reaction indicators, a list-view toggle, and a localStorage-based favorites system. Desktop keeps the current Instagram grid but adds small captions. This is a significant feature — take it step by step.

**Key dependency:** `framer-motion` (already installed at ^12.38.0) — use for swipe physics, drag gestures, and animated indicators.

---

## Architecture overview

The menu page needs to serve two completely different experiences based on viewport. The cleanest approach is to split the mobile and desktop views into separate components and render conditionally.

```
MenuPageClient.tsx
├── (desktop: md+)  → MenuDesktopGrid.tsx    ← current Instagram grid + captions
└── (mobile: <md)   → MenuMobileSwipe.tsx    ← NEW Tinder swipe interface
                          ├── SwipeCard
                          ├── ReactionOverlay
                          ├── ListView
                          └── FavoritesPanel
```

Use a `useMediaQuery` hook or Tailwind's `hidden md:block` / `md:hidden` pattern to toggle. Since both components need the same data (items, tabs, favorites), state lives in the parent `MenuPageClient`.

---

## Part 1: Desktop grid — add captions under tiles

### What changes

The current desktop grid shows image-only tiles with hover overlays. Add a small caption area below each tile showing the title and a one-line description. Keep it compact so the tight grid layout isn't broken.

### File: `src/components/ui/MenuTileGrid.tsx` → rename to `MenuDesktopGrid.tsx`

In the `MenuTile` component, add a caption below the image that's **visible on desktop only**:

```tsx
{/* Caption — desktop only, below the square image */}
<div className="hidden md:block px-2 py-1.5" style={{ backgroundColor: bgColor }}>
  <h3
    className="text-[11px] tracking-wider leading-tight line-clamp-1"
    style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
  >
    {item.title}
  </h3>
  {item.description && (
    <p
      className="text-[9px] leading-snug line-clamp-1 mt-0.5 opacity-60"
      style={{ color: mutedColor }}
    >
      {item.description}
    </p>
  )}
</div>
```

Key details:
- `text-[11px]` title + `text-[9px]` description — small enough to not bloat the grid.
- `line-clamp-1` on both — single line each, truncated with ellipsis.
- `py-1.5` — minimal vertical padding.
- The tile aspect ratio changes from pure `aspect-square` to just letting the image be square and the caption sit below it naturally. Wrap the image in its own `aspect-square` container, and let the caption flow below:

```tsx
<button onClick={onClick} className="group w-full overflow-hidden cursor-pointer ..." style={{ backgroundColor: bgColor }}>
  {/* Square image container */}
  <div className="relative w-full aspect-square overflow-hidden">
    {/* ... existing image + hover overlay code ... */}
  </div>
  {/* Caption — desktop only */}
  <div className="hidden md:block px-2 py-1.5">
    {/* ... title + description ... */}
  </div>
</button>
```

- The hover overlay (title + price on dark gradient) stays as-is on top of the image — the caption is supplementary, not a replacement.
- On mobile, the caption is `hidden` — mobile uses the swipe interface now, not the grid.

### Also add a favorites heart icon on desktop tiles

Small heart icon in the top-right corner of each tile, visible on hover:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
  className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
>
  <Heart
    size={18}
    fill={isFavorited ? "#C97D5A" : "none"}
    stroke={isFavorited ? "#C97D5A" : "#fff"}
    className="drop-shadow-md"
  />
</button>
```

---

## Part 2: Mobile — Tinder-style swipe interface

### New file: `src/components/ui/MenuMobileSwipe.tsx`

This is the main new component. It shows one cocktail card at a time, centered on screen, and the user swipes left or right to advance through items.

### Swipe card layout

The card should feel like a Tinder card — tall, rounded, with the photo filling most of the card and key info overlaid at the bottom.

```
┌─────────────────────────────┐
│                             │
│                             │
│      [cocktail image]       │
│      fills card area        │
│                             │
│                             │
│  ┌───────────────────────┐  │
│  │  Autumn Old Fashioned  │  │  ← Title (like name on Tinder)
│  │  $14          🤍       │  │  ← Price (like age) + heart button
│  │  Bourbon, maple,       │  │  ← Description (like bio)
│  │  orange, bitters       │  │
│  └───────────────────────┘  │
│   Scroll down for more ↓    │  ← Hint text if back content exists
└─────────────────────────────┘
```

**Card dimensions:**
- Width: `calc(100vw - 40px)` — 20px margin on each side.
- Height: `calc(100dvh - 180px)` approximately — leave room for tab bar at top and action buttons at bottom. Use Tailwind's `h-[calc(100dvh-180px)]` or similar.
- Rounded corners: `rounded-2xl` — Tinder uses prominent rounding.
- Overflow: `hidden` for the image, `overflow-y-auto` for the info panel.

**Card content:**
- Image fills top ~65% of the card with `object-cover`.
- Dark gradient overlay from bottom.
- Info overlaid at bottom of the image area:
  - Title: large, display font, white, bold — like a Tinder name. `text-2xl tracking-wider`.
  - Price: right next to or just below the title, in the accent color `#C97D5A` — like the age on Tinder. `text-lg`.
  - Heart button: inline with price, tap to favorite/unfavorite.
  - Description: below title/price, white, `text-sm opacity-80`.
- If the item has back content (tagLine, ingredients, etc.), show a subtle "Scroll for more ↓" hint. The card should be vertically scrollable to reveal the additional details below the image area — like scrolling down on a Tinder profile.

**Scrollable detail area (below the fold):**
When the user scrolls down on the card, they see a detail section below the image:
- tagLine (italic)
- ingredients
- tastingNotes
- notableNotes
- All values only, no field labels — same as the current flip card back.
- This area has a solid `bgColor` background.

### Swipe mechanics — using Framer Motion

Use `framer-motion`'s `motion.div` with `drag="x"` for the swipe gesture:

```tsx
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

function SwipeCard({ item, onSwipe, ... }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]); // Tinder-style tilt
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0.5, 1, 1, 1, 0.5]);

  function handleDragEnd(_, info) {
    const threshold = 100; // px — minimum swipe distance to trigger
    if (Math.abs(info.offset.x) > threshold) {
      // Animate card off-screen, then call onSwipe
      const direction = info.offset.x > 0 ? "right" : "left";
      animate(x, info.offset.x > 0 ? 500 : -500, {
        duration: 0.3,
        onComplete: () => onSwipe(direction),
      });
    } else {
      // Snap back to center
      animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
    }
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      style={{ x, rotate, opacity }}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      {/* Card content */}
    </motion.div>
  );
}
```

Key Framer Motion details:
- `drag="x"` — only horizontal dragging.
- `dragElastic={0.9}` — feels loose and fun, like Tinder.
- `useTransform` for rotation — card tilts as it's dragged (-15° to +15°).
- `animate()` to fly the card off-screen when the swipe threshold is met, then `onSwipe` callback triggers the next card.
- Spring animation for snap-back if the swipe isn't far enough.

### Reaction indicators

As the user swipes, show fun positive reaction indicators that fade in based on swipe distance. These should appear on the card itself, like Tinder's "LIKE" and "NOPE" stamps.

```tsx
// Derived from the x motion value
const rightIndicatorOpacity = useTransform(x, [0, 100], [0, 1]);
const leftIndicatorOpacity = useTransform(x, [-100, 0], [1, 0]);
```

**Reaction indicators (all positive since it's parody — no "NOPE"):**

Swipe RIGHT reactions (rotate through these randomly each swipe):
- 🔥 "YES"
- 👍 "CHEERS"  
- 😍 "LOVE IT"
- 🍸 "POUR IT"
- ⭐ "NICE"

Swipe LEFT reactions (still positive — it's just navigating):
- 👋 "NEXT"
- 🤔 "MAYBE LATER"
- 😌 "SAVING ROOM"

Render as a stamp-style overlay on the card:

```tsx
{/* Right swipe indicator */}
<motion.div
  style={{ opacity: rightIndicatorOpacity }}
  className="absolute top-12 left-6 z-20 -rotate-12 pointer-events-none"
>
  <div className="border-4 border-green-400 rounded-lg px-4 py-2">
    <p className="text-green-400 text-3xl font-bold tracking-wider">
      {rightReaction.emoji} {rightReaction.text}
    </p>
  </div>
</motion.div>

{/* Left swipe indicator */}
<motion.div
  style={{ opacity: leftIndicatorOpacity }}
  className="absolute top-12 right-6 z-20 rotate-12 pointer-events-none"
>
  <div className="border-4 border-amber-400 rounded-lg px-4 py-2">
    <p className="text-amber-400 text-3xl font-bold tracking-wider">
      {leftReaction.emoji} {leftReaction.text}
    </p>
  </div>
</motion.div>
```

- Green border + text for right swipes (the "positive" direction).
- Amber/gold for left swipes (warm, not negative).
- Rotated stamps (-12° and +12°) for that Tinder stamp look.
- Randomize which reaction text appears each time — pick from the arrays above.

### Card stack

Show 2–3 cards stacked behind the active card to give depth (like Tinder's card stack):

```tsx
{/* Render the next 2 cards behind the active one, slightly scaled down */}
{nextItems.slice(0, 2).map((item, i) => (
  <div
    key={item.id}
    className="absolute inset-0 pointer-events-none"
    style={{
      transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 8}px)`,
      opacity: 1 - (i + 1) * 0.2,
      zIndex: -i - 1,
    }}
  >
    {/* Simplified card — just image + title, no interactivity */}
  </div>
))}
```

### Tab navigation in swipe mode

The tab bar stays at the top. When the user taps a tab, the swipe deck resets to the first item in that tab's section. Show a small counter below the card: "3 of 12 — Seasonal" so the user knows where they are.

```tsx
<p className="text-center text-[10px] tracking-widest uppercase opacity-40 mt-2" style={{ color: textColor }}>
  {currentIndex + 1} of {currentSectionItems.length} — {currentTab.label}
</p>
```

### Bottom action bar

Below the card, show action buttons (like Tinder's bottom bar):

```
    [📋 List]     [← Back]     [❤️ Fav]     [→ Next]
```

- **List button** (left): switches to list view (see Part 3).
- **Back button**: goes to previous card (like Tinder's rewind).
- **Heart button**: toggles favorite for the current card. Filled heart if already favorited.
- **Next button**: advances to the next card (same as swiping right).

Style these as circular icon buttons, `w-12 h-12 rounded-full`, with the heart button slightly larger (`w-14 h-14`) — exactly like Tinder's action bar.

```tsx
<div className="shrink-0 flex items-center justify-center gap-5 py-3">
  {/* List view toggle */}
  <button onClick={onToggleListView} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
    <List size={18} style={{ color: mutedColor }} />
  </button>

  {/* Back */}
  <button onClick={onPrev} disabled={currentIndex === 0} className="w-12 h-12 rounded-full border border-amber-400/40 flex items-center justify-center disabled:opacity-20">
    <Undo2 size={20} className="text-amber-400" />
  </button>

  {/* Favorite */}
  <button onClick={() => onToggleFavorite(currentItem.id)} className="w-14 h-14 rounded-full border border-[#C97D5A]/40 flex items-center justify-center">
    <Heart size={26} fill={isFavorited ? "#C97D5A" : "none"} stroke="#C97D5A" />
  </button>

  {/* Next */}
  <button onClick={onNext} disabled={currentIndex === items.length - 1} className="w-12 h-12 rounded-full border border-green-400/40 flex items-center justify-center disabled:opacity-20">
    <ArrowRight size={20} className="text-green-400" />
  </button>
</div>
```

Import from lucide-react: `Heart`, `List`, `Undo2`, `ArrowRight`.

### End of deck

When the user swipes through all items in a section, show a fun end-of-deck card:

```
┌─────────────────────────────┐
│                             │
│         🍸                  │
│                             │
│   You've seen them all!     │
│                             │
│   [View Favorites (3)]      │  ← only if they have favorites
│   [Start Over]              │
│                             │
└─────────────────────────────┘
```

---

## Part 3: List view (mobile)

### Toggle

The list view is an alternative to the swipe view. A button in the swipe view's bottom bar (or top bar) toggles between them. Use state in the parent:

```tsx
const [viewMode, setViewMode] = useState<"swipe" | "list">("swipe");
```

### List layout

Simple scrollable list grouped by tab, similar to a restaurant menu:

```
[Tab bar — same as swipe mode]

── Seasonal ──────────────────
┌──────────┬──────────────────┐
│  [image] │ Autumn Old       │
│  60x60   │ Fashioned  $14   │
│  rounded │ Bourbon, maple.. │
└──────────┴──────────────────┘
┌──────────┬──────────────────┐
│  [image] │ Winter Spritz    │
│          │ $13              │
│          │ Prosecco, apert..│
└──────────┴──────────────────┘

── Classics ──────────────────
...
```

Each row:
- Small thumbnail (60x60, `rounded-md`, `object-cover`) on the left.
- Title + price on the right, with description below.
- Tap a row → opens the enlarged card overlay (same `EnlargedTileOverlay` component from the desktop grid, or a variant).
- Heart icon on the right edge of each row to favorite.

Include a "Switch to Swipe" button at the top or bottom to go back.

---

## Part 4: Favorites system

### localStorage persistence

Store favorites as an array of item IDs in localStorage:

```tsx
const FAVORITES_KEY = "cg-menu-favorites";

function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

function setFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

function toggleFavorite(id: string): string[] {
  const favs = getFavorites();
  const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  setFavorites(next);
  return next;
}
```

### Favorites state in MenuPageClient

Lift favorites state to the parent so both mobile and desktop can access it:

```tsx
const [favorites, setFavoritesState] = useState<string[]>([]);

// Load from localStorage on mount (client-only)
useEffect(() => {
  setFavoritesState(getFavorites());
}, []);

function handleToggleFavorite(id: string) {
  const next = toggleFavorite(id);
  setFavoritesState(next);
}
```

Pass `favorites` and `onToggleFavorite` as props to both mobile and desktop components.

### Favorites panel (mobile)

A slide-up panel or full-screen overlay showing the user's favorited cocktails:

```
┌─────────────────────────────┐
│  ❤️ Your Favorites (3)   ✕  │
├─────────────────────────────┤
│                             │
│  [image] Autumn Old Fash.. 🗑│
│  [image] Manhattan         🗑│
│  [image] Espresso Martini  🗑│
│                             │
│  [Clear All Favorites]      │
│                             │
└─────────────────────────────┘
```

- Same list-row layout as the list view.
- Trash icon on each row to remove from favorites.
- "Clear All" button at the bottom.
- Tap a row → opens the enlarged card view for that cocktail.
- Empty state: "No favorites yet — swipe through the menu and heart the ones you love!"

**Where to access favorites:**
- A small floating heart-badge button in the top-right area of the swipe view: `❤️ 3` (count of favorites). Tap to open the favorites panel.
- On desktop: a small "❤️ Favorites" link in the tab bar area, or a floating button in the corner.

### Favorites on desktop

On the desktop grid, show a small favorites bar or floating button:

```tsx
{favorites.length > 0 && (
  <button
    onClick={() => setShowFavorites(true)}
    className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
    style={{ backgroundColor: "#C97D5A", color: "#fff" }}
  >
    <Heart size={16} fill="#fff" />
    <span className="text-sm tracking-wider">{favorites.length} Favorites</span>
  </button>
)}
```

---

## Part 5: Component structure and files

### New files to create

| File | Purpose |
|------|---------|
| `src/components/ui/MenuMobileSwipe.tsx` | Tinder swipe interface — SwipeCard, ReactionOverlay, bottom action bar, end-of-deck |
| `src/components/ui/MenuListView.tsx` | Simple list view with thumbnails, tap to expand |
| `src/components/ui/FavoritesPanel.tsx` | Slide-up favorites overlay with remove/clear functionality |
| `src/lib/favorites.ts` | localStorage helpers: `getFavorites`, `setFavorites`, `toggleFavorite` |

### Files to modify

| File | Change |
|------|--------|
| `src/components/ui/MenuTileGrid.tsx` | Rename to `MenuDesktopGrid.tsx`. Add caption under tiles. Add heart icon on hover. Accept `favorites` + `onToggleFavorite` props. Remove mobile-specific code. |
| `src/app/menu/MenuPageClient.tsx` | Add favorites state management. Conditionally render `MenuDesktopGrid` (md+) vs `MenuMobileSwipe` (<md). Add favorites floating button. |

### Shared components

The `EnlargedTileOverlay` (the flip card overlay) should be extracted into its own file or kept accessible to both mobile and desktop components. Both the list view (tap a row) and the desktop grid (click a tile) use it.

---

## Implementation order

Build in this sequence so each step is independently testable:

1. **`src/lib/favorites.ts`** — localStorage helpers. Tiny file, no UI.

2. **Desktop captions** — add the caption div to the existing `MenuTile` in `MenuTileGrid.tsx`. Quick visual change, easy to verify.

3. **`MenuMobileSwipe.tsx`** — the core swipe interface. Build the card layout, drag mechanics with Framer Motion, reaction overlays, card stack, tab navigation, bottom action bar, end-of-deck card. This is the biggest piece.

4. **`MenuPageClient.tsx`** — add favorites state, conditional rendering (desktop grid vs mobile swipe), viewport detection.

5. **`MenuListView.tsx`** — the simple list view toggle. Uses the same data, just a different layout.

6. **`FavoritesPanel.tsx`** — the favorites overlay. Reads from the same favorites state, provides remove/clear.

7. **Heart icons everywhere** — add favorite toggle to desktop tiles (hover), mobile swipe cards, and list view rows.

8. **Polish** — reaction indicator variety, animations, edge cases (empty sections, single item, no image).

---

## Technical notes

### Viewport detection for mobile vs desktop

Use Tailwind's responsive classes for the split:

```tsx
{/* Desktop — hidden on mobile */}
<div className="hidden md:block h-full">
  <MenuDesktopGrid ... />
</div>

{/* Mobile — hidden on desktop */}
<div className="md:hidden h-full">
  <MenuMobileSwipe ... />
</div>
```

Both components render in the DOM but only one is visible. This avoids hydration mismatches from `useMediaQuery` and is the simplest approach. Since the mobile component uses Framer Motion drag, it won't fire any expensive listeners while `display: none`.

### Swipe navigation state

Track the current item index per tab section:

```tsx
const [currentIndex, setCurrentIndex] = useState(0);

// When user swipes
function handleSwipe(direction: "left" | "right") {
  // Both directions advance to the next card (it's parody — no reject action)
  setCurrentIndex((prev) => Math.min(prev + 1, currentSectionItems.length));
}

// When user taps a tab
function handleTabClick(tabId: string) {
  setActiveTabId(tabId);
  setCurrentIndex(0); // reset to first card in new section
}
```

### Preventing scroll while swiping

When the user is dragging a card horizontally, prevent vertical page scroll:

```tsx
<motion.div
  drag="x"
  onDragStart={() => { document.body.style.touchAction = "none"; }}
  onDragEnd={() => { document.body.style.touchAction = ""; handleDragEnd(...); }}
  ...
/>
```

### Card scrolling vs swiping

The card needs to support BOTH vertical scroll (to see more details) and horizontal swipe (to navigate). This is a UX challenge:

- **Primary gesture: horizontal swipe** — always captured by the drag handler.
- **Vertical scroll:** only activate when the user scrolls within the info/details section at the bottom of the card.
- Implementation: the image area captures horizontal drag. The scrollable text area below has `overflow-y-auto` and its own touch handling. Use `drag="x"` only on the outer card, and let the inner scrollable div handle vertical touch natively. Framer Motion's `drag="x"` won't interfere with vertical scrolling inside child elements.

### localStorage note for the plan

**localStorage persists indefinitely** on the device — across page refreshes, browser restarts, and even OS reboots. It only clears if:
- The user manually clears browser data / cookies.
- The user uses incognito/private mode (clears on window close).
- The browser evicts data under extreme storage pressure (very rare).

For a casual "favorites" feature on a bar website, this is more than sufficient. No database, no login, no server-side storage needed.

---

## Acceptance criteria

1. **Desktop grid:** current Instagram-style 3-col grid with a small caption (title + one-line description) below each tile. Heart icon appears on hover.
2. **Mobile swipe:** one card at a time, centered, with cocktail image + title/price/description overlaid. Swipe left or right to advance. Card tilts with drag and flies off-screen.
3. **Reaction indicators:** fun positive stamps (emoji + text) appear on the card as the user swipes, Tinder-style. Randomized from a set of reactions. No negative indicators.
4. **Card stack:** 2-3 preview cards visible behind the active card for depth.
5. **Scroll for details:** user can scroll down on a card to see tagLine, ingredients, tastingNotes, notableNotes below the image.
6. **Tab navigation:** tab bar at top works in both swipe and list modes. Tapping a tab resets to the first card in that section.
7. **Bottom action bar:** Back, Heart, Next buttons + List view toggle. Circular buttons like Tinder's action bar.
8. **End of deck:** fun card shown when all items in a section have been swiped. Option to start over or view favorites.
9. **List view toggle:** switch to a simple scrollable list grouped by tab. Each row has a thumbnail, title, price, description, and heart icon. Tap a row to see the full card.
10. **Favorites (heart):** tap the heart on any card/tile/row to save it. Persists in localStorage across sessions.
11. **Favorites panel:** accessible from both mobile and desktop. Shows all favorited items in a list. Can remove individual items or clear all.
12. **No negative states:** all swipe reactions are positive or neutral. The feature is for fun navigation, not actual rating.
