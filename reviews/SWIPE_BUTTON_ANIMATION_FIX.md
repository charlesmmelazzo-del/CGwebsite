# Swipe View — Smooth Next/Back Button Animations

**For:** Claude Code
**Scope:** When the user taps the Next or Back (undo) button in the mobile swipe view, the card should animate out like a swipe was performed — not just instantly swap.

---

## Problem

Currently in `src/components/ui/MenuMobileSwipe.tsx`:

- **Drag-swiping** a card triggers `animate(x, ±500)` which flies the card off screen smoothly before advancing. This looks great.
- **Tapping Next** calls `handleNext()` → `setGlobalIndex(prev + 1)` which instantly replaces the card with no animation. It feels jarring and broken compared to the swipe.
- **Tapping Back/Undo** calls `handlePrev()` → `setGlobalIndex(prev - 1)` which also instantly swaps with no animation.

## Solution

Make the Next and Back buttons trigger the same fly-out animation that dragging does, THEN advance the index after the animation completes.

### File: `src/components/ui/MenuMobileSwipe.tsx`

**Step 1: Lift the `x` MotionValue up so the parent can trigger animations on it.**

Currently `x` is created inside `SwipeCard` with `useMotionValue(0)`. Move it up to the parent `MenuMobileSwipe` component and pass it down as a prop:

```tsx
// In MenuMobileSwipe component body (around line 208):
const cardX = useMotionValue(0);

// Reset x to 0 whenever the card changes (new globalIndex)
useEffect(() => {
  cardX.set(0);
}, [globalIndex, cardX]);
```

Update `SwipeCardProps` to accept the motion value:

```tsx
interface SwipeCardProps {
  item: MenuItem;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onSwipe: (dir: "left" | "right") => void;
  onTap: () => void;
  x: MotionValue<number>;  // ADD THIS
}
```

Inside `SwipeCard`, remove the local `const x = useMotionValue(0);` and use the prop instead:

```tsx
function SwipeCard({ item, isFavorited, onToggleFavorite, onSwipe, onTap, x }: SwipeCardProps) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;
  // REMOVE: const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  // ... rest unchanged
```

Pass it when rendering:

```tsx
<SwipeCard
  key={`${currentItem.id}-${wrappedIndex}`}
  item={currentItem}
  isFavorited={isFavorited}
  onToggleFavorite={() => onToggleFavorite(currentItem.id)}
  onSwipe={handleSwipe}
  onTap={() => { /* ... */ }}
  x={cardX}
/>
```

**Step 2: Add an `isAnimating` ref to prevent double-taps during animation:**

```tsx
const isAnimating = useRef(false);
```

**Step 3: Rewrite `handleNext` and `handlePrev` to animate before advancing:**

```tsx
function handleNext() {
  if (isAnimating.current || allItems.length === 0) return;
  isAnimating.current = true;
  // Animate card flying out to the left (like swiping left / "next")
  animate(cardX, -500, { duration: 0.35, ease: "easeOut" }).then(() => {
    setGlobalIndex((prev) => prev + 1);
    cardX.set(0);
    isAnimating.current = false;
  });
}

function handlePrev() {
  if (isAnimating.current || globalIndex === 0) return;
  isAnimating.current = true;
  // Animate card flying out to the right (like it's being "undone")
  animate(cardX, 500, { duration: 0.35, ease: "easeOut" }).then(() => {
    setGlobalIndex((prev) => Math.max(0, prev - 1));
    cardX.set(0);
    isAnimating.current = false;
  });
}
```

**Step 4: Also prevent swipe-during-animation in SwipeCard:**

In the `handleDragEnd` inside `SwipeCard`, the animation already works correctly — it calls `onSwipe` after the fly-out completes. But to prevent the user from dragging while a button animation is playing, you can check `x.get()`:

```tsx
// In SwipeCard's drag handler — no change needed because:
// 1. When isAnimating is true, the card is flying off screen
// 2. The key prop changes on globalIndex change, unmounting the old card
// 3. The new card mounts with x reset to 0
```

Actually since the `key` on `SwipeCard` includes `wrappedIndex`, the old card unmounts when `globalIndex` changes. The animation plays on the current card, then the index advances, which unmounts it and mounts a fresh card at x=0. This is clean — no extra guards needed inside `SwipeCard`.

**Step 5: Import `MotionValue` type (add to the existing framer-motion import):**

```tsx
import { motion, useMotionValue, useTransform, animate, type PanInfo, type MotionValue } from "framer-motion";
```

---

## Visual behavior after fix

| Action | Animation |
|--------|-----------|
| Drag swipe right | Card flies right with rotation → next card appears |
| Drag swipe left | Card flies left with rotation → next card appears |
| Tap Next button (→) | Card animates left off screen (0.35s ease-out) → next card appears |
| Tap Back button (↺) | Card animates right off screen (0.35s ease-out) → previous card appears |
| Tap Tab | Card animates left off screen → jumps to first item in that section |

**Optional enhancement for tab clicks:** Update `handleTabClick` to also animate:

```tsx
function handleTabClick(tabId: string) {
  const bp = sectionBreakpoints.find((b) => b.tabId === tabId);
  if (!bp || isAnimating.current) return;
  isAnimating.current = true;
  // Animate current card out
  animate(cardX, -500, { duration: 0.3, ease: "easeOut" }).then(() => {
    setGlobalIndex(bp.startIndex);
    setActiveTabId(tabId);
    cardX.set(0);
    isAnimating.current = false;
  });
}
```

---

## Files to modify

| File | Change |
|------|--------|
| `src/components/ui/MenuMobileSwipe.tsx` | Lift `x` MotionValue to parent, pass as prop, animate on Next/Back/Tab click before advancing index |

## Acceptance criteria

1. Tapping Next animates the card flying left (like a swipe) before showing the next card
2. Tapping Back/Undo animates the card flying right before showing the previous card
3. Tapping a tab animates the current card out before jumping to that section
4. Double-tapping rapidly doesn't cause glitches (animation lock prevents it)
5. Manual drag-swipe still works exactly as before
6. No jittering or instant jumps when using buttons
