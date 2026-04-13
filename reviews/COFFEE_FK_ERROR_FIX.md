# Coffee Page — Foreign Key Constraint Error Fix

**For:** Claude Code
**Scope:** Fix the FK violation error when saving coffee items in admin: `insert or update on table "coffee_items" violates foreign key constraint "coffee_items_tab_id_fkey"`

---

## Root cause

The upsert on `coffee_tabs` is likely silently failing or not inserting rows, so when `coffee_items` tries to reference those tab IDs, the foreign key check fails because the tabs don't exist in the database.

Possible reasons the tabs upsert silently fails:
- The `coffee_tabs` table's `id` column may not be configured identically to `menu_tabs` (e.g. different default, missing primary key constraint, or the `onConflict: "id"` upsert isn't matching correctly).
- The Supabase upsert may return success but insert 0 rows if there's a schema mismatch.

## Fix — `src/app/api/admin/coffee/route.ts`

Replace the POST handler with a **delete-items-first-then-delete-tabs-then-insert-tabs-then-insert-items** approach that's more explicit and defensive than upsert. This avoids any upsert/conflict-resolution quirks.

The key changes:
1. Delete all existing items first (they hold the FK references).
2. Delete all existing tabs (now safe since no items reference them).
3. Insert tabs fresh.
4. **Verify tabs actually landed** before proceeding.
5. Insert items.

Replace the entire POST handler (lines 43–125) with:

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

    // Validate: drop items whose tabId doesn't match any tab in the payload
    const tabIdSet = new Set(tabList.map((t) => t.id));
    const validItems = itemList.filter((i) => i.tabId && tabIdSet.has(i.tabId));

    // Step 1: Delete ALL existing items (they hold FK references to tabs)
    const { error: delItemsErr } = await sb
      .from("coffee_items")
      .delete()
      .gte("order", -1); // matches all rows (Supabase needs a filter for delete)
    if (delItemsErr) {
      console.error("[coffee POST] delete items error:", delItemsErr);
      throw delItemsErr;
    }

    // Step 2: Delete ALL existing tabs (safe now — no items reference them)
    const { error: delTabsErr } = await sb
      .from("coffee_tabs")
      .delete()
      .gte("order", -1); // matches all rows
    if (delTabsErr) {
      console.error("[coffee POST] delete tabs error:", delTabsErr);
      throw delTabsErr;
    }

    // Step 3: Insert tabs
    if (tabList.length) {
      const { data: insertedTabs, error: tabErr } = await sb
        .from("coffee_tabs")
        .insert(
          tabList.map((t) => ({
            id: t.id,
            label: t.label,
            order: t.order,
            active: t.active,
          }))
        )
        .select("id");

      if (tabErr) {
        console.error("[coffee POST] insert tabs error:", tabErr);
        throw tabErr;
      }

      // Step 3b: Verify tabs actually landed
      const insertedIds = new Set((insertedTabs ?? []).map((r) => r.id));
      const missingTabs = tabList.filter((t) => !insertedIds.has(t.id));
      if (missingTabs.length) {
        console.error("[coffee POST] tabs failed to insert:", missingTabs.map((t) => t.id));
        throw new Error(
          `Failed to insert ${missingTabs.length} tab(s). The coffee_tabs table may not accept client-provided IDs. ` +
          `Check that the 'id' column is type UUID/TEXT with no server-side default that overrides the provided value.`
        );
      }
    }

    // Step 4: Insert items
    if (validItems.length) {
      const { error: itemErr } = await sb.from("coffee_items").insert(
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
        }))
      );
      if (itemErr) {
        console.error("[coffee POST] insert items error:", itemErr);
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

### Key differences from previous attempt:

1. **Uses `.gte("order", -1)` instead of `.neq("id", "___never___")`** — the old hack may not work reliably. Using `order >= -1` matches every row since order is always 0+.

2. **Explicit insert (not upsert)** — since we've deleted everything first, there's nothing to conflict with. Plain `insert` avoids any `onConflict` resolution issues.

3. **Verifies tabs were inserted** with `.select("id")` after insert — if the returned IDs don't match what we sent, we throw an informative error that tells you exactly what's wrong (the table schema doesn't accept client-provided IDs).

4. **Validates items against tabs** before inserting — drops any orphaned items whose `tabId` doesn't match a tab in the payload.

---

## If the verification step (3b) throws an error

That means the `coffee_tabs` table's `id` column has a server-side default (like `gen_random_uuid()`) that overrides the client-provided ID. To fix this in Supabase:

1. Go to Supabase Dashboard → Table Editor → `coffee_tabs`.
2. Click the `id` column settings.
3. Make sure the column type is `uuid` (or `text`).
4. Remove any default value (like `gen_random_uuid()`) — the client provides the ID.
5. Ensure it's set as the Primary Key.
6. Do the same check for `coffee_items.id`.

Compare with `menu_tabs` — the `id` column there should be the reference for how coffee tables should be configured.

---

## Also fix the DELETE handler race condition

The DELETE handler (lines 127–149) has a race condition when deleting a tab — it runs item delete and tab delete in `Promise.all`, but the tab delete can execute before items are removed, hitting the same FK constraint. Change it to sequential:

```ts
export async function DELETE(req: NextRequest) {
  try {
    const { id, type } = await req.json();
    if (!id || !type) {
      return NextResponse.json({ success: false, error: "id and type required" }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    if (type === "tab") {
      // Delete items FIRST (they hold FK to tabs), THEN delete the tab
      await sb.from("coffee_items").delete().eq("tab_id", id);
      await sb.from("coffee_tabs").delete().eq("id", id);
    } else {
      const { error } = await sb.from("coffee_items").delete().eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    console.error("[DELETE /api/admin/coffee]", msg, e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
```

---

## Files to modify

| File | Change |
|------|--------|
| `src/app/api/admin/coffee/route.ts` | Replace POST handler with delete-then-insert + verification; fix DELETE handler race condition |

## Acceptance criteria

1. Saving coffee tabs and items in admin completes without FK errors.
2. After save, the customer-facing coffee page displays all saved items.
3. If tabs fail to insert (schema issue), the error message clearly says to check the `coffee_tabs.id` column configuration.
4. Deleting a tab in admin doesn't hit FK errors.
