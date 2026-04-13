# Menu Page — Swipe & Grid Refinements

**For:** Claude Code
**Scope:** Three focused changes: (1) hide "Cocktail Menu" title on mobile so the Tinder view fits like a full-screen app, (2) replace the "You've seen them all" end-of-deck with continuous looping across sections, (3) make desktop tile captions larger as hover overlays instead of small text below.

---

## Change 1: Hide page title on mobile, fit Tinder view to screen

### File: `src/app/menu/MenuPageClient.tsx`

The `<header>` block (lines 60–82) shows the "Cocktail Menu" title and subtitle. On mobile this wastes vertical space that should go to the swipe card. Hide it on mobile so the Tinder interface fills the viewport like an app.

```tsx
// BEFORE (line 60)
<header className="shrink-0 text-center px-6 pt-5 pb-3">

// AFTER — hidden on mobile, visible on desktop
<header className="shrink-0 text-center px-6 pt-5 pb-3 hidden md:block">
```

That's it — one class addition. The mobile view now goes straight from the site header into the tab bar and swipe card area with no wasted space.

### File: `src/components/ui/MenuMobileSwipe.tsx`

With the title gone, the swipe area should use all available space. The current card area has `px-5 py-3` padding (line 307). Tighten it up:

```tsx
// BEFORE (line 307)
<div className="flex-1 relative px-5 py-3">

// AFTER — slightly tighter vertical padding to maximize card height
<div className="flex-1 relative px-4 py-2">
```

Also tighten the stacked preview cards to match:

```tsx
// BEFORE (line 312)
className="absolute inset-x-5 inset-y-3 rounded-2xl overflow-hidden pointer-events-none"

// AFTER
className="absolute inset-x-4 inset-y-2 rounded-2xl overflow-hidden pointer-events-none"
```

And tighten the bottom action bar padding:

```tsx
// BEFORE (line 400)
<div className="shrink-0 flex items-center justify-center gap-5 py-3 pb-4">

// AFTER — less bottom padding
<div className="shrink-0 flex items-center justify-center gap-4 py-2 pb-3">
```

And the counter row:

```tsx
// BEFORE (line 380)
<div className="shrink-0 py-1 text-center flex items-center justify-center gap-3">

// AFTER — even more compact
<div className="shrink-0 py-0.5 text-center flex items-center justify-center gap-3">
```

The goal: tab bar + card + counter + action bar all fit within `100dvh - 52px` (the 52px site header) with zero scrolling. The card should be as tall as possible.

---

## Change 2: Remove end-of-deck, loop continuously across sections

### File: `src/components/ui/MenuMobileSwipe.tsx`

Currently when the user swipes past the last item in a tab section, they see a "You've seen them all!" card (lines 346–376). Instead, the deck should automatically advance to the next section's first item, and when the last section is exhausted, loop back to the first section's first item.

**Build a flat list of ALL items across ALL sections** (ordered by tab order, then item order within each tab), instead of filtering by active tab:

```tsx
// NEW — flat list of all items in tab order
const allItems = useMemo(() => {
  return tabs.flatMap((tab) =>
    items
      .filter((i) => i.tabId === tab.id)
      .sort((a, b) => a.order - b.order)
  );
}, [items, tabs]);

// Track which section each index falls in, for the tab bar highlight and counter
const sectionBreakpoints = useMemo(() => {
  const breakpoints: { tabId: string; startIndex: number; count: number }[] = [];
  let offset = 0;
  for (const tab of tabs) {
    const count = items.filter((i) => i.tabId === tab.id).length;
    if (count > 0) {
      breakpoints.push({ tabId: tab.id, startIndex: offset, count });
      offset += count;
    }
  }
  return breakpoints;
}, [items, tabs]);

function getTabForIndex(index: number): string {
  for (let i = sectionBreakpoints.length - 1; i >= 0; i--) {
    if (index >= sectionBreakpoints[i].startIndex) {
      return sectionBreakpoints[i].tabId;
    }
  }
  return tabs[0]?.id ?? "";
}

function getSectionProgress(index: number): { current: number; total: number; label: string } {
  for (const bp of sectionBreakpoints) {
    if (index >= bp.startIndex && index < bp.startIndex + bp.count) {
      const tab = tabs.find((t) => t.id === bp.tabId);
      return {
        current: index - bp.startIndex + 1,
        total: bp.count,
        label: tab?.label ?? "",
      };
    }
  }
  return { current: 0, total: 0, label: "" };
}
```

**Update the global index to use `allItems`:**

```tsx
const [globalIndex, setGlobalIndex] = useState(0);

// Wrap around when reaching the end
const wrappedIndex = allItems.length > 0 ? globalIndex % allItems.length : 0;
const currentItem = allItems[wrappedIndex] ?? null;

// Update active tab as the user swipes
useEffect(() => {
  if (allItems.length > 0) {
    setActiveTabId(getTabForIndex(wrappedIndex));
  }
}, [wrappedIndex, allItems.length]);
```

**Update `handleSwipe` — no more end-of-deck, just advance and wrap:**

```tsx
function handleSwipe(_direction: "left" | "right") {
  setGlobalIndex((prev) => prev + 1);
  // The modulo in wrappedIndex handles the looping automatically
}

function handleNext() {
  setGlobalIndex((prev) => prev + 1);
}

function handlePrev() {
  setGlobalIndex((prev) => Math.max(0, prev - 1));
}
```

**When a tab is clicked, jump to the first item in that section:**

```tsx
function handleTabClick(tabId: string) {
  const bp = sectionBreakpoints.find((b) => b.tabId === tabId);
  if (bp) setGlobalIndex(bp.startIndex);
  setActiveTabId(tabId);
}
```

**Update the counter row:**

```tsx
const progress = getSectionProgress(wrappedIndex);

// In the counter JSX:
<p className="text-[11px] tracking-widest uppercase opacity-50" style={{ color: textColor }}>
  {progress.current} of {progress.total} — {progress.label}
</p>
```

**Update the next items for the card stack preview:**

```tsx
// Preview cards — show the next 2 items in the flat list (wrapping)
const nextItems = [1, 2]
  .map((offset) => allItems[(wrappedIndex + offset) % allItems.length])
  .filter(Boolean);
```

**Remove the entire end-of-deck block** (lines 346–376). Delete it entirely — the deck never ends, it loops.

**Remove the `isAtEnd` variable** and all references to it. The `disabled` state on the Next button should also be removed since there's always a next card:

```tsx
// BEFORE
disabled={isAtEnd}

// AFTER — remove the disabled prop entirely, or:
disabled={allItems.length === 0}
```

---

## Change 3: Desktop captions as larger hover overlays (not text below)

### File: `src/components/ui/MenuTileGrid.tsx`

Currently the desktop tiles have a small caption (`text-[11px]` title, `text-[9px]` description) sitting below the image in a separate div (lines 158–171). Mike wants the title and description to be **larger** and appear as a **hover overlay on top of the image**, not below it.

**Remove the caption div below the image:**

```tsx
// DELETE lines 158–171 entirely:
{/* Caption — desktop only */}
<div className="hidden md:block px-2 py-1.5" style={{ backgroundColor: bgColor }}>
  ...
</div>
```

**Replace the existing hover overlay** (lines 121–134) with a larger, more prominent version that includes the description:

```tsx
{/* Hover overlay — desktop only */}
<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

<div className="absolute inset-0 hidden md:flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
  <h3
    className="text-sm tracking-wider leading-tight line-clamp-2 drop-shadow-lg"
    style={{ fontFamily: "var(--font-display)", color: "#fff" }}
  >
    {item.title}
  </h3>
  {item.price && (
    <p className="text-xs mt-1 drop-shadow-lg" style={{ color: "#C97D5A" }}>
      {item.price}
    </p>
  )}
  {item.description && (
    <p className="text-xs mt-1 leading-snug line-clamp-2 drop-shadow-md" style={{ color: "rgba(255,255,255,0.8)" }}>
      {item.description}
    </p>
  )}
</div>
```

Key differences from the old overlay:
- **Includes description** — `line-clamp-2` keeps it to two lines max.
- **Includes price** — in the accent color.
- **Stronger gradient** — `from-black/70` instead of `from-black/50` so white text is always readable.
- **Larger text** — `text-sm` for title (was `text-[11px]`), `text-xs` for price and description.
- **`drop-shadow-lg`** on title for extra readability over images.

Since the caption div below the image is gone, the tile goes back to being a pure square image — no extra height from text underneath. This makes the grid even tighter and more Instagram-like.

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/menu/MenuPageClient.tsx` | Add `hidden md:block` to the `<header>` element (line 60) |
| `src/components/ui/MenuMobileSwipe.tsx` | Remove end-of-deck card, implement continuous looping with flat item list and modulo wrapping, tighten padding for full-screen feel |
| `src/components/ui/MenuTileGrid.tsx` | Remove caption div below tiles, make hover overlay larger with title + price + description |

---

## Acceptance criteria

1. **Mobile — no title:** The "Cocktail Menu" title/subtitle is hidden on mobile. The Tinder view fills the screen below the site header with no wasted space.
2. **Mobile — full screen feel:** Tab bar, swipe card, counter, and action bar all fit within the viewport. No page scrolling needed. The card is as tall as possible.
3. **Mobile — continuous loop:** Swiping past the last item in a section automatically advances to the first item of the next section. After the last item of the last section, it loops back to the first item of the first section. No "You've seen them all" card ever appears.
4. **Mobile — tab tracking:** The active tab in the tab bar updates automatically as the user swipes into a new section. The counter shows "3 of 8 — Seasonal" relative to the current section.
5. **Mobile — tab click:** Clicking a tab jumps to the first item in that section.
6. **Desktop — hover overlay:** Hovering a tile shows the title, price, and description overlaid on the image with a dark gradient. Text is larger than before (`text-sm` title, `text-xs` description/price).
7. **Desktop — no caption below:** The small text caption that was sitting below each tile is removed. Tiles are pure square images again.
