# Menu Page — Tile Grid Layout with Enlarge + Flip Interaction

**For:** Claude Code
**Scope:** Replace the Embla carousel on `/menu` with a responsive tile grid grouped by tab categories. Tiles enlarge on click; enlarged tiles flip to reveal details. This plan **supersedes** `MENU_CONTINUOUS_CAROUSEL_PLAN.md` — that file is now obsolete.

---

## Current state (what we're replacing)

**`src/components/ui/MenuCarousel.tsx`** (339 lines):
- Embla Carousel with centered, 320px-wide slides.
- `FlipCard` component already exists — CSS 3D flip (0.55s, perspective 1200px).
- Front: image + title + price + description + "Tap for details" hint.
- Back: tagLine, ingredients, tastingNotes, notableNotes (values only, no field labels).
- Section divider cards between tab groups.
- Tab bar + section dots + range-input scrollbar.
- Items flow in one continuous horizontal carousel; tabs scroll you to a section.

**`src/app/menu/MenuPageClient.tsx`** (67 lines):
- Filters active tabs + items, passes flat list to `MenuCarousel`.
- Theme: terracotta (fixed).

**`src/types/index.ts` — `MenuItem`**:
```typescript
interface MenuItem {
  id: string;
  tabId: string;
  title: string;
  description?: string;
  carouselImageUrl?: string;
  menuPageImageUrl?: string;
  imageUrl?: string;  // deprecated
  alt?: string;
  price?: string;
  order: number;
  active: boolean;
  tagLine?: string;
  ingredients?: string;
  tastingNotes?: string;
  notableNotes?: string;
  titleColor?: string;
  descriptionColor?: string;
  priceColor?: string;
}
```

No type changes needed — the existing `MenuItem` fields map cleanly to the tile front (image, title, price, description) and back (tagLine, ingredients, tastingNotes, notableNotes).

---

## Design overview

### Three interaction states

```
┌──────────────┐       click tile        ┌──────────────────┐      click enlarged      ┌──────────────────┐
│  GRID VIEW   │  ──────────────────►    │  ENLARGED VIEW   │  ──────────────────►     │  FLIPPED VIEW    │
│  all tiles   │                         │  single tile,    │                          │  single tile,    │
│  in sections │  ◄──────────────────    │  front face      │  ◄──────────────────     │  back face       │
│              │    "✕" minimize btn      │  zoomed in       │    tap flipped card      │  details shown   │
└──────────────┘                         └──────────────────┘                          └──────────────────┘
```

1. **Grid view** — all tiles visible in a responsive grid, grouped under tab/category headers. This is the default state.
2. **Enlarged view** — one tile is selected and displayed larger (front face: image + title + price + description). The rest of the grid fades/blurs behind an overlay. A "✕" button (or "Back to menu" text link) lets the user return to the grid.
3. **Flipped view** — the enlarged tile flips over to show detail text (tagLine, ingredients, tastingNotes, notableNotes — values only, no field headers). Clicking the flipped card flips it back to front. The same minimize button is still available.

### Layout — Grid view

**Tab bar (sticky at top of content area):**
- Horizontal row of category tabs: e.g. "Seasonal", "Classics", "Non-Alcoholic", "Beer & Wine".
- Same visual style as the current tab bar: `tracking-widest uppercase text-xs`, active tab gets `border-b-2 border-[#C97D5A] text-[#C97D5A]`, inactive tabs are `opacity-60`.
- Clicking a tab smooth-scrolls the page to that section's header within the grid.
- On mobile, if tabs overflow, the tab bar scrolls horizontally (same `tab-bar-scroll` class with hidden scrollbar as current).
- The tab bar should be sticky (`sticky top-[52px]` on mobile, `sticky top-[72px]` on desktop — matching the header height) so it's always accessible while scrolling through items. Give it a semi-transparent background that matches the page theme so content scrolls behind it cleanly.

**Section headers within the grid:**
- Each tab group starts with a section header: the tab label rendered in the display font, centered, with thin decorative lines on either side (same aesthetic as the current `DividerCard`).
- These headers serve as scroll targets when users click tabs.
- Add an `id` attribute to each section header (e.g. `id="section-seasonal"`) for scroll targeting.

**Tile grid:**
- CSS Grid layout.
- **Desktop (md+):** `grid-cols-3`, gap of 24px, max-width ~900px, centered.
- **Mobile (<md):** `grid-cols-2`, gap of 12px, full width with 16px horizontal padding.
- Each tile is a uniform card — all tiles same size within the grid.
- The grid container should have `max-w-4xl mx-auto px-4 md:px-6`.

**Individual tile (grid state):**
- Aspect ratio roughly 3:4 (portrait) — use `aspect-[3/4]` or fixed heights.
- **Image area:** top ~60% of tile. Use `object-cover` for the cocktail photo (`carouselImageUrl ?? imageUrl`). If no image, show the "CG" placeholder in the display font (same pattern as current `FlipCard`).
- **Text area:** bottom ~40%.
  - Title: display font, `text-sm md:text-base`, tracking-wider, one or two lines max with `line-clamp-2`.
  - Price: accent color `#C97D5A`, `text-xs`.
  - Description: muted color, `text-xs`, `line-clamp-2`.
- Subtle border: `border border-[${textColor}20]` (same 1px semi-transparent border as current cards).
- Rounded: `rounded-sm` (minimal, matches current).
- On hover (desktop): slight scale-up (`scale-[1.02]`) and subtle shadow to hint interactivity.
- Cursor: `pointer` if the item has back content OR an image to enlarge; otherwise `default`.

**Empty state:**
If no active items exist at all, show centered text: "No items yet" — same as the current carousel empty state.

### Enlarged view

When a user clicks a tile:

1. **Overlay:** a dark semi-transparent backdrop (`bg-black/60`) covers the full viewport. Clicking the overlay returns to grid view (same as clicking "✕").

2. **Enlarged card:** centered on screen, larger than the grid tile.
   - **Desktop:** max-width ~420px, auto height based on content, vertically centered in viewport.
   - **Mobile:** nearly full-width (max-width `calc(100vw - 48px)`), vertically centered.
   - Same card layout as the grid tile but bigger — image fills top, text below.
   - Image area: taller, `h-[260px] md:h-[320px]`, `object-cover`.
   - Title: larger, `text-xl md:text-2xl`, display font.
   - Price: `text-sm`, accent color.
   - Description: full text (no line-clamp), `text-sm`, muted color.
   - If the item has back content (`tagLine || ingredients || tastingNotes || notableNotes`), show a subtle hint: "Tap for details" in `text-[10px] tracking-widest uppercase opacity-40` — same as the current FlipCard hint.

3. **Minimize button:** a "✕" icon in the top-right corner of the enlarged card (or floating just outside it). `w-8 h-8`, semi-transparent background, white icon. Also accept Escape key to close.

4. **Animation (enlarge):** animate from the grid tile's position to the centered enlarged position. Use CSS `transition` or Framer Motion `layoutId` for a smooth expand effect. If Framer Motion is not installed, a simpler approach works:
   - Grid tile fades out, enlarged card fades/scales in from center with `transition: opacity 0.2s, transform 0.3s`.
   - This is sufficient — don't over-engineer the animation.

5. **Scroll lock:** when enlarged, prevent background scrolling (`document.body.style.overflow = "hidden"`). Restore on close.

### Flipped view

When the user clicks the enlarged card (and the item has back content):

1. The card flips with the same 3D CSS transform currently used in `FlipCard`:
   - `perspective: 1200px` on the container.
   - `transform: rotateY(180deg)` with `transition: transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)`.
   - `backface-visibility: hidden` on both faces.

2. **Back face content:**
   - Title + price at top (same as current back face: display font, accent price).
   - Divider line.
   - Detail lines: tagLine, ingredients, tastingNotes, notableNotes — **values only, no field labels**. Each as its own paragraph.
   - First line (tagLine) renders slightly larger + italic (same as current back face styling).
   - Scrollable if content overflows (`overflow-y-auto` on the content area).
   - "Tap to flip back" hint at bottom in tiny uppercase text.

3. Clicking the flipped card flips it back to front (still enlarged).

4. The "✕" minimize button remains visible and functional on both front and back of the enlarged card — user can return to grid from either state.

### Mobile-specific adjustments

- **Grid:** 2 columns, 12px gap, 16px horizontal page padding.
- **Tiles:** slightly smaller text (`text-xs` for title, `text-[10px]` for price/description).
- **Enlarged card:** fills most of the viewport width, with 24px margin on each side.
- **Sticky tab bar:** positioned below the 52px mobile header (`top-[52px]`). Background should match the page theme with a slight opacity so content scrolling behind it is barely visible.
- **Touch interaction:** tap to enlarge (not hover). Tap enlarged to flip. Tap "✕" or overlay to close.
- Ensure the enlarged card + overlay fits within `100dvh` (dynamic viewport height) so the mobile browser chrome doesn't cause overflow.

### Desktop-specific adjustments

- **Grid:** 3 columns, 24px gap, max-width 900px centered.
- **Tiles:** hover effect (`scale-[1.02]`, light shadow).
- **Enlarged card:** max-width 420px, vertically + horizontally centered.
- **Sticky tab bar:** positioned below the 72px desktop header (`top-[72px]`).

---

## Implementation

### Step 1: Create the MenuTileGrid component

Create a new file: `src/components/ui/MenuTileGrid.tsx`

This is the main component that replaces `MenuCarousel`. It receives the same props:

```tsx
interface Props {
  items: MenuItem[];
  tabs: MenuTab[];
  textColor: string;
  mutedColor: string;
}

export default function MenuTileGrid({ items, tabs, textColor, mutedColor }: Props) {
  const [enlargedId, setEnlargedId] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // Group items by tab
  const sections = tabs
    .filter(tab => items.some(i => i.tabId === tab.id))
    .map(tab => ({
      tab,
      items: items.filter(i => i.tabId === tab.id).sort((a, b) => a.order - b.order),
    }));

  // Scroll to section when tab clicked
  function scrollToSection(tabId: string) {
    const el = document.getElementById(`section-${tabId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Enlarge a tile
  function enlargeTile(itemId: string) {
    setEnlargedId(itemId);
    setIsFlipped(false);
    document.body.style.overflow = "hidden";
  }

  // Close enlarged view
  function closeTile() {
    setEnlargedId(null);
    setIsFlipped(false);
    document.body.style.overflow = "";
  }

  // Flip the enlarged tile
  function flipTile() {
    setIsFlipped(prev => !prev);
  }

  // ... render
}
```

**Component structure inside the return:**

```
<div>
  {/* Sticky tab bar */}
  <StickyTabBar tabs={visibleTabs} activeTabId={...} onTabClick={scrollToSection} />

  {/* Grid sections */}
  {sections.map(({ tab, items }) => (
    <div key={tab.id}>
      <SectionHeader id={`section-${tab.id}`} label={tab.label} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 ...">
        {items.map(item => (
          <MenuTile key={item.id} item={item} onClick={() => enlargeTile(item.id)} />
        ))}
      </div>
    </div>
  ))}

  {/* Enlarged overlay — only renders when enlargedId is set */}
  {enlargedItem && (
    <EnlargedTileOverlay
      item={enlargedItem}
      isFlipped={isFlipped}
      onFlip={flipTile}
      onClose={closeTile}
    />
  )}
</div>
```

### Step 2: Build sub-components within MenuTileGrid.tsx

All of these can live in the same file (they're specific to the menu tile layout):

**`StickyTabBar`** — the horizontal tab row:
```tsx
function StickyTabBar({ tabs, activeTabId, onTabClick, textColor }: {
  tabs: MenuTab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  textColor: string;
}) {
  // Sticky positioning, semi-transparent themed background
  // Identical visual style to the current tab bar
  // Horizontal scroll on mobile with hidden scrollbar
}
```

Track which section is currently in view using an `IntersectionObserver` on the section headers, so the active tab updates as the user scrolls. This makes the tab bar reflect the user's scroll position, not just the last tab they clicked.

**`SectionHeader`** — category label between tile groups:
```tsx
function SectionHeader({ id, label, textColor, mutedColor }: {
  id: string;
  label: string;
  textColor: string;
  mutedColor: string;
}) {
  // Centered label in display font, small decorative lines on each side
  // Has scroll-margin-top to account for sticky header + tab bar
  // e.g. style={{ scrollMarginTop: "120px" }} so smooth-scroll lands correctly
}
```

**`MenuTile`** — individual tile in the grid:
```tsx
function MenuTile({ item, onClick, textColor, mutedColor }: {
  item: MenuItem;
  onClick: () => void;
  textColor: string;
  mutedColor: string;
}) {
  const imgSrc = item.carouselImageUrl ?? item.imageUrl;
  const canFlip = !!(item.tagLine || item.ingredients || item.tastingNotes || item.notableNotes);

  return (
    <button onClick={onClick} className="aspect-[3/4] ... group">
      {/* Image area — top portion */}
      {/* Text area — bottom portion: title, price, description (clamped) */}
      {/* Hover scale effect on desktop */}
    </button>
  );
}
```

**`EnlargedTileOverlay`** — the overlay + enlarged card with flip:
```tsx
function EnlargedTileOverlay({ item, isFlipped, onFlip, onClose, textColor, mutedColor }: {
  item: MenuItem;
  isFlipped: boolean;
  onFlip: () => void;
  onClose: () => void;
  textColor: string;
  mutedColor: string;
}) {
  const canFlip = !!(item.tagLine || item.ingredients || item.tastingNotes || item.notableNotes);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Dark overlay — click to close */}
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />

      {/* Enlarged card — centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div className="pointer-events-auto relative w-full max-w-[420px]"
             style={{ perspective: "1200px" }}>

          {/* Close button */}
          <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white ...">✕</button>

          {/* Flip container — same 3D CSS as current FlipCard */}
          <div style={{
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}>
            {/* FRONT face */}
            <div onClick={canFlip ? onFlip : undefined} style={{ backfaceVisibility: "hidden" }}>
              {/* Large image + title + price + full description + "Tap for details" hint */}
            </div>

            {/* BACK face */}
            <div onClick={onFlip} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              {/* Title + price header */}
              {/* tagLine (italic), ingredients, tastingNotes, notableNotes — values only */}
              {/* "Tap to flip back" hint at bottom */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

### Step 3: Update MenuPageClient.tsx

Replace the `MenuCarousel` import with `MenuTileGrid`:

```tsx
import MenuTileGrid from "@/components/ui/MenuTileGrid";

export default function MenuPageClient({ initialTabs, initialItems, header }: Props) {
  const theme = THEMES.terracotta;

  const activeTabs = initialTabs
    .filter((t) => t.active)
    .sort((a, b) => a.order - b.order);

  const activeItems = initialItems.filter((item) => item.active);

  return (
    <PageThemeWrapper fixedTheme="terracotta" showIllustration bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        {/* ... existing header JSX unchanged ... */}

        <div className="pb-16">
          <MenuTileGrid
            items={activeItems}
            tabs={activeTabs}
            textColor={theme.text}
            mutedColor={theme.muted}
          />
        </div>
      </div>
    </PageThemeWrapper>
  );
}
```

Note: we no longer flatten items into tab order here — `MenuTileGrid` handles grouping internally.

### Step 4: Clean up

- **Delete** `src/components/ui/MenuCarousel.tsx` — it is fully replaced.
- **Remove** the Embla-related CSS classes in `src/app/globals.css` (`.embla`, `.embla__container`, `.embla__slide`) **only if** they are not used by any other carousel on the site. Check `HomeCarousel.tsx` and any page-builder carousel usage first — those may still need Embla classes. If other carousels still use them, leave the CSS in place.
- **Remove** the `.menu-card` responsive height class from `globals.css` since tile sizing is handled by the grid + aspect-ratio utility.
- **Keep** `embla-carousel-react` in `package.json` — it's still used by HomeCarousel and potentially page builder carousels.

### Step 5: Verify admin panel still works

The admin panel for menu items (`src/app/admin/menu/page.tsx`) should require **no changes** — it already manages `MenuItem` objects with all the relevant fields (title, description, price, carouselImageUrl, tagLine, ingredients, tastingNotes, notableNotes, etc.). The tile layout just reads those same fields differently.

Confirm that:
- Adding/editing/reordering/toggling menu items in admin still works.
- New items appear in the tile grid under the correct tab.
- Items with images show the image; items without show the placeholder.
- Items with back content show the "Tap for details" hint and support flipping.
- Items without back content can still be enlarged (to see the full image + description) but don't show the flip hint and don't respond to flip click.

---

## Files to create/modify

| File | Change |
|------|--------|
| `src/components/ui/MenuTileGrid.tsx` | **NEW** — tile grid with enlarge + flip interaction |
| `src/app/menu/MenuPageClient.tsx` | Replace `MenuCarousel` import with `MenuTileGrid`, simplify item preparation |
| `src/components/ui/MenuCarousel.tsx` | **DELETE** — fully replaced by tile grid |
| `src/app/globals.css` | Remove `.menu-card` class; conditionally remove `.embla` classes if unused elsewhere |

---

## Acceptance criteria

1. **Grid view:** menu items display in a responsive tile grid — 2 columns on mobile, 3 on desktop — grouped under tab/category section headers.
2. **Tab bar:** horizontal tab bar at the top of the menu content, sticky below the site header. Clicking a tab smooth-scrolls to that section. Active tab highlights as user scrolls.
3. **Tile appearance:** each tile shows the cocktail image (top), title, price, and a truncated description. Consistent sizing across all tiles (same aspect ratio). Hover effect on desktop.
4. **Enlarge:** clicking a tile opens an enlarged view of that tile centered on screen over a dark overlay. Shows full image, title, price, and complete description. Escape key or "✕" button or overlay click returns to grid.
5. **Flip:** clicking the enlarged tile (if it has detail content) flips it with a 3D animation to show tagLine, ingredients, tastingNotes, and notableNotes — values only, no field headers. Clicking the back flips it to front again.
6. **Minimize:** a visible "✕" button on the enlarged card returns the user to the full grid view from either the front or back face.
7. **Empty state:** if no active menu items exist, show "No items yet" centered text.
8. **Responsive:** tiles and text size appropriately on mobile vs desktop. Enlarged card fits within the viewport on both.
9. **No carousel:** Embla carousel is no longer used on the menu page. The `MenuCarousel.tsx` file is deleted.
10. **Admin unchanged:** the admin panel for menu items requires no changes — all existing fields map to the new tile layout.

---

## Out of scope

- Changes to the admin panel for menu items (no new fields needed).
- Adding any new data fields to `MenuItem` type.
- Home page carousel changes (separate plan).
- Coffee menu changes (follows same pattern but is a separate task).
- Everything in the other plan files (events, about, club/shop, mobile optimization, page builder).
