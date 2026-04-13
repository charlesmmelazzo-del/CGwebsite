# Coffee API — Fix delete filter parse error

**For:** Claude Code
**Scope:** One-line fix in two places. The `.gte("order", -1)` filter causes a Supabase parse error. Replace with a filter that actually works.

---

## Problem

`src/app/api/admin/coffee/route.ts` lines 66 and 76:

```ts
.gte("order", -1)   // ERROR: "failed to parse order (gte.-1)"
```

Supabase PostgREST can't parse `-1` as a filter value here.

## Fix

Replace both `.gte("order", -1)` calls with `.not("id", "is", null)` which matches every row (since `id` is a primary key and is never null):

**Line 64–66 (delete items):**
```ts
// BEFORE
const { error: delItemsErr } = await sb
  .from("coffee_items")
  .delete()
  .gte("order", -1);

// AFTER
const { error: delItemsErr } = await sb
  .from("coffee_items")
  .delete()
  .not("id", "is", null);
```

**Line 74–76 (delete tabs):**
```ts
// BEFORE
const { error: delTabsErr } = await sb
  .from("coffee_tabs")
  .delete()
  .gte("order", -1);

// AFTER
const { error: delTabsErr } = await sb
  .from("coffee_tabs")
  .delete()
  .not("id", "is", null);
```

That's it — two lines changed. Everything else in the file stays the same.
