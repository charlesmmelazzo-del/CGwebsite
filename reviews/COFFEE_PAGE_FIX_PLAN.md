# Coffee Page — Bug Fix Plan

**For:** Claude Code
**Scope:** Fix multiple bugs causing the coffee page admin saves to not appear on the customer-facing page, and to sometimes throw errors.

---

## Bugs found

### Bug 1: Coffee API uses dangerous delete-all-then-insert (causes errors)

**File:** `src/app/api/admin/coffee/route.ts` — POST handler (lines 69–115)

The coffee API saves by deleting ALL rows from `coffee_items` and `coffee_tabs`, then re-inserting everything. This is fragile and causes errors:

```ts
// Current — deletes EVERYTHING first
await sb.from("coffee_items").delete().neq("id", "___never___");  // line 70
await sb.from("coffee_tabs").delete().neq("id", "___never___");   // line 76
// Then re-inserts...
```

**Why this breaks:**
- If the insert fails after the delete succeeds, all data is lost.
- Foreign key constraints between `coffee_items.tab_id` → `coffee_tabs.id` can cause errors during the delete/re-insert cycle.
- The `.neq("id", "___never___")` hack is a red flag — it's a workaround for Supabase not supporting `DELETE *` easily, but it's unreliable.
- Any concurrent read during the delete-insert gap sees an empty table.

**Compare to the working menu API** (`src/app/api/admin/menu/route.ts`) which uses a safe upsert strategy:
1. Finds which tabs/items were removed and deletes only those.
2. Upserts remaining tabs with `onConflict: "id"`.
3. Upserts remaining items with `onConflict: "id"`.

**Fix:** Rewrite the coffee POST handler to match the menu API's upsert pattern exactly.

### Bug 2: Customer-facing coffee page doesn't pass `tabs` to MenuCarousel

**File:** `src/app/coffee/CoffeePageClient.tsx` — lines 74–79

```tsx
<MenuCarousel
  items={activeItems}
  textColor={theme.text}
  mutedColor={theme.muted}
/>
```

The `tabs` prop is **never passed**. MenuCarousel needs `tabs` to build section dividers, show tab dots, and segment the carousel. Without it, `tabs` defaults to `[]` and `buildSlides()` produces zero slides because every item's `tabId` fails to match any tab → they get filtered out → **nothing renders**.

This is the primary reason items saved in admin don't show on the customer-facing page.

### Bug 3: Coffee page pre-filters items by active tab before passing to carousel

**File:** `src/app/coffee/CoffeePageClient.tsx` — line 23

```tsx
const activeItems = initialItems.filter((i) => i.tabId === activeTabId && i.active);
```

The page filters items down to only the selected tab, then passes that subset to `MenuCarousel`. But `MenuCarousel.buildSlides()` also filters by tab internally. This double-filtering means:
- If the coffee page has its own tab bar (it does, lines 52–71), switching tabs re-renders the carousel with a new subset, causing jarring resets.
- The carousel's built-in smooth scroll-to-section behavior can't work because it only ever receives one tab's worth of items.

### Bug 4: Duplicate tab bar

**File:** `src/app/coffee/CoffeePageClient.tsx` — lines 52–71

The coffee page renders its own tab bar AND the carousel has a built-in tab bar. This creates either a confusing double tab bar, or (since no tabs are passed) a single tab bar that doesn't actually control what the carousel shows.

---

## Fix plan

All fixes are in two files.

### Fix 1: Rewrite coffee API POST to use upsert (match menu API)

**File:** `src/app/api/admin/coffee/route.ts`

Replace the entire `POST` function body with the same upsert pattern used by the menu API. Here is the exact replacement for lines 43–127:

```ts
export async function POST(req: NextRequest) {
  try {
    const { tabs, items } = await req.json();
    const sb = getSupabaseAdmin();

    const newTabIds: string[] = (tabs ?? []).map((t: { id: string }) => t.id);
    const newItemIds: string[] = (items ?? []).map((i: { id: string }) => i.id);

    // 1. Find and delete tabs that were removed
    const { data: existingTabs } = await sb.from("coffee_tabs").select("id");
    const tabsToDelete = (existingTabs ?? [])
      .map((r) => r.id)
      .filter((id) => !newTabIds.includes(id));
    if (tabsToDelete.length) {
      // Cascade: remove their items first (in case FK doesn't cascade)
      await sb.from("coffee_items").delete().in("tab_id", tabsToDelete);
      await sb.from("coffee_tabs").delete().in("id", tabsToDelete);
    }

    // 2. Find and delete items that were removed (within remaining tabs)
    const { data: existingItems } = await sb.from("coffee_items").select("id");
    const itemsToDelete = (existingItems ?? [])
      .map((r) => r.id)
      .filter((id) => !newItemIds.includes(id));
    if (itemsToDelete.length) {
      await sb.from("coffee_items").delete().in("id", itemsToDelete);
    }

    // 3. Upsert tabs
    if (newTabIds.length) {
      const { error: tabErr } = await sb.from("coffee_tabs").upsert(
        tabs.map((t: { id: string; label: string; order: number; active: boolean }) => ({
          id: t.id,
          label: t.label,
          order: t.order,
          active: t.active,
        })),
        { onConflict: "id" }
      );
      if (tabErr) throw tabErr;
    }

    // 4. Upsert items
    if (newItemIds.length) {
      const { error: itemErr } = await sb.from("coffee_items").upsert(
        items.map((i: {
          id: string; tabId: string; title: string; description?: string;
          price?: string; carouselImageUrl?: string; menuPageImageUrl?: string;
          alt?: string; tagLine?: string; ingredients?: string;
          tastingNotes?: string; notableNotes?: string;
          order: number; active: boolean; titleColor?: string;
          descriptionColor?: string; priceColor?: string;
        }) => ({
          id: i.id,
          tab_id: i.tabId,
          title: i.title,
          description: i.description ?? null,
          price: i.price ?? null,
          carousel_image_url: i.carouselImageUrl ?? null,
          menu_page_image_url: i.menuPageImageUrl ?? null,
          alt: i.alt ?? null,
          tag_line: i.tagLine ?? null,
          ingredients: i.ingredients ?? null,
          tasting_notes: i.tastingNotes ?? null,
          notable_notes: i.notableNotes ?? null,
          order: i.order,
          active: i.active,
          title_color: i.titleColor ?? null,
          description_color: i.descriptionColor ?? null,
          price_color: i.priceColor ?? null,
        })),
        { onConflict: "id" }
      );
      if (itemErr) throw itemErr;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    console.error("[POST /api/admin/coffee] caught:", msg, e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
```

### Fix 2: Rewrite CoffeePageClient to match MenuPageClient pattern

**File:** `src/app/coffee/CoffeePageClient.tsx`

The coffee page should follow the exact same pattern as the menu page — pass ALL active items and ALL active tabs to the carousel (or tile grid, once that's built), and let the display component handle grouping/filtering internally. Remove the coffee page's custom tab bar since the carousel/tile component handles it.

Replace the entire file with:

```tsx
"use client";

import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import MenuCarousel from "@/components/ui/MenuCarousel";
import type { MenuTab, MenuItem, PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";

interface Props {
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
  header: PageHeaderData;
}

export default function CoffeePageClient({ initialTabs, initialItems, header }: Props) {
  const themeName: ThemeName = header.theme ?? "olive";
  const theme = THEMES[themeName];

  const activeTabs = initialTabs
    .filter((t) => t.active)
    .sort((a, b) => a.order - b.order);

  const allItems = activeTabs.flatMap((tab) =>
    initialItems
      .filter((item) => item.tabId === tab.id && item.active)
      .sort((a, b) => a.order - b.order)
  );

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          {header.title && (
            <h1
              className="tracking-widest uppercase mb-2"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.text,
                fontSize: `clamp(1.75rem, 7vw, ${header.titleSize}px)`,
              }}
            >
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p
              className="leading-relaxed max-w-xl mx-auto mt-3 opacity-70"
              style={{ fontSize: `${header.subtitleSize ?? 14}px` }}
            >
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-6" style={{ backgroundColor: theme.muted }} />
        </header>

        <div className="pb-16">
          <MenuCarousel
            items={allItems}
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

Key changes:
- **Removed** the `useState` for `activeTabId` and the tab-filtering logic.
- **Removed** the custom tab bar JSX (lines 52–71 in the old file).
- **Added** `tabs={activeTabs}` to the MenuCarousel props.
- **Changed** item prep to match MenuPageClient: `activeTabs.flatMap(...)` gives all items across all tabs, properly ordered.
- **Removed** unused imports (`useState`, `clsx`).

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/api/admin/coffee/route.ts` | Replace POST handler's delete-all-then-insert with smart upsert (match menu API exactly) |
| `src/app/coffee/CoffeePageClient.tsx` | Remove custom tab bar, pass `tabs` to MenuCarousel, pass all items instead of filtered subset |

---

## Acceptance criteria

1. **Admin save works without errors** — saving coffee tabs and items in the admin panel completes successfully (no 500 errors).
2. **Customer-facing page shows saved items** — after saving in admin, refreshing the coffee page shows all active items grouped by tab.
3. **Tab navigation works** — the carousel's built-in tab bar shows coffee categories and scrolling/clicking works.
4. **No data loss** — editing and re-saving doesn't wipe items that weren't changed (upsert preserves existing data).
5. **Delete still works** — removing a tab in admin still deletes the tab and its items from the database.

---

## Note on future tile migration

The menu page is being migrated from `MenuCarousel` to `MenuTileGrid` (see `MENU_TILES_PLAN.md`). Once that's done, the coffee page should also be migrated to use `MenuTileGrid` for consistency. But this fix should be applied first to get the coffee page working with the current carousel, then the tile migration can happen as a separate step for both pages.
