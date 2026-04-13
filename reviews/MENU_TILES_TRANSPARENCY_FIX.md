# Menu Tiles — Transparency / Readability Fix

**For:** Claude Code
**Scope:** Fix two bugs in `src/components/ui/MenuTileGrid.tsx` where the enlarged tile overlay and flipped tile are transparent/unreadable.

---

## Problem

1. **Enlarged front face** — The text area below the image uses `backgroundColor: ${textColor}08` which is essentially transparent (8 = ~3% opacity). On the page's background image, the text floats on nothing and is unreadable.

2. **Flipped back face** — Same issue: `backgroundColor: ${textColor}08` is see-through. Additionally, because the back face is `position: absolute; inset: 0`, both the front and back face are visible simultaneously during and after the flip since neither has an opaque background to hide the other side.

3. **Grid tiles** — The grid tiles themselves have no `backgroundColor` at all, so on background images they can also look washed out.

---

## Fix — file: `src/components/ui/MenuTileGrid.tsx`

### 1. Give the enlarged FRONT face a solid background

Find the front face's text container (around line 270):

```tsx
// BEFORE
<div className="p-5" style={{ backgroundColor: `${textColor}08` }}>
```

Change to a solid dark background:

```tsx
// AFTER
<div className="p-5" style={{ backgroundColor: "#1a1a1a" }}>
```

Also give the entire front face card a solid background so the image area doesn't show through. Add `backgroundColor: "#1a1a1a"` to the front face's outer `<div>` style (around line 228):

```tsx
// BEFORE (front face outer div)
style={{
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  cursor: canFlip ? "pointer" : "default",
  borderRadius: "2px",
  overflow: "hidden",
  border: `1px solid ${textColor}20`,
}}

// AFTER
style={{
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  cursor: canFlip ? "pointer" : "default",
  borderRadius: "2px",
  overflow: "hidden",
  border: `1px solid ${textColor}20`,
  backgroundColor: "#1a1a1a",
}}
```

### 2. Give the enlarged BACK face a solid background

Find the back face container (around line 308):

```tsx
// BEFORE
backgroundColor: `${textColor}08`,

// AFTER
backgroundColor: "#1a1a1a",
```

This is critical — with an opaque background on both faces plus `backface-visibility: hidden`, only the currently visible face shows. No bleed-through.

### 3. Give grid tiles an opaque background

In the `MenuTile` component, add a solid background to the `<button>` element (around line 100-103):

```tsx
// BEFORE
style={{ border: `1px solid ${textColor}20` }}

// AFTER
style={{ border: `1px solid ${textColor}20`, backgroundColor: "#1a1a1a" }}
```

This ensures the grid tiles are readable even when the page has a background image.

### 4. Fix the border/divider colors on the back face

The back face uses `${textColor}15` for borders which may also be invisible on the dark background. Update these to use a lighter value:

```tsx
// Back header border (around line 314)
// BEFORE
style={{ borderBottom: `1px solid ${textColor}15` }}
// AFTER
style={{ borderBottom: `1px solid ${textColor}30` }}

// Back footer border (around line 347)
// BEFORE
style={{ borderTop: `1px solid ${textColor}15` }}
// AFTER
style={{ borderTop: `1px solid ${textColor}30` }}
```

---

## Summary of changes

All changes are in one file: **`src/components/ui/MenuTileGrid.tsx`**

| Location | What | Before | After |
|----------|------|--------|-------|
| `MenuTile` button | Add background | no backgroundColor | `backgroundColor: "#1a1a1a"` |
| Enlarged front face outer div | Add background | no backgroundColor | `backgroundColor: "#1a1a1a"` |
| Enlarged front face text area | Solid background | `${textColor}08` | `"#1a1a1a"` |
| Enlarged back face container | Solid background | `${textColor}08` | `"#1a1a1a"` |
| Back face header border | More visible | `${textColor}15` | `${textColor}30` |
| Back face footer border | More visible | `${textColor}15` | `${textColor}30` |

The `#1a1a1a` color is a near-black that matches the dark/moody aesthetic of the terracotta theme. If the site uses a different base dark color, adjust accordingly — the key requirement is that it's **fully opaque**, not transparent.

---

## Acceptance criteria

1. Enlarged tile front face has a solid dark background — text is fully readable over any page background.
2. Enlarged tile back face has a solid dark background — detail text is fully readable.
3. When flipped, only one face is visible at a time (no bleed-through of the other side).
4. Grid tiles in the default view also have a solid background for readability.
5. Border/divider lines on the back face are subtly visible.
