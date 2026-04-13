# Menu Mobile Swipe — Tab Spacing + Tap-for-Details Fix

**For:** Claude Code
**Scope:** Two changes to the mobile swipe view: (1) remove the gap between the site header and the tab bar, (2) tapping a card should flip it in-place to show details on the back — not open a separate enlarged overlay.

---

## Change 1: Remove gap between site header and tab bar

### Problem

On mobile there's a visible strip of blank background color between the site header (52px fixed bar) and the swipe view's tab bar. This comes from the page layout structure — the `<div className="h-screen overflow-hidden flex flex-col">` container doesn't account for the site header's 52px, so the content starts 52px below the top of the viewport, but the tab bar has no reason to not be flush against that edge.

### File: `src/app/menu/MenuPageClient.tsx`

The outer container already has padding for desktop (`md:pt-[72px]`) but the mobile title header is hidden. However, the flex column starts with the hidden header, which may still have invisible spacing. The real issue is likely that there's a gap from the parent `<main id="cg-main">` which has padding-top injected by the layout.

Check `src/app/layout.tsx` — it injects:
```css
#cg-main { padding-top: 52px; }
```

This means the menu page content starts 52px below the header, then the `h-screen` container tries to fill the screen but is already pushed down, potentially causing the gap.

**Fix:** Override the main padding on mobile within the menu page so the swipe view sits flush:

```tsx
// In MenuPageClient.tsx, the outer div:

// BEFORE (line 55-57)
<div
  className="h-screen overflow-hidden flex flex-col"
  style={{ color: theme.text }}
>

// AFTER — use 100dvh and account for the header by padding-top on this container itself
<div
  className="fixed inset-0 flex flex-col pt-[52px] md:pt-[72px] md:relative md:h-screen"
  style={{ color: theme.text }}
>
```

Using `fixed inset-0` on mobile makes the container cover the entire viewport, then `pt-[52px]` pushes content below the fixed site header. This eliminates any gap from the `<main>` padding. On desktop, `md:relative md:h-screen` keeps the existing behavior.

**Alternative simpler approach** — if the above causes layout issues, just add negative margin on mobile to the `MenuMobileSwipe` container to pull it up:

In `MenuPageClient.tsx`, on the mobile wrapper div:

```tsx
// BEFORE (line 100)
<div className="md:hidden h-full">

// AFTER — pull up to eliminate gap on mobile
<div className="md:hidden h-full -mt-2">
```

Try the first approach first — it's cleaner. The negative margin is a fallback.

### File: `src/components/ui/MenuMobileSwipe.tsx`

Also make sure the tab bar itself has zero top margin/padding that could add space:

```tsx
// The TabBar component — currently has py-0.5 which adds a tiny gap above and below
// This is fine, but ensure there's no additional margin on the parent

// The main container (line 288):
// BEFORE
<div className="h-full flex flex-col">

// AFTER — no change needed if the parent fix above works
<div className="h-full flex flex-col">
```

---

## Change 2: Tap card → flip in-place to show details (no enlarged overlay)

### Problem

Currently when the user taps a swipe card, it opens the `EnlargedTileOverlay` — a separate centered overlay with a flip animation showing the front (image + text) first, then requiring another tap to flip to the back (details). Even though `startFlipped` is set to `true`, the user still sees a flip animation and a separate modal-style overlay. Mike wants it simpler: **tap the card → the card itself flips over in-place to show the details on its back**.

### File: `src/components/ui/MenuMobileSwipe.tsx`

**Add a `flipped` state to `SwipeCard`** so the card can flip in-place without opening any overlay:

```tsx
interface SwipeCardProps {
  item: MenuItem;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onSwipe: (dir: "left" | "right") => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}

function SwipeCard({
  item,
  isFavorited,
  onToggleFavorite,
  onSwipe,
  textColor,
  mutedColor,
  bgColor,
}: SwipeCardProps) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;
  const canFlip = hasBackContent(item);
  const [isFlipped, setIsFlipped] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const rightOpacity = useTransform(x, [20, 110], [0, 1], { clamp: true });
  const leftOpacity = useTransform(x, [-110, -20], [1, 0], { clamp: true });
  const dragRef = useRef(false);

  // ... existing reaction state and drag handlers ...

  function handleClick() {
    if (!dragRef.current && canFlip) {
      setIsFlipped((prev) => !prev);
    }
  }

  const backLines = [
    item.tagLine,
    item.ingredients,
    item.tastingNotes,
    item.notableNotes,
  ].filter(Boolean) as string[];

  return (
    <motion.div
      style={{ x, rotate }}
      drag={isFlipped ? false : "x"}  // Disable horizontal drag when flipped (so user can scroll details)
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      // Perspective for 3D flip
      style={{ x, rotate, perspective: 1200 }}
    >
      <div
        className="w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRONT FACE ── */}
        <div
          onClick={handleClick}
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* ... existing front face content: image, gradient, reaction stamps, info panel ... */}
          {/* Everything currently inside the motion.div moves here */}
        </div>

        {/* ── BACK FACE (details) ── */}
        <div
          onClick={() => setIsFlipped(false)}
          className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundColor: bgColor,
            cursor: "pointer",
          }}
        >
          {/* Header — title + price */}
          <div className="shrink-0 px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${textColor}30` }}>
            <h2
              className="text-2xl tracking-wider leading-tight"
              style={{ fontFamily: "var(--font-display)", color: item.titleColor ?? textColor }}
            >
              {item.title}
            </h2>
            {item.price && (
              <p className="text-base mt-1" style={{ color: item.priceColor ?? "#C97D5A" }}>
                {item.price}
              </p>
            )}
            {item.description && (
              <p className="text-sm mt-2 leading-relaxed opacity-70" style={{ color: mutedColor }}>
                {item.description}
              </p>
            )}
          </div>

          {/* Detail content — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {backLines.map((line, i) => (
              <p
                key={i}
                className="leading-relaxed"
                style={{
                  color: mutedColor,
                  fontSize: i === 0 ? "1rem" : "0.9375rem",
                  opacity: i === 0 ? 1 : 0.85,
                  fontStyle: i === 0 ? "italic" : "normal",
                }}
              >
                {line}
              </p>
            ))}
          </div>

          {/* Footer hint */}
          <div className="shrink-0 px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${textColor}20` }}>
            <p className="text-[10px] tracking-widest uppercase opacity-40" style={{ color: textColor }}>
              Tap to flip back
            </p>
            {/* Heart button on back face too */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart
                size={20}
                fill={isFavorited ? "#C97D5A" : "none"}
                stroke={isFavorited ? "#C97D5A" : textColor}
                style={{ opacity: 0.6 }}
              />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

**Key behavioral details:**

1. **`drag={isFlipped ? false : "x"}`** — when the card is flipped to the back, disable horizontal dragging. This prevents accidental swipes while the user is reading details or scrolling the content. They need to tap to flip back to the front before they can swipe again.

2. **Tap toggles flip** — tapping the front flips to back, tapping the back flips to front. No separate overlay, no modal, no additional tap needed.

3. **Back face is scrollable** — `overflow-y-auto` on the details content area so long ingredient lists can scroll.

4. **Larger text on back** — since the back face fills the entire card (not a small overlay), use larger font sizes: `text-2xl` title, `text-base` price, `1rem`/`0.9375rem` for detail lines.

5. **Heart button on back face** — so users can favorite while reading details without flipping back.

6. **The `onTap` prop is removed** from `SwipeCardProps` — the card handles flip internally now.

**Remove the `EnlargedTileOverlay` usage from the mobile swipe view:**

In the main `MenuMobileSwipe` component:
- Remove the `enlargedItem` state variable.
- Remove the `enlargedStartFlipped` state variable (if present).
- Remove the `EnlargedTileOverlay` JSX block at the bottom.
- Remove the `import EnlargedTileOverlay from "./EnlargedTileOverlay"` if it's no longer used by this file.
- Update `SwipeCard` usage — remove `onTap` prop, add `textColor`, `mutedColor`, `bgColor` props instead.

```tsx
{/* Active swipe card — updated props */}
{currentItem && (
  <SwipeCard
    key={`${currentItem.id}-${wrappedIndex}`}
    item={currentItem}
    isFavorited={isFavorited}
    onToggleFavorite={() => onToggleFavorite(currentItem.id)}
    onSwipe={handleSwipe}
    textColor={textColor}
    mutedColor={mutedColor}
    bgColor={bgColor}
  />
)}
```

**Note:** `EnlargedTileOverlay` is still used by the desktop grid (`MenuTileGrid.tsx`) and the list view (`MenuListView.tsx`), so don't delete the file — just remove the import from `MenuMobileSwipe.tsx`.

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/menu/MenuPageClient.tsx` | Fix mobile container to eliminate gap between site header and tab bar |
| `src/components/ui/MenuMobileSwipe.tsx` | Add in-place flip to SwipeCard, remove EnlargedTileOverlay usage, remove `onTap` prop, add color props for back face |

---

## Acceptance criteria

1. **No gap on mobile:** The tab bar sits flush against the bottom of the site header with no visible blank background strip between them.
2. **Tap to flip:** Tapping a swipe card flips it in-place to show details (title, price, description, tagLine, ingredients, tastingNotes, notableNotes) on the back. No separate overlay opens.
3. **Tap to flip back:** Tapping the back of the card flips it back to the front (image side).
4. **No swipe when flipped:** Horizontal swiping is disabled while the card shows the details side, preventing accidental navigation while reading.
5. **Scrollable details:** If the detail content is long, the back face scrolls vertically.
6. **Heart on back face:** Users can favorite/unfavorite from the details view.
7. **Desktop unchanged:** The desktop grid still uses the EnlargedTileOverlay as before.
