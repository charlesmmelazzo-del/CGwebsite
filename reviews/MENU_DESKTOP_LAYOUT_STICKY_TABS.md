# Menu Page — Instagram-Style Tiles (Mobile + Desktop) + Sticky Tab Bar

**For:** Claude Code
**Scope:** Restyle the menu tile grid on BOTH mobile and desktop to match Instagram's tight photo-grid aesthetic — square tiles, minimal gaps, image-only in the grid, info on tap. Tab bar stays anchored at top, tab clicks scroll to sections.

**Replaces:** The previous version of this plan that only applied Instagram styling to desktop.

**File:** `src/components/ui/MenuTileGrid.tsx` (primary)

---

## Current state

- Grid: `grid-cols-2 md:grid-cols-3`, `gap-3 md:gap-6`
- Tiles have 4:3 aspect images with a text area below (title, price, description)
- Tiles have rounded corners, visible borders, and visible text below each image
- Tab bar is pinned via flex layout (works but `scrollToSection` uses `scrollIntoView` which doesn't work well with the internal scroll container)

## Target — Instagram-style on both mobile and desktop

Instagram's profile grid:
- **3 columns** on all screen sizes
- **Square tiles** (1:1 aspect ratio)
- **Minimal gap** — 2–4px between tiles
- **Image only** in the grid — no text below tiles
- **No rounded corners, no borders** — clean flush edges
- Text/info appears when you tap a tile (our enlarge → flip interaction handles this)

We're adapting this for both mobile and desktop. The enlarge + flip interaction stays exactly as-is — this plan only changes the grid view appearance.

---

## Changes

### 1. Grid layout — 3 columns everywhere, tight gap

```tsx
// BEFORE
<div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-10">

// AFTER
<div className="grid grid-cols-3 gap-[3px] mb-8">
```

- **3 columns on all screen sizes** — matches Instagram exactly. On a 390px phone that's ~128px per tile, which is plenty for a square cocktail photo.
- **`gap-[3px]`** — uniform 3px gap everywhere (Instagram uses ~3px). Using Tailwind's arbitrary value syntax.
- `mb-8` instead of `mb-10` since the tighter grid needs less breathing room between sections.

### 2. Grid container — full-width, minimal padding

```tsx
// BEFORE
<div className="max-w-4xl mx-auto px-4 md:px-6 pb-8">

// AFTER
<div className="max-w-5xl mx-auto px-0 md:px-0 pb-8">
```

- **No horizontal padding** (`px-0`) — tiles go edge-to-edge within the container, just like Instagram.
- `max-w-5xl` (1024px) on desktop prevents the grid from getting absurdly wide on large screens.

### 3. MenuTile — square, image-only, no borders

Replace the entire `MenuTile` component:

```tsx
function MenuTile({
  item,
  onClick,
  textColor,
  mutedColor,
  bgColor,
}: {
  item: MenuItem;
  onClick: () => void;
  textColor: string;
  mutedColor: string;
  bgColor: string;
}) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;

  return (
    <button
      onClick={onClick}
      className="group relative w-full aspect-square overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97D5A] focus-visible:ring-inset"
      style={{ backgroundColor: bgColor }}
    >
      {/* Square image — fills the entire tile */}
      {imgSrc ? (
        <>
          <Image
            src={imgSrc}
            alt={item.alt ?? item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 33vw, 33vw"
          />

          {/* Hover/tap gradient — always subtle on mobile, stronger on desktop hover */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100"
          />

          {/* Title overlay — appears on hover (desktop) */}
          <div className="absolute inset-0 flex flex-col justify-end p-2.5 md:p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <h3
              className="text-xs md:text-sm tracking-wider leading-tight line-clamp-2 drop-shadow-md"
              style={{ fontFamily: "var(--font-display)", color: "#fff" }}
            >
              {item.title}
            </h3>
            {item.price && (
              <p className="text-[10px] md:text-xs mt-0.5 drop-shadow-md" style={{ color: "#C97D5A" }}>
                {item.price}
              </p>
            )}
          </div>
        </>
      ) : (
        /* No-image placeholder */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span
            className="select-none opacity-20"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: textColor }}
          >
            CG
          </span>
          <span
            className="text-[10px] tracking-wider opacity-30 line-clamp-1 px-2 text-center"
            style={{ fontFamily: "var(--font-display)", color: textColor }}
          >
            {item.title}
          </span>
        </div>
      )}
    </button>
  );
}
```

Key changes from current tile:
- **`aspect-square`** — 1:1 on all screen sizes, not 4:3.
- **No text area below the image** — the entire tile is the image.
- **No border, no rounded corners** — clean flush square.
- **Title/price overlay on hover** (desktop) — fades in over a dark gradient. On mobile there's no hover, so the tile is just the image; tapping opens the enlarged view where all info is visible.
- **No-image placeholder** now includes the item title so you can still identify items without photos.
- **`sizes="33vw"`** on both breakpoints since we're always 3 columns now.

### 4. Section headers — slimmer to match tight grid

```tsx
// BEFORE
<div id={id} className="flex items-center gap-4 py-6" style={{ scrollMarginTop: "12px" }}>

// AFTER
<div id={id} className="flex items-center gap-3 py-3 px-3" style={{ scrollMarginTop: "12px" }}>
```

Tighter padding (`py-3` instead of `py-6`, added `px-3` for alignment) keeps the section headers proportional to the tight grid. They should feel like lightweight dividers, not heavy section breaks.

### 5. Fix scrollToSection for internal scroll container

The current implementation uses `el.scrollIntoView()` which doesn't work properly with the internal `overflow-y-auto` scroll container. Replace with manual container scroll:

```tsx
function scrollToSection(tabId: string) {
  const el = document.getElementById(`section-${tabId}`);
  const container = scrollContainerRef.current;
  if (el && container) {
    const containerTop = container.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const offset = elTop - containerTop + container.scrollTop;
    container.scrollTo({ top: offset - 8, behavior: "smooth" });
  }
  setActiveTabId(tabId);
}
```

The `-8` offset gives a tiny bit of breathing room above the section header when scrolled to.

### 6. Tab bar — keep current anchored behavior, minor visual tweak

The tab bar is already anchored via the flex layout. No structural change needed. But since the grid is now tighter and more visual, reduce the tab bar's visual weight slightly:

```tsx
// BEFORE
<div
  className="shrink-0 tab-bar-scroll flex justify-center gap-0 px-4 py-0.5"
  style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
>

// AFTER
<div
  className="shrink-0 tab-bar-scroll flex justify-center gap-0 px-3 py-0.5"
  style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
>
```

Slightly more transparent (`0.3` vs `0.35`) and stronger blur (`12px` vs `10px`) so it feels lighter and more like a frosted-glass overlay.

### 7. Mobile touch feedback

Since mobile has no hover state, add a subtle active/pressed feedback so tiles feel tappable:

On the `MenuTile` button, add:

```tsx
className="... active:scale-[0.97] active:brightness-90 transition-all duration-150"
```

This gives a quick "press in" effect when tapping a tile on mobile — similar to how Instagram tiles respond to touch.

---

## Summary of all changes

| Location | What | Before | After |
|----------|------|--------|-------|
| Grid div | Column count | `grid-cols-2 md:grid-cols-3` | `grid-cols-3` |
| Grid div | Gap | `gap-3 md:gap-6` | `gap-[3px]` |
| Grid container | Padding | `px-4 md:px-6` | `px-0` |
| Grid container | Max width | `max-w-4xl` | `max-w-5xl` |
| `MenuTile` | Aspect ratio | `aspect-[4/3]` | `aspect-square` |
| `MenuTile` | Text below image | Visible always | Removed entirely |
| `MenuTile` | Borders | `1px solid` + `rounded-sm` | None |
| `MenuTile` | Hover overlay | None | Dark gradient + title/price in white |
| `MenuTile` | Touch feedback | None | `active:scale-[0.97]` press effect |
| `MenuTile` | Image sizes | `50vw / 33vw` | `33vw` everywhere |
| Section headers | Padding | `py-6 gap-4` | `py-3 gap-3 px-3` |
| `scrollToSection` | Scroll method | `el.scrollIntoView()` | Manual `container.scrollTo()` |
| Tab bar | Background | `rgba(0,0,0,0.35) blur(10px)` | `rgba(0,0,0,0.3) blur(12px)` |

---

## Files to modify

| File | Change |
|------|--------|
| `src/components/ui/MenuTileGrid.tsx` | All changes listed above — grid, tiles, section headers, scroll, tab bar |

No changes needed to `MenuPageClient.tsx` or any other file.

---

## Acceptance criteria

1. **Both mobile and desktop:** tiles display in a tight 3-column grid with square (1:1) images, 3px gap, no text below tiles, no borders, no rounded corners.
2. **Desktop hover:** hovering a tile fades in a dark gradient with the title and price overlaid in white.
3. **Mobile tap feedback:** pressing a tile gives a brief scale-down press effect.
4. **Tab bar anchored:** stays fixed at the top of the content area on both viewports while tiles scroll.
5. **Tab click scrolls:** clicking a tab smooth-scrolls the internal scroll container to that section.
6. **Active tab tracks scroll:** as the user scrolls through sections, the highlighted tab updates automatically.
7. **Enlarge + flip unchanged:** the overlay interaction (click tile → enlarge → flip for details) works exactly as before.
8. **No-image tiles:** tiles without photos show a "CG" placeholder with the item title, still in square format.
