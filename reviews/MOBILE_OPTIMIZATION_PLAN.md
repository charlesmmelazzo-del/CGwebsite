# Mobile Optimization — Background Images, Viewport-Fitted Carousels, Overall Sizing

**For:** Claude Code
**Scope:** Three concerns: (1) disable background images on mobile and use flat theme colors instead, (2) size all carousels so they fit on-screen without scrolling on mobile, (3) general mobile sizing pass so content fits comfortably on phone screens. The `md:` breakpoint (768px) is already the standard throughout the codebase — keep using it as the mobile/desktop dividing line.

---

## Current state

**Background images** (`src/components/layout/PageThemeWrapper.tsx`):
- Applied via inline `style={{ backgroundImage: url(...), backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}` on the wrapper div.
- No responsive logic — the same full-bleed image loads on every screen size.
- A `bg-black/50` dark overlay is applied when a custom bg image exists.

**Home carousel** (`src/components/home/HomeCarousel.tsx`):
- Container: `max-w-3xl mx-auto` (768px max).
- Slides: `flex: 0 0 100%` (full width per slide).
- Images: `max-h-64 md:max-h-96` (256px mobile / 384px desktop).
- No viewport-height constraint — a tall slide can push content below the fold.

**Menu carousel** (`src/components/ui/MenuCarousel.tsx`):
- Card flex-basis: `min(320px, 85vw)` — already somewhat responsive on width.
- Card height: **hardcoded `360px`** inline style — no responsive sizing.
- Card image area: **hardcoded `h-[220px]`** Tailwind class.
- Used by both `/menu` and `/coffee`.

**Header** (`src/components/layout/Header.tsx`):
- Mobile header is 52px tall (config-driven `mobileHeaderHeight`).
- Desktop header is 72px tall.
- Breakpoint at `md:` (768px) — `hidden md:flex` for desktop, `flex md:hidden` for mobile.

**Global CSS** (`src/app/globals.css`):
- `.embla__slide { flex: 0 0 100% }` — all Embla slides default to full-width.
- No `dvh` / `svh` / viewport-height-based sizing anywhere.

**Tailwind** (`tailwind.config.ts`):
- Default breakpoints, no customization. Only `md:` is actively used in components.

---

## Task 1 — Desktop-only background images, flat color on mobile

### Goal

On mobile (<768px), page backgrounds should be the theme's flat color (already defined in `THEMES` object) — no image download, no fixed-attachment scroll jank, faster load. On desktop (≥768px), background images display as they do today.

### Changes to `src/components/layout/PageThemeWrapper.tsx`

Replace the current inline background-image approach with a responsive pattern:

```tsx
// Current (applies everywhere):
style={{ backgroundImage: `url(${bgImageUrl})`, backgroundSize: "cover", ... }}

// New approach — use a CSS class + media query instead of inline style:
```

**Option A (recommended — CSS media query via a `<style>` tag):**

Add a scoped `<style>` block inside the component (same pattern already used in `layout.tsx` for header padding):

```tsx
const bgId = `bg-${useId()}`;   // unique ID per instance

return (
  <>
    {bgImageUrl && (
      <style>{`
        @media (min-width: 768px) {
          #${bgId} {
            background-image: url(${bgImageUrl});
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
          }
        }
      `}</style>
    )}
    <div
      id={bgId}
      className="min-h-screen transition-colors duration-500"
      style={{ backgroundColor: theme.bg }}
    >
      {/* The dark overlay should also be desktop-only */}
      {bgImageUrl && (
        <div className="hidden md:block fixed inset-0 bg-black/50 pointer-events-none" />
      )}
      {children}
    </div>
  </>
);
```

Key points:
- `backgroundColor: theme.bg` is always set — it's the mobile background and the desktop fallback.
- The `background-image` is only applied at `min-width: 768px`, so mobile never downloads or renders it.
- The dark overlay (`bg-black/50`) uses `hidden md:block` so it only appears when the image does.
- `background-attachment: fixed` stays desktop-only (it causes scroll jank on iOS and most mobile browsers ignore it anyway).

**Option B (Tailwind arbitrary variant):**

If the team prefers no `<style>` tag:
```tsx
className={clsx(
  "min-h-screen transition-colors duration-500",
  bgImageUrl && "md:bg-cover md:bg-center md:bg-fixed"
)}
style={{
  backgroundColor: theme.bg,
  // Only set backgroundImage if we're using the Tailwind approach
  ...(bgImageUrl ? { '--bg-img': `url(${bgImageUrl})` } as React.CSSProperties : {}),
}}
```
Then in `globals.css`:
```css
@media (min-width: 768px) {
  .md\:bg-cover { background-image: var(--bg-img); }
}
```

Option A is cleaner — go with that unless there's a strong reason not to.

### Acceptance
- On mobile (<768px): pages show flat theme background color, no image loads, no dark overlay.
- On desktop (≥768px): background images display exactly as they do today (cover, centered, fixed).
- The botanical illustration (when `showIllustration` is true) continues to work on both — it's decorative SVG, not a heavy image.
- No layout shift when crossing the breakpoint.

---

## Task 2 — Viewport-fitted carousels on mobile

### Goal

On mobile, carousels should fit within the visible screen so the user sees a complete slide without needing to scroll down. The carousel (including its navigation dots/arrows) should feel like a single "screen" you swipe through, not a tall block you scroll past.

### 2a. Home carousel (`src/components/home/HomeCarousel.tsx`)

**Current problem:** no height constraint. A text slide with large font or an image slide with `max-h-64` (256px) plus padding, dots, and the header eats into the viewport unpredictably. On a 667px-tall iPhone SE the carousel content can extend below the fold.

**Fix — constrain the carousel area to available viewport height on mobile:**

Calculate available height = viewport height − mobile header height − some breathing room for the page title and dots.

```tsx
// In the carousel wrapper:
<div
  className="relative w-full max-w-3xl mx-auto"
  style={{
    // On mobile, cap to available viewport space
    // 52px mobile header + ~80px page title area + ~40px dot nav = ~172px overhead
    // Use dvh (dynamic viewport height) which accounts for mobile browser chrome
  }}
>
```

Add a mobile-specific max-height using CSS:

```css
/* In globals.css or scoped <style> */
@media (max-width: 767px) {
  .home-carousel-viewport {
    max-height: calc(100dvh - 170px);
    overflow: hidden;
  }
  .home-carousel-viewport .embla__slide {
    max-height: calc(100dvh - 220px);  /* leave room for dots below */
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

Apply the class `home-carousel-viewport` to the Embla viewport div.

Also adjust image sizing for mobile:
```tsx
// Current:
className="object-contain max-h-64 md:max-h-96 w-auto"
// Change to:
className="object-contain max-h-[calc(100dvh-280px)] md:max-h-96 w-auto"
```

This makes images scale to fit whatever vertical space is available on mobile, rather than a fixed 256px.

**Text slides:** add a mobile overflow guard:
```tsx
<div className="max-h-[calc(100dvh-240px)] md:max-h-none overflow-hidden flex items-center justify-center">
  {/* text content */}
</div>
```

**Form slides:** these will naturally need more space. For form slides specifically, allow vertical scrolling within the slide container on mobile (the form is interactive — users expect to scroll a form). Add `overflow-y-auto` to form slide wrappers on mobile only.

### 2b. Menu carousel (`src/components/ui/MenuCarousel.tsx`)

**Current problem:** cards are always 360px tall with a 220px image area. On an iPhone SE (667px viewport), after the 52px header + ~120px page title + tab bar, there's roughly 450px of space. A 360px card fits, but just barely, and the dots/scrollbar are pushed out of view.

**Fix — make card height responsive:**

Replace the hardcoded heights with responsive values:

```tsx
// Current (inline style):
style={{ height: "360px" }}

// New — use a CSS variable or responsive class:
// Small phones (< 380px wide): ~280px tall
// Normal phones (< 768px): ~320px tall  
// Desktop: 360px (unchanged)
```

Implementation approach — use a CSS class instead of inline style:

```css
/* In globals.css */
.menu-card {
  height: min(360px, calc(100dvh - 300px));
}

@media (min-width: 768px) {
  .menu-card {
    height: 360px;  /* desktop: always 360px */
  }
}
```

Similarly, the image area:
```tsx
// Current:
className="h-[220px]"
// New:
className="h-[180px] md:h-[220px]"
```

And the card flex-basis:
```tsx
// Current:
flex: "0 0 min(320px, 85vw)"
// New — slightly narrower on very small screens:
flex: "0 0 min(320px, 88vw)"
// 88vw instead of 85vw gives the card a bit more breathing room
// (on a 390px screen: 88% = 343px, capped at 320px — same result,
//  but on a 360px screen: 88% = 317px vs 85% = 306px — less cramped)
```

**Dot indicators / scrollbar:** ensure they're visible within the viewport. Add a `pb-4 md:pb-0` to the carousel container so the nav elements don't get clipped on mobile.

### Acceptance
- On an iPhone SE (375×667) and iPhone 14 (390×844): the home carousel shows a full slide plus dots without any vertical scrolling needed.
- Menu/coffee cards scale down on smaller screens so the card + dots fit on screen.
- On desktop: everything stays exactly as it is today — 360px cards, current image sizes, no changes.
- `dvh` is used instead of `vh` for mobile height calculations (handles iOS Safari's dynamic toolbar correctly).
- Form slides are the exception — they may need internal scroll on very small screens, and that's OK.

---

## Task 3 — General mobile sizing pass

### Goal

Make sure text, spacing, and interactive elements are comfortable on phones. This is a sweep across multiple components, not a single-file change.

### 3a. Page titles

**Current:** titles use `clamp(1.5rem, 7vw, ${titleSize}px)` — this is already responsive, good. But on very small screens (320px), `7vw` = 22px which can be tight for long page titles like "EVENTS."

**Fix:** bump the floor: `clamp(1.75rem, 7vw, ${titleSize}px)` — 28px minimum instead of 24px. Check all page headers that use this pattern:
- `src/app/events/EventsPageClient.tsx`
- `src/app/coffee/CoffeePageClient.tsx`  
- `src/app/menu/MenuPageClient.tsx`
- Any other page using `header.titleSize` with clamp

### 3b. Tab bars

**Current:** tab buttons use `px-5 py-2.5 text-xs tracking-widest` — on mobile with 4 tabs (e.g. Seasonal / Classics / Non-Alcoholic / Beer & Wine), this can overflow or wrap awkwardly.

**Fix:**
- Add `overflow-x-auto` and `flex-nowrap whitespace-nowrap` to the tab bar container on mobile so tabs scroll horizontally instead of wrapping.
- Reduce mobile padding: `px-3 md:px-5 py-2 md:py-2.5`.
- Add `-webkit-overflow-scrolling: touch` and `scrollbar-width: none` (hide the scrollbar on the tab strip — swipe to discover is fine for 4 tabs).

Apply this to:
- Menu page tab bar
- Coffee page tab bar
- Events page tab bar
- Shop page tab bar

### 3c. Touch targets

**Current:** some interactive elements (carousel arrows, dot indicators, tab buttons) may be smaller than the recommended 44×44px minimum.

**Fix:**
- Carousel prev/next arrows: ensure the clickable area is at least `w-11 h-11` (44px) on mobile, even if the visible icon is smaller. Use padding to expand the hit area.
- Dot indicators: wrap each dot in a `p-2` touch target.
- All buttons/links in the footer and nav: minimum `py-3` on mobile for comfortable tapping.

### 3d. Content max-widths

**Current:** many content areas use `max-w-2xl` (672px) or `max-w-3xl` (768px), which is fine. But some have `px-6` (24px) padding on both sides, which on a 375px screen leaves only 327px for content.

**Fix:** reduce horizontal padding on mobile:
- `px-4 md:px-6` on content wrappers (16px on mobile instead of 24px — gains 16px of content width).
- Apply to: `HostTextSection`, `HostPdfSection`, event list cards, about/club/shop content sections.

### 3e. Font size floor

**Current:** some labels use `text-[10px]` (10px) — this is too small to read on mobile.

**Fix:** audit all `text-[10px]` usage in **public-facing** components (admin panel is fine at 10px). Bump to `text-[11px] md:text-[10px]` where needed. This mainly affects:
- Carousel dot labels if any
- Small captions under images
- Event date/time metadata

### 3f. Mobile header hamburger drawer

**Current:** the mobile drawer (`md:hidden px-5 pb-5 animate-fade-in`) renders nav links vertically. No scroll container.

**Fix:** if there are many nav links, add `max-h-[calc(100dvh-60px)] overflow-y-auto` to the drawer so it scrolls on very small screens. Also ensure the drawer has a semi-transparent backdrop and that tapping outside closes it.

---

## Files to modify

| File | Changes |
|------|---------|
| `src/components/layout/PageThemeWrapper.tsx` | Desktop-only bg images via media query; mobile gets flat theme color; desktop-only dark overlay |
| `src/components/home/HomeCarousel.tsx` | Add `home-carousel-viewport` class; responsive image max-height; viewport-fitted slide heights on mobile |
| `src/components/ui/MenuCarousel.tsx` | Responsive card height (dvh-based on mobile, 360px on desktop); responsive image area; bottom padding for dots |
| `src/app/globals.css` | Add `.home-carousel-viewport` and `.menu-card` media queries; horizontal-scroll tab bar styles; touch target utilities |
| `src/app/events/EventsPageClient.tsx` | Responsive tab bar (horizontal scroll, smaller padding); title clamp floor bump |
| `src/app/menu/MenuPageClient.tsx` | Responsive tab bar; title clamp floor bump |
| `src/app/coffee/CoffeePageClient.tsx` | Same tab bar + title fixes as menu |
| `src/components/layout/Header.tsx` | Scrollable mobile drawer with max-height |
| Any page using `HostTextSection` / `HostPdfSection` | Reduce mobile padding `px-4 md:px-6` |

---

## Important implementation notes

- **Use `dvh` (dynamic viewport height), not `vh`**, for all mobile viewport calculations. `vh` on iOS Safari includes the area behind the URL bar, causing content to be taller than the visible screen. `dvh` adjusts correctly. If browser support is a concern, provide a `vh` fallback: `max-height: calc(100vh - 170px); max-height: calc(100dvh - 170px);`
- **Do not add new breakpoints** — keep using `md:` (768px) as the single mobile/desktop threshold for consistency with the existing codebase.
- **Do not touch desktop layout** — every change in this plan should be scoped to `max-width: 767px` or use `md:` to preserve desktop. Desktop should render identically to how it does today.
- **Test on real viewport sizes:** iPhone SE (375×667), iPhone 14 (390×844), iPhone 14 Pro Max (430×932), and a small Android (360×640). The `dvh`-based calculations should handle all of these.

---

## Acceptance criteria

1. On mobile (<768px): page backgrounds are flat theme colors — no background image loads, no dark overlay, no fixed-attachment.
2. On desktop (≥768px): background images render exactly as before.
3. Home carousel slides fit within the visible mobile viewport — a full slide + navigation dots are visible without scrolling down.
4. Menu/coffee carousel cards scale down in height on mobile so the card + navigation fits on screen.
5. Tab bars scroll horizontally on mobile instead of wrapping.
6. Touch targets are ≥44px on all interactive carousel/nav elements.
7. Content padding is tighter on mobile (16px vs 24px) to maximize readable area.
8. No regressions on desktop — pixel-identical to current state.

## Out of scope

- Everything in the other plan files (events redesign, home carousel features, menu continuous carousel, etc.) — this plan is purely about mobile optimization of existing components.
