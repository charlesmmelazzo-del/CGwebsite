# Page Builder Carousel Editor + Editable About Page

**For:** Claude Code
**Scope:** Two things: (1) build the missing carousel section editor in the page builder so admins can add fully styled slide carousels to any page, and (2) make the About page editable from the admin panel using the existing page builder section system.

---

## Current state

**Page builder** (`src/app/admin/pages/page.tsx`, 989 lines):
- Six section types defined: Text, Image, CTA, Events, Spacer, **Carousel**.
- Text, Image, CTA, Events, and Spacer all have **working editors + live previews**.
- Carousel is a **placeholder**: the editor returns `"Carousel section — slides editor coming soon."` and the preview shows a dashed box with a carousel icon.
- The `CarouselSection` type already exists in `src/types/index.ts` (lines 230-235):
  ```typescript
  interface CarouselSection extends PageSectionBase {
    type: "carousel";
    slides: CarouselItem[];
    autoplay?: boolean;
    autoplayInterval?: number;
  }
  ```
- `CarouselItem` is a full union type (lines 18-83) with `CarouselTextItem`, `CarouselImageItem`, `CarouselFormItem`, and `CarouselInstagramItem` — all fully typed with font, color, alignment, and sizing fields.
- The home page admin already has a **complete working slide editor** for these same `CarouselItem` types in `src/app/admin/home/page.tsx` — the `SortableCard` component there handles Text, Image, Form, and Instagram slides with all their controls.

**About page** (`src/app/about/page.tsx`, 64 lines):
- **Completely hardcoded** — two static `ContentSection` objects ("Our Story" and "What We Do") defined inline.
- Uses `ContentSectionBlock` component for rendering, with `PageThemeWrapper` fixed to "blue" theme.
- Header (title/subtitle) is already dynamic via `getPageHeader("about")` — so the admin can already edit the page title. But the body content sections cannot be edited.
- No admin route exists for the about page content.

---

## Task 1 — Build the carousel section editor for the page builder

### Goal

Replace the "coming soon" placeholder with a full slide editor that lets admins add, remove, reorder, and configure carousel slides within any page they create in the page builder. The slide types should match what the home page already supports: Text, Image, Form, and Instagram.

### Strategy: reuse the home page's SortableCard component

The home admin (`src/app/admin/home/page.tsx`) already has a fully working `SortableCard` component that edits `CarouselItem` objects — text with font/size/color/alignment, images with upload + CTA button, Instagram with URL fetch + cache, and forms with field builder. Rather than rebuilding all of this, **extract the shared slide editing logic into a reusable component** and use it in both the home admin and the page builder.

### Step 1: Extract shared slide editor components

Create a new file: `src/components/admin/SlideEditor.tsx`

Move from `src/app/admin/home/page.tsx` into this shared file:
- `SortableCard` component (the per-slide editor with all controls)
- `InstagramSlideEditor` component
- `LinkSection` component
- The empty template constants: `EMPTY_TEXT`, `EMPTY_IMAGE`, `EMPTY_FORM`, `EMPTY_INSTAGRAM`
- The `FONT_OPTIONS` and `LETTER_SPACING_OPTIONS` arrays
- The Supabase storage cleanup helpers (`isStorageImageUrl`, `storagePathFromUrl`, `deleteStorageImage`)
- The `newId()` helper

Export them all. The home admin page then imports from this shared file instead of defining them inline.

### Step 2: Build CarouselSectionEditor

In `src/app/admin/pages/page.tsx`, replace the placeholder with a real editor:

```tsx
function CarouselSectionEditor({
  section,
  onChange,
}: {
  section: CarouselSection;
  onChange: (updates: Partial<CarouselSection>) => void;
}) {
  const slides = section.slides ?? [];

  // Reuse the shared slide management logic:
  // - Add slide (text/image/form/instagram)
  // - Remove slide (with storage cleanup)
  // - Toggle active
  // - Update slide fields
  // - Drag-to-reorder
  // - Form field add/update/remove
  // - Instagram refresh

  // Autoplay controls:
  // - Checkbox: "Auto-advance slides" (maps to section.autoplay)
  // - Slider: interval in seconds (maps to section.autoplayInterval, 2-30, default 6)
}
```

**Editor layout:**

1. **Autoplay controls** at the top — compact row:
   - Checkbox: `Auto-advance` (default true)
   - If checked: number input or slider for interval (seconds), min 2, max 30, default 6

2. **Slide list** — identical to the home page's slide list:
   - Each slide rendered via the shared `SortableCard` component
   - Drag handles for reordering (DndContext + SortableContext from `@dnd-kit`)
   - Active/Hidden toggle per slide
   - Remove button with storage cleanup
   - Full editing controls per slide type (font, color, alignment, sizing, image upload, Instagram fetch, form fields)

3. **Add slide** — dropdown + button at the bottom (same as home admin):
   - Options: Text Slide, Image Slide, Form Slide, Instagram Slide
   - Click "Add" to append

**onChange integration:**
Every slide edit calls `onChange({ slides: updatedSlides })`. Autoplay changes call `onChange({ autoplay: value })` or `onChange({ autoplayInterval: value })`.

### Step 3: Build CarouselSectionPreview

Replace the dashed-box placeholder with a working preview:

```tsx
function CarouselSectionPreview({
  section,
  theme,
}: {
  section: CarouselSection;
  theme: (typeof THEMES)[ThemeName];
}) {
  // Show a miniature representation of the slides:
  // - Horizontal row of slide thumbnails (scrollable if many)
  // - Active slides only
  // - Text slides: show truncated text in theme colors
  // - Image slides: show the image thumbnail
  // - Instagram slides: show cached image thumbnail
  // - Form slides: show a small form icon + title
  // - Show dots below (one per active slide)
  // - If autoplay enabled, show a small "▶ {N}s" indicator
}
```

The preview doesn't need to be a working carousel with animations — just a visual indicator of what the carousel will contain. A scrollable row of mini-cards is enough for the admin preview panel.

### Step 4: Wire into the SectionEditor router

In `src/app/admin/pages/page.tsx`, update the `SectionEditor` switch:

```tsx
case "carousel": return (
  <CarouselSectionEditor
    section={section as CarouselSection}
    onChange={onChange as (u: Partial<CarouselSection>) => void}
  />
);
```

And in `SectionPreview`:
```tsx
case "carousel": return (
  <CarouselSectionPreview
    section={section as CarouselSection}
    theme={theme}
  />
);
```

### Step 5: Public page rendering

The page builder's public rendering pipeline (wherever `PageSection[]` is mapped to React components on the public-facing page) needs to handle `type: "carousel"`. Render it using the same carousel component used on the home page (`src/components/home/HomeCarousel.tsx`) or a shared variant — pass `section.slides`, `section.autoplay`, and `section.autoplayInterval` as props.

### Files to create/modify

| File | Change |
|------|--------|
| `src/components/admin/SlideEditor.tsx` | **NEW** — extracted shared slide editing components |
| `src/app/admin/home/page.tsx` | Import from shared SlideEditor instead of inline definitions |
| `src/app/admin/pages/page.tsx` | Replace carousel placeholder with `CarouselSectionEditor` + `CarouselSectionPreview` |
| Public page renderer (wherever PageSection[] → JSX) | Add `case "carousel"` rendering using HomeCarousel or shared carousel component |

### Acceptance
- Admin can add a Carousel section to any page in the page builder.
- Each carousel slide supports Text, Image, Form, and Instagram types with full editing controls (font, color, size, alignment, image upload, Instagram URL fetch, form fields).
- Slides can be reordered via drag-and-drop, toggled active/hidden, and removed.
- Autoplay can be toggled on/off with a configurable interval.
- The live preview in the admin shows a visual representation of the carousel slides.
- On the public page, the carousel renders and works (swipe, arrows, autoplay, all slide types).
- The home page's slide editor continues to work unchanged (it now shares the extracted components).

---

## Task 2 — Make the About page editable from the admin panel

### Goal

Let staff edit the About page content (sections, images, copy) from the admin panel without touching code. The page currently has two hardcoded text sections ("Our Story" and "What We Do") — after this change, all content will be admin-managed with the ability to add images, buttons, reorder sections, and customize styling.

### Strategy: use the existing page builder section system

The page builder already supports Text, Image, CTA, Events, Spacer, and (after Task 1) Carousel sections. Rather than building a separate About editor, **treat the About page as a page-builder page with a reserved slug**.

### Step 1: Add an "About" admin section

**Option A (recommended): Dedicated admin route**

Create `src/app/admin/about/page.tsx` — a focused editor for the about page that uses the same section system as the page builder but with a simpler UI (no slug/label/theme pickers since those are fixed for About).

This editor should:
- Load sections from the database (key: `pageId: "about"` or a reserved row in the `pages` table).
- If no saved data exists, **seed with the current hardcoded content** as default sections so the page doesn't go blank:
  ```typescript
  const DEFAULT_ABOUT_SECTIONS: PageSection[] = [
    {
      id: "about-1", order: 0, visible: true, type: "text",
      title: "Our Story",
      body: "Common Good Cocktail House is an extension of our living room...",
      alignment: "center",
    },
    {
      id: "about-2", order: 1, visible: true, type: "text",
      title: "What We Do",
      body: "We make modern, classic, upscale, seasonal...",
      alignment: "center",
    },
  ];
  ```
- Render the same section editors used in the page builder: `TextSectionEditor`, `ImageSectionEditor`, `CtaSectionEditor`, `CarouselSectionEditor` (from Task 1), `SpacerSectionEditor`.
- Include the add-section dropdown (Text, Image, CTA, Carousel, Spacer — skip Events for About).
- Include drag-to-reorder.
- Include a live preview panel (reuse the `PagePreviewPanel` from the page builder).
- Save via POST to `/api/admin/pages` with `pageId: "about"`, `slug: "about"`, `label: "About"`, `theme: "blue"`.

**Add to admin sidebar and dashboard:**
- Add "ABOUT" to the sidebar nav in the admin layout (between existing items).
- Add an "About" card to the admin dashboard grid.

### Step 2: Update the public About page to load from the database

Replace the hardcoded `ABOUT_SECTIONS` in `src/app/about/page.tsx` with a database fetch:

```tsx
export default async function AboutPage() {
  const header = await getPageHeader("about");

  // Fetch about page sections from the pages table
  const pageData = await getPageBySlug("about"); // new helper function
  const sections = pageData?.sections ?? DEFAULT_ABOUT_SECTIONS;
  const theme = THEMES[pageData?.theme ?? "blue"];

  return (
    <PageThemeWrapper fixedTheme={pageData?.theme ?? "blue"} showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        {/* Header — same as current */}
        <header className="text-center mb-12 px-6">
          {header.title && (
            <h1 className="tracking-widest uppercase mb-2"
              style={{ fontFamily: "var(--font-display)", color: theme.text, fontSize: `clamp(1.75rem, 7vw, ${header.titleSize}px)` }}>
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p className="mt-2 opacity-70" style={{ fontSize: `${header.subtitleSize ?? 14}px` }}>
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Dynamic sections — rendered using page builder section renderer */}
        <div className="divide-y" style={{ borderColor: `${theme.muted}30` }}>
          {sections
            .filter(s => s.visible !== false)
            .sort((a, b) => a.order - b.order)
            .map(section => (
              <PageSectionRenderer key={section.id} section={section} theme={theme} />
            ))}
        </div>
      </div>
    </PageThemeWrapper>
  );
}
```

### Step 3: Create a shared PageSectionRenderer component

This component takes a `PageSection` and renders the appropriate public-facing component. It's needed by both the page builder's public pages and the About page:

Create `src/components/ui/PageSectionRenderer.tsx`:

```tsx
export default function PageSectionRenderer({
  section,
  theme,
}: {
  section: PageSection;
  theme: { text: string; muted: string; bg: string };
}) {
  switch (section.type) {
    case "text":
      return <TextSectionPublic section={section} theme={theme} />;
    case "image":
      return <ImageSectionPublic section={section} theme={theme} />;
    case "cta":
      return <CtaSectionPublic section={section} theme={theme} />;
    case "carousel":
      return <CarouselSectionPublic section={section} theme={theme} />;
    case "spacer":
      return <div style={{ height: section.height + "px" }} />;
    case "events":
      return <EventsSectionPublic section={section} theme={theme} />;
    default:
      return null;
  }
}
```

For the `TextSectionPublic` component specifically — it should render similarly to the current `ContentSectionBlock` but respect all the page builder's styling fields (titleSize, bodySize, titleColor, bodyColor, alignment, paddingX, paddingY, buttonColor, buttonSize). The existing `ContentSectionBlock` only supports a subset of these.

**For each section type, the public renderer should:**
- Respect all color, size, alignment, and padding fields from the section data.
- Fall back to theme defaults for any field not set.
- Use the brand fonts (`var(--font-display)` for titles, `var(--font-body)` for body).
- Be responsive (mobile padding, text sizing — follow the patterns in the mobile optimization plan).

### Step 4: Data helper function

Add `getPageBySlug(slug: string)` to `src/lib/` (either in a new file or in an existing data helper):

```typescript
export async function getPageBySlug(slug: string): Promise<PageDocument | null> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) return null;
  return {
    pageId: data.page_id,
    label: data.label,
    slug: data.slug,
    theme: data.theme,
    sections: data.sections,
    updatedAt: data.updated_at,
  };
}
```

### Step 5: Prevent slug collision

In the page builder's `NewPageModal`, prevent creating a page with slug "about" (since it's now reserved). Add validation:

```typescript
const RESERVED_SLUGS = ["about", "menu", "coffee", "events", "shop", "club", "admin"];
if (RESERVED_SLUGS.includes(slug)) {
  setError("This URL is reserved.");
  return;
}
```

### Files to create/modify

| File | Change |
|------|--------|
| `src/app/admin/about/page.tsx` | **NEW** — About page section editor using shared section editor components |
| `src/app/admin/layout.tsx` (or sidebar component) | Add "ABOUT" to admin sidebar nav |
| `src/app/admin/page.tsx` (dashboard) | Add "About" card to dashboard grid |
| `src/app/about/page.tsx` | Replace hardcoded sections with database fetch + `PageSectionRenderer` |
| `src/components/ui/PageSectionRenderer.tsx` | **NEW** — shared public section renderer for all section types |
| `src/lib/pagesdata.ts` (or similar) | Add `getPageBySlug()` helper |
| `src/app/admin/pages/page.tsx` | Add slug validation to prevent reserved slug collision |

### Acceptance
- "ABOUT" appears in the admin sidebar and dashboard.
- Admin can edit the About page sections: add/remove/reorder Text, Image, CTA, Carousel, and Spacer sections.
- Each section has full styling controls (font, color, size, alignment, padding, buttons).
- On first load (no saved data), the page shows the current "Our Story" and "What We Do" content as defaults.
- The public `/about` page renders the admin-managed sections with all styling applied.
- The About page header (title/subtitle) continues to work via the existing page-headers system.
- Creating a page with slug "about" in the general page builder is blocked.
- The current About page content is not lost — it becomes the default seed data.

---

## Out of scope

- Making Club, Shop, or other hardcoded pages CMS-editable (same pattern can be applied later).
- Everything in the other plan files (events redesign, mobile optimization, home carousel features, etc.).
