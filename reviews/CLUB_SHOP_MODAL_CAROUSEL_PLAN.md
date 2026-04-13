# Editable Club & Shop Pages, External Shop Modal, Menu Carousel Polish

**For:** Claude Code
**Scope:** Five concerns: (1) make Club and Shop pages fully editable from admin, (2) let admin configure Toast/OZNR shop URLs per tab, (3) improve the external-site modal so customers can browse/checkout then return seamlessly, (4) enable desktop trackpad/multitouch swiping on the menu carousel, (5) make the menu carousel scrollbar subtle and on-brand.

---

## Current state

**Club page** (`src/app/club/page.tsx`):
- Hardcoded single `ContentSection` with title "Common Good Cocktail Club", body text, and a button pointing to `https://commongoodcocktailhouse.com/cocktailclub`.
- Theme: plum (fixed).
- Header (title/subtitle) is CMS-driven via `getPageHeader("club")`.

**Shop page** (`src/app/shop/ShopPageClient.tsx`):
- Four hardcoded tabs: Bottles & Merch, Cocktails To Go, Memberships, Gift Cards.
- Each tab has a hardcoded `ContentSection` with a title, body, and a button — **all four buttons point to the same placeholder URL** (`https://commongoodcocktailhouse.com/shop`).
- Tab labels are CMS-driven via `header.tabs` with hardcoded fallbacks.
- Theme: teal (fixed).

**ExternalModal** (`src/components/ui/ExternalModal.tsx`):
- Iframe-based overlay: loads external URL in an 85vh modal with a dark toolbar showing the URL, an "open in new tab" icon, and a close button.
- If the iframe is blocked by X-Frame-Options, the iframe silently hides with **no fallback UI** — the user sees a blank white modal.
- Used by `ContentSectionBlock` when any button is clicked.

**Menu carousel scrollbar** (`src/components/ui/MenuCarousel.tsx`):
- Native `<input type="range">` with `accentColor: "#C97D5A"` and `w-full cursor-pointer`.
- Looks like a default browser range slider — not styled to match the site's aesthetic.

**Menu carousel touch/swipe** (Embla config):
- `{ loop, align: "center", skipSnaps: false }` — Embla handles pointer events internally, but desktop trackpad two-finger horizontal swiping may not be smooth depending on Embla version and event propagation.

---

## Task 1 — Make Club and Shop pages editable from admin

### Strategy

Follow the same pattern as the About page plan (`PAGE_BUILDER_AND_ABOUT_PLAN.md` Task 2): store page content in the `pages` table with a reserved slug, create dedicated admin editors, and render sections dynamically on the public page using `PageSectionRenderer`.

### 1a. Club page

**Create `src/app/admin/club/page.tsx`:**
- Dedicated section editor for the Club page using the shared page builder section components (TextSectionEditor, ImageSectionEditor, CtaSectionEditor, CarouselSectionEditor, SpacerSectionEditor).
- Drag-to-reorder, add/remove sections, live preview panel.
- Saves to `pages` table with `slug: "club"`, `theme: "plum"`.
- Default seed data (loaded when no saved content exists):
  ```typescript
  const DEFAULT_CLUB_SECTIONS: PageSection[] = [
    {
      id: "club-1", order: 0, visible: true, type: "text",
      title: "Common Good Cocktail Club",
      body: "When you subscribe to Common Good Cocktail House you'll unlock exclusive access...",
      buttonLabel: "Find Out More & Join",
      buttonUrl: "https://commongoodcocktailhouse.com/cocktailclub",
      buttonNewTab: true,
    },
  ];
  ```

**Update `src/app/club/page.tsx`:**
- Replace hardcoded `CLUB_SECTIONS` with a database fetch via `getPageBySlug("club")`.
- Fall back to the default seed if no saved data.
- Render sections via the shared `PageSectionRenderer` component.

**Add "CLUB" to admin sidebar and dashboard.**

### 1b. Shop page

The shop page is more complex because it has **tabs**, each with its own content. The admin needs to be able to edit each tab's sections independently, configure the external shop URLs per tab, and manage which tabs are visible.

**Create `src/app/admin/shop/page.tsx`:**
- Tab manager at the top: add/remove/rename/reorder tabs. Each tab has:
  - `id` (string, e.g. "bottles", "cocktails", "memberships", "giftcards")
  - `label` (e.g. "Bottles & Merch")
  - `visible` (boolean)
  - `externalShopUrl` — **the Toast or OZNR URL for this tab's "Shop" button**
  - `externalShopLabel` — button text (e.g. "Shop Now", "Buy Tickets", "Join")
  - `sections` — array of `PageSection[]` for that tab's content
- When a tab is selected in the admin, show its section editor (same as About/Club — Text, Image, CTA, Carousel, Spacer sections with full styling).
- The `externalShopUrl` field should be prominent at the top of each tab's editor with a label like **"Shop / Purchase URL (Toast, OZNR, etc.)"** and a text input. This is the URL that opens when customers click the main CTA.
- **Save format:** Store in `pages` table with `slug: "shop"`. The sections field holds a structure like:
  ```typescript
  {
    tabs: [
      {
        id: "bottles",
        label: "Bottles & Merch",
        visible: true,
        externalShopUrl: "https://oznr.com/your-store/merch",
        externalShopLabel: "Shop Now",
        sections: [/* PageSection[] */],
      },
      // ...
    ]
  }
  ```

**Default seed data:** mirror the four current hardcoded tabs with their current content, but with placeholder URLs that Mike can replace.

**Update `src/app/shop/ShopPageClient.tsx`:**
- Load tab + section data from the database instead of `SHOP_CONTENT`.
- For each tab, render its sections via `PageSectionRenderer`.
- The main CTA button per tab uses `externalShopUrl` and opens via the improved ExternalModal (Task 2).
- If a tab has no `externalShopUrl`, don't render a shop button — just show the content sections.

**Add "SHOP" to admin sidebar and dashboard.**

### Add reserved slugs

Update the page builder's `RESERVED_SLUGS` list to include `"club"` and `"shop"` alongside `"about"`.

### Files to create/modify

| File | Change |
|------|--------|
| `src/app/admin/club/page.tsx` | **NEW** — Club page section editor |
| `src/app/admin/shop/page.tsx` | **NEW** — Shop page tab + section editor with external URL fields |
| `src/app/club/page.tsx` | Replace hardcoded sections with DB fetch + PageSectionRenderer |
| `src/app/shop/ShopPageClient.tsx` | Replace hardcoded SHOP_CONTENT with DB-driven tabs + sections |
| Admin sidebar + dashboard | Add CLUB and SHOP entries |
| Page builder slug validation | Add "club" and "shop" to RESERVED_SLUGS |

### Acceptance
- Admin can edit Club page content: add/remove/reorder sections with full styling, images, buttons, carousels.
- Admin can edit each Shop tab independently: rename tabs, set external shop URLs, edit content sections.
- Public Club and Shop pages render the admin-managed content.
- Current content appears as default seed data on first load — nothing goes blank.
- External shop URLs are per-tab and configurable in admin (not hardcoded).

---

## Task 2 — Improve the ExternalModal for a seamless shop/checkout experience

### Goal

When a customer clicks "Shop Now" or any external-link button, they should be able to browse and check out on the external platform (Toast, OZNR, etc.) within a clean overlay, then close it and be right back on Common Good's site. The current modal works but has two problems: (a) no fallback when the iframe is blocked, and (b) no loading state.

### Changes to `src/components/ui/ExternalModal.tsx`

**Add a loading state:**

```tsx
const [loading, setLoading] = useState(true);
const [blocked, setBlocked] = useState(false);

<iframe
  onLoad={() => setLoading(false)}
  onError={() => { setLoading(false); setBlocked(true); }}
/>
```

While loading, show a centered spinner with the Common Good brand color and a subtle "Loading..." label. This gives the user confidence that something is happening while Toast/OZNR loads (these platforms can be slow).

**Add a proper fallback when the iframe is blocked:**

Many external sites set `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'none'`, which silently blocks the iframe. Currently the modal just shows a blank white area.

When the iframe fails or after a 5-second timeout with no `onLoad`:

```tsx
{blocked && (
  <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
    <p className="text-sm text-gray-600">
      This site can't be loaded inline — click below to continue in a new tab.
    </p>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="px-8 py-3 bg-[#C97D5A] text-white text-sm tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
    >
      Continue to Shop
    </a>
    <button onClick={onClose} className="text-xs text-gray-400 mt-2 hover:text-gray-600">
      Go Back
    </button>
  </div>
)}
```

This is critical — Toast and OZNR may or may not allow iframing. The fallback ensures customers always have a path forward.

**Improve the toolbar:**

- Show the site name instead of the raw URL (extract hostname: `new URL(url).hostname` → display "oznr.com" or "toasttab.com").
- Add a subtle "Return to Common Good" label next to the close button so customers know they can get back.
- On mobile: make the modal full-screen (`h-[100dvh] w-full` instead of `max-w-4xl mx-4 h-[85vh]`) for a better checkout experience on small screens. Keep the toolbar fixed at top.

**Add body scroll lock:**

When the modal is open, prevent the background page from scrolling:

```tsx
useEffect(() => {
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = ""; };
}, []);
```

**Smooth entrance/exit animation:**

The overlay already uses `fadeIn`. Add a slight scale-up on the modal panel:

```css
.iframe-modal-panel {
  animation: modalIn 0.25s ease;
}
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
```

### Acceptance
- Clicking a shop button opens the modal with a loading spinner.
- If the iframe loads successfully, the external site displays inline — customer can browse and checkout.
- If the iframe is blocked, a clean fallback shows with a "Continue to Shop" button (opens in new tab) and a "Go Back" button.
- On mobile, the modal goes full-screen for a better experience.
- Close button and Escape key return the user to the Common Good page immediately.
- Background doesn't scroll while the modal is open.

---

## Task 3 — Desktop trackpad/multitouch swiping on the menu carousel

### Goal

On desktop devices with trackpads (MacBooks, etc.), users should be able to two-finger horizontal swipe through the menu carousel smoothly, the same way they'd swipe on mobile.

### Current state

Embla Carousel handles pointer events internally. By default, Embla uses mouse drag events and may not respond to trackpad scroll gestures unless configured correctly.

### Fix

Embla v8+ supports the `watchDrag` option and natively handles touch events. For trackpad horizontal scroll (which fires `wheel` events, not pointer events), enable the `wheelGestures` behavior:

**Option A — Use `embla-carousel-wheel-gestures` plugin:**

```bash
npm install embla-carousel-wheel-gestures
```

```tsx
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';

const [emblaRef, emblaApi] = useEmblaCarousel(
  { loop, align: "center", skipSnaps: false },
  [WheelGesturesPlugin()]   // enables trackpad horizontal swipe
);
```

This is the cleanest approach — the plugin translates horizontal wheel/trackpad gestures into carousel navigation. It handles momentum, direction locking (so vertical scrolling still works), and snap behavior.

**Option B — If the plugin doesn't exist or doesn't work well:**

Add a manual wheel event listener on the Embla viewport:

```tsx
useEffect(() => {
  if (!emblaApi) return;
  const viewport = emblaApi.rootNode();

  function onWheel(e: WheelEvent) {
    // Only handle horizontal-dominant gestures (trackpad swipe)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      if (e.deltaX > 30) emblaApi.scrollNext();
      if (e.deltaX < -30) emblaApi.scrollPrev();
    }
  }

  viewport.addEventListener("wheel", onWheel, { passive: false });
  return () => viewport.removeEventListener("wheel", onWheel);
}, [emblaApi]);
```

**Go with Option A** — it's purpose-built for this exact use case and handles edge cases (momentum decay, direction thresholds) better than a manual listener.

### Apply to both carousels

Add the plugin to:
- `src/components/ui/MenuCarousel.tsx` (menu + coffee)
- `src/components/home/HomeCarousel.tsx` (home page)

### Acceptance
- On a MacBook (or any trackpad device), two-finger horizontal swiping on the menu carousel smoothly navigates between cards.
- Vertical scrolling still works normally (the plugin only captures horizontal gestures).
- No impact on mobile touch behavior — Embla's native touch handling continues unchanged.
- Home carousel also supports trackpad swiping.

---

## Task 4 — Subtle, on-brand carousel scrollbar

### Goal

Replace the default browser `<input type="range">` with a custom-styled scrollbar that blends into the page design.

### Current state

```tsx
<input
  type="range"
  min={0} max={slides.length - 1}
  value={selectedIndex}
  onChange={(e) => emblaApi?.scrollTo(Number(e.target.value))}
  className="w-full cursor-pointer"
  style={{ accentColor: "#C97D5A" }}
/>
```

This renders the native browser range input with an orange accent. It's functional but visually sticks out — it doesn't match the site's refined aesthetic.

### Replace with a custom progress bar

Remove the `<input type="range">` and replace with a styled progress track:

```tsx
{slides.length > 1 && (
  <div className="px-8 md:px-12 mt-5">
    <div
      className="relative h-[2px] w-full rounded-full overflow-hidden cursor-pointer"
      style={{ backgroundColor: `${textColor}15` }}
      onClick={(e) => {
        // Click-to-seek: calculate position and scroll
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const index = Math.round(ratio * (slides.length - 1));
        emblaApi?.scrollTo(index);
      }}
    >
      {/* Progress fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${((selectedIndex + 1) / slides.length) * 100}%`,
          backgroundColor: `${textColor}30`,
        }}
      />
    </div>
  </div>
)}
```

**Design details:**
- **Track:** 2px tall, full width with generous horizontal padding (32px mobile, 48px desktop), background at 15% of the page's text color — barely visible, just a hint.
- **Fill:** left-to-right progress at 30% of the text color — visible but understated. Animates smoothly as the user swipes (300ms ease-out transition).
- **Click-to-seek:** clicking anywhere on the track jumps to that position in the carousel.
- **No thumb/handle:** the fill itself indicates position. This is much cleaner than a draggable handle for a carousel progress indicator.
- **Colors adapt to theme:** uses `textColor` from the page theme, not a hardcoded hex, so it works on every page color (green for menu, olive for coffee, etc.).

**Optional enhancement — drag-to-seek:**

If you want the user to be able to drag the progress bar (like a video scrubber), add pointer event handlers:

```tsx
onPointerDown → start tracking
onPointerMove → update position and scroll carousel
onPointerUp → stop tracking
```

This is nice-to-have but not essential — the dots and swipe/arrows are the primary nav. Click-to-seek on the track is enough.

### Apply to MenuCarousel only

The home carousel has its own dot navigation; this scrollbar replacement is specific to the menu/coffee carousel in `src/components/ui/MenuCarousel.tsx`.

### Acceptance
- The browser-default range input is gone from the menu carousel.
- A subtle 2px progress bar shows position in the carousel, colored to match the page theme.
- Clicking the bar jumps to that position.
- The bar is visually quiet — it enhances the design rather than competing with it.
- Works on both mobile and desktop.

---

## Files to create/modify (all tasks)

| File | Change |
|------|--------|
| `src/app/admin/club/page.tsx` | **NEW** — Club page editor |
| `src/app/admin/shop/page.tsx` | **NEW** — Shop page tab + section + URL editor |
| `src/app/club/page.tsx` | DB-driven sections via PageSectionRenderer |
| `src/app/shop/ShopPageClient.tsx` | DB-driven tabs + sections + external URLs |
| `src/components/ui/ExternalModal.tsx` | Loading state, blocked fallback, full-screen mobile, scroll lock, hostname display |
| `src/app/globals.css` | Modal animation keyframes |
| `src/components/ui/MenuCarousel.tsx` | Replace range input with progress bar; add WheelGesturesPlugin |
| `src/components/home/HomeCarousel.tsx` | Add WheelGesturesPlugin |
| `package.json` | Add `embla-carousel-wheel-gestures` |
| Admin sidebar + dashboard | Add CLUB and SHOP entries |
| Page builder slug validation | Add "club", "shop" to RESERVED_SLUGS |

---

## Acceptance criteria (overall)

1. Club and Shop pages are fully editable from admin with sections, images, buttons, and carousels.
2. Each Shop tab has a configurable external URL (Toast, OZNR, etc.) set by admin.
3. Clicking a shop button opens a polished modal where customers can browse/checkout, with a clean fallback if the iframe is blocked.
4. Modal goes full-screen on mobile; shows a loading spinner while the external site loads; background doesn't scroll.
5. Desktop trackpad swiping works smoothly on the menu and home carousels.
6. Menu carousel scrollbar is a subtle, theme-matched 2px progress bar instead of the default browser range input.

## Out of scope

- Everything in the other plan files (events redesign, mobile optimization, home carousel features, about page, etc.).
