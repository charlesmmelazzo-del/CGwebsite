# Mobile Menu — Fit Swipe View Within Visible Viewport (No Scroll)

**For:** Claude Code  
**Priority:** HIGH — the swipe card + navigation buttons currently extend below the visible viewport on mobile, requiring a scroll to reach the action bar.

---

## Root Cause

Two things are pushing the bottom of the layout offscreen:

1. **`h-screen` = `100vh`**, but on mobile browsers `100vh` includes the area behind the address bar/toolbar. The **actual visible area** is shorter. CSS has a modern unit for this: `dvh` (dynamic viewport height). `100dvh` equals the visible viewport and automatically adjusts when the mobile browser chrome appears/disappears.

2. **The `#cg-main` wrapper** (in `layout.tsx`) adds `padding-top: 52px` on mobile to clear the fixed header. But `h-screen` on the menu page measures from the top of the viewport, not from below the padding. So the container is 100vh tall but pushed down 52px — meaning 52px of content overflows at the bottom.

The fix is: make the outer container height = `100dvh - headerHeight` so it fits exactly in the visible space below the header.

---

## Fix

### File: `src/app/menu/MenuPageClient.tsx`

**Change the outer container** (currently line ~55):

**Before:**
```tsx
<div
  className="h-screen overflow-hidden flex flex-col"
  style={{ color: theme.text }}
>
```

**After:**
```tsx
<div
  className="overflow-hidden flex flex-col"
  style={{
    color: theme.text,
    height: "calc(100dvh - 52px)",   /* mobile: 100dvh minus mobile header */
  }}
>
```

The `52px` should match the mobile header height. Since the header height comes from the admin config, the ideal approach is to pass it as a prop or use a CSS variable. But for simplicity and consistency with the existing `#cg-main` padding approach, hardcoding `52px` works (it matches the default `mobileHeaderHeight`).

**Better approach — use a CSS variable set by layout.tsx:**

In `src/app/layout.tsx`, add CSS custom properties alongside the existing padding:

```css
#cg-main {
  padding-top: 52px;
  --header-h: 52px;
}
@media (min-width: 768px) {
  #cg-main {
    padding-top: 72px;
    --header-h: 72px;
  }
}
```

So the `<style>` tag in layout.tsx becomes:

```tsx
<style>{`
  #cg-main { padding-top: ${mobilePad}px; --header-h: ${mobilePad}px; }
  @media (min-width: 768px) { #cg-main { padding-top: ${desktopPad}px; --header-h: ${desktopPad}px; } }
`}</style>
```

Then in `MenuPageClient.tsx`:

```tsx
<div
  className="overflow-hidden flex flex-col"
  style={{
    color: theme.text,
    height: "calc(100dvh - var(--header-h, 52px))",
  }}
>
```

This makes it dynamic — if Mike changes the header height in admin, the menu page adjusts automatically.

---

### Browser support note

`dvh` is supported in all modern browsers (Safari 15.4+, Chrome 108+, Firefox 101+). For older browsers, add a fallback:

```tsx
style={{
  color: theme.text,
  height: "calc(100vh - var(--header-h, 52px))",       /* fallback */
  height: "calc(100dvh - var(--header-h, 52px))",      /* modern browsers override */
}}
```

**Note on duplicate `height`:** CSS allows duplicate properties — the browser uses the last one it understands. Older browsers ignore `dvh` and use the `vh` fallback. This is a standard progressive enhancement pattern.

However, React's `style` prop is a JS object and doesn't allow duplicate keys. So use this approach instead:

In `src/app/globals.css` (or a scoped CSS module), add a utility class:

```css
.menu-viewport {
  height: calc(100vh - var(--header-h, 52px));
  height: calc(100dvh - var(--header-h, 52px));
}
```

Then in the component:

```tsx
<div
  className="menu-viewport overflow-hidden flex flex-col"
  style={{ color: theme.text }}
>
```

**This is the recommended approach** — clean, uses the fallback pattern correctly, and keeps the JSX simple.

---

## Summary of changes

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add `--header-h` CSS variable to the existing `<style>` tag |
| `src/app/globals.css` | Add `.menu-viewport` class with `dvh`-based height + `vh` fallback |
| `src/app/menu/MenuPageClient.tsx` | Replace `h-screen` with `menu-viewport` class on the outer container |

---

## What this fixes

- The **tab bar**, **swipe card**, **counter row**, and **action bar** (heart, next, prev, list buttons) all fit within the visible screen on mobile
- No scrolling needed to see the full swipe interface
- Works correctly when the mobile browser address bar expands/collapses (the `dvh` unit handles this automatically)
- Desktop is unaffected (the header height variable adjusts via the media query)

## Verification

1. Open the menu page on an iPhone or Android phone (or use Chrome DevTools mobile emulation with the device toolbar)
2. The entire swipe interface — tabs at top, card in the middle, counter row, and action buttons at bottom — should be fully visible without scrolling
3. Swipe a few cards to confirm nothing shifted
4. Toggle the browser address bar (scroll on a different page to collapse it, then return) — the layout should adapt smoothly
