# Coffee Admin Save — Data Doesn't Persist (Diagnosis + Fix)

**For:** Claude Code
**Scope:** The coffee admin POST handler returns `{ success: true }` but data vanishes on page refresh and never shows on the customer-facing coffee page. Diagnose and fix.

---

## Background

The working menu API (`src/app/api/admin/menu/route.ts`) uses a smart upsert pattern and works perfectly. The coffee API (`src/app/api/admin/coffee/route.ts`) was rewritten to use a delete-all-then-insert pattern which returns success but doesn't persist data. The two APIs talk to different Supabase tables (`coffee_tabs`/`coffee_items` vs `menu_tabs`/`menu_items`).

---

## Step 1: Add diagnostic logging to POST handler

In `src/app/api/admin/coffee/route.ts`, add `console.log` statements at each stage to see exactly what's happening:

```ts
// After receiving the payload:
console.log("[coffee POST] received tabs:", tabList.length, "items:", itemList.length);
console.log("[coffee POST] tab IDs:", tabList.map(t => t.id));

// After deleting items:
console.log("[coffee POST] deleted items, error:", delItemsErr);

// After deleting tabs:
console.log("[coffee POST] deleted tabs, error:", delTabsErr);

// After inserting tabs:
console.log("[coffee POST] insertedTabs:", JSON.stringify(insertedTabs));
console.log("[coffee POST] insert tabs error:", tabErr);

// After the verification check:
console.log("[coffee POST] insertedIds:", [...insertedIds]);
console.log("[coffee POST] missingTabs:", missingTabs.map(t => t.id));

// After inserting items:
console.log("[coffee POST] inserted items count:", validItems.length, "error:", itemErr);

// Right before returning success, do a verification read:
const verifyTabs = await sb.from("coffee_tabs").select("id").limit(5);
const verifyItems = await sb.from("coffee_items").select("id").limit(5);
console.log("[coffee POST] VERIFY — tabs in DB:", verifyTabs.data?.length, "items in DB:", verifyItems.data?.length);
```

Deploy, save from admin, and check Railway logs for these messages.

---

## Step 2: Check if the problem is schema mismatch

The most likely cause is that the `coffee_tabs` table's `id` column has a server-generated default (like `gen_random_uuid()`) that **overrides** the client-provided UUID. If the DB generates a different UUID than what was sent:

1. The tab inserts with a DB-generated ID (different from what the admin sent)
2. The verification step checks `insertedTabs.map(r => r.id)` — this would show the WRONG IDs
3. Items try to insert with the original tab ID → FK violation → silent failure or error

**Check in Supabase Dashboard:**
1. Go to Table Editor → `coffee_tabs` → click the `id` column
2. Look at "Default Value" — if it says `gen_random_uuid()` or `uuid_generate_v4()`, that's the problem
3. Compare with `menu_tabs` → `id` column — the working table likely has NO default or accepts client-provided values

**Fix if the column has a default:**
```sql
ALTER TABLE coffee_tabs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE coffee_items ALTER COLUMN id DROP DEFAULT;
```

---

## Step 3: Switch to the working upsert pattern

If the schema check doesn't reveal the issue, or as a more robust long-term fix, rewrite the coffee POST handler to match the working menu API pattern exactly.

### File: `src/app/api/admin/coffee/route.ts`

Replace the entire POST handler with this pattern (copied from the working menu API and adapted for coffee tables):

```ts
export async function POST(req: NextRequest) {
  try {
    const { tabs, items } = await req.json();
    const sb = getSupabaseAdmin();

    const tabList: { id: string; label: string; order: number; active: boolean }[] = tabs ?? [];
    const itemList: {
      id: string; tabId: string; title: string; description?: string;
      price?: string; carouselImageUrl?: string; menuPageImageUrl?: string;
      alt?: string; tagLine?: string; ingredients?: string;
      tastingNotes?: string; notableNotes?: string;
      order: number; active: boolean; titleColor?: string;
      descriptionColor?: string; priceColor?: string;
    }[] = items ?? [];

    // 1. Get current state from DB
    const [existingTabsRes, existingItemsRes] = await Promise.all([
      sb.from("coffee_tabs").select("id"),
      sb.from("coffee_items").select("id"),
    ]);

    const existingTabIds = new Set((existingTabsRes.data ?? []).map((r) => r.id));
    const existingItemIds = new Set((existingItemsRes.data ?? []).map((r) => r.id));

    const newTabIds = new Set(tabList.map((t) => t.id));
    const newItemIds = new Set(itemList.map((i) => i.id));

    // 2. Delete removed items FIRST (they hold FK to tabs)
    const removedItemIds = [...existingItemIds].filter((id) => !newItemIds.has(id));
    if (removedItemIds.length > 0) {
      const { error } = await sb.from("coffee_items").delete().in("id", removedItemIds);
      if (error) {
        console.error("[coffee POST] delete removed items error:", error);
        throw error;
      }
    }

    // 3. Delete removed tabs (safe now — their items are gone)
    const removedTabIds = [...existingTabIds].filter((id) => !newTabIds.has(id));
    if (removedTabIds.length > 0) {
      // Also delete any orphaned items that reference removed tabs
      await sb.from("coffee_items").delete().in("tab_id", removedTabIds);
      const { error } = await sb.from("coffee_tabs").delete().in("id", removedTabIds);
      if (error) {
        console.error("[coffee POST] delete removed tabs error:", error);
        throw error;
      }
    }

    // 4. Upsert tabs
    if (tabList.length > 0) {
      const { error: tabErr } = await sb.from("coffee_tabs").upsert(
        tabList.map((t) => ({
          id: t.id,
          label: t.label,
          order: t.order,
          active: t.active,
        })),
        { onConflict: "id" }
      );
      if (tabErr) {
        console.error("[coffee POST] upsert tabs error:", tabErr);
        throw tabErr;
      }
    }

    // 5. Upsert items
    const validItems = itemList.filter((i) => i.tabId && newTabIds.has(i.tabId));
    if (validItems.length > 0) {
      const { error: itemErr } = await sb.from("coffee_items").upsert(
        validItems.map((i) => ({
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
      if (itemErr) {
        console.error("[coffee POST] upsert items error:", itemErr);
        throw itemErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    console.error("[POST /api/admin/coffee] caught:", msg, e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
```

**IMPORTANT:** If this upsert pattern gives FK errors (which it did before), that confirms the `coffee_tabs.id` column is not accepting client-provided values. In that case, you MUST fix the schema first (Step 2) before the upsert will work.

---

## Step 4: If upsert still fails — nuclear option

If both the delete-then-insert AND upsert patterns fail, the problem is definitely the table schema. Run this migration to recreate the tables matching the working menu tables exactly:

```sql
-- Check current schema first
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name IN ('coffee_tabs', 'coffee_items', 'menu_tabs', 'menu_items')
ORDER BY table_name, ordinal_position;
```

Compare the output. If `coffee_tabs.id` has a different type or default than `menu_tabs.id`, fix it:

```sql
-- Remove any server-side default on the id columns
ALTER TABLE coffee_tabs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE coffee_items ALTER COLUMN id DROP DEFAULT;

-- If the id column is type UUID but needs to be TEXT (to match menu_tabs):
-- This is more invasive — back up data first
-- ALTER TABLE coffee_items DROP CONSTRAINT coffee_items_tab_id_fkey;
-- ALTER TABLE coffee_tabs ALTER COLUMN id TYPE TEXT;
-- ALTER TABLE coffee_items ALTER COLUMN id TYPE TEXT;
-- ALTER TABLE coffee_items ALTER COLUMN tab_id TYPE TEXT;
-- ALTER TABLE coffee_items ADD CONSTRAINT coffee_items_tab_id_fkey FOREIGN KEY (tab_id) REFERENCES coffee_tabs(id);
```

---

## Verification

After applying the fix:
1. Open admin → Coffee page
2. Add or modify a tab and item
3. Click Save — should get success
4. Refresh admin page — data should still be there
5. Visit the customer-facing coffee page — items should display
6. Check Railway logs for the diagnostic `console.log` messages to confirm everything went through

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/api/admin/coffee/route.ts` | Add diagnostic logging, then switch to upsert pattern matching menu API |

## Priority order

1. Add logging (Step 1) and deploy — check logs to confirm the diagnosis
2. If logs show the data IS getting inserted but vanishes → check for caching issues in `coffeedata.ts` (though it already uses `noStore()`)
3. If logs show inserts returning empty/wrong data → fix schema (Step 2)
4. Switch to upsert pattern (Step 3) for long-term robustness
