# Coffee Page Rebuild — Simple Image-Per-Tab Menus

**For:** Claude Code  
**Priority:** HIGH — the current coffee page is broken and needs replacing, not fixing.

---

## What we're building

The coffee page at Common Good displays **printed menus** (8.5×11" and 4×6" images). The customer taps a tab to see that menu's image. Tapping the image opens it full-screen with pinch-to-zoom so they can read the fine print on a phone.

The admin page lets Mike upload/replace menu images, name tabs, reorder them, and toggle visibility. It should be versatile enough to add more tabs in the future for non-menu content, but the immediate need is just 3 tabs with 1 image each.

**This replaces the entire current coffee system** — the complex MenuAdminPanel with individual items/cocktails is overkill here. We're building something purpose-built and simple.

---

## Database: New `coffee_menus` table

**Drop the existing broken tables and create one clean table.** The old `coffee_tabs` and `coffee_items` tables have been causing persistent save issues due to likely schema mismatches. We're starting fresh.

### Supabase SQL (run in Supabase SQL Editor or as a migration):

```sql
-- Create the new simple table
CREATE TABLE IF NOT EXISTS coffee_menus (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'New Menu',
  image_url TEXT,                    -- Supabase Storage URL for the menu image
  alt TEXT DEFAULT '',               -- accessibility alt text
  order_num INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allow the service role full access (RLS bypass via service key already works,
-- but add a policy in case RLS is enabled on this table)
ALTER TABLE coffee_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON coffee_menus
  FOR ALL USING (true) WITH CHECK (true);

-- Optional: drop the old broken tables if they exist
-- (Uncomment these once confirmed the new system works)
-- DROP TABLE IF EXISTS coffee_items;
-- DROP TABLE IF EXISTS coffee_tabs;
```

**Column notes:**
- `id` is TEXT (not UUID) — the client generates IDs like `cm-1712700000000-abc123`. No server-side default.
- `order_num` instead of `order` to avoid SQL reserved word issues.
- Single flat table — no FK relationships, no complex joins. One row = one tab/menu.

---

## API: New `/api/admin/coffee/route.ts`

**Replace the entire file.** The new API is dramatically simpler — just CRUD on a single table.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
}

// GET — return all menus ordered by order_num
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("coffee_menus")
      .select("*")
      .order("order_num");

    if (error) throw error;

    const menus: CoffeeMenu[] = (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      imageUrl: r.image_url,
      alt: r.alt ?? "",
      order: r.order_num,
      active: r.active,
    }));

    return NextResponse.json({ menus });
  } catch (e) {
    console.error("[GET /api/admin/coffee]", e);
    return NextResponse.json({ menus: [], error: "Failed to load" }, { status: 500 });
  }
}

// POST — save all menus (upsert + delete removed)
export async function POST(req: NextRequest) {
  try {
    const { menus } = await req.json();
    const sb = getSupabaseAdmin();
    const menuList: CoffeeMenu[] = menus ?? [];

    console.log("[coffee POST] saving", menuList.length, "menus");

    // Get existing IDs
    const { data: existing } = await sb.from("coffee_menus").select("id");
    const existingIds = new Set((existing ?? []).map((r) => r.id));
    const newIds = new Set(menuList.map((m) => m.id));

    // Delete removed menus
    const removedIds = [...existingIds].filter((id) => !newIds.has(id));
    if (removedIds.length > 0) {
      const { error } = await sb.from("coffee_menus").delete().in("id", removedIds);
      if (error) throw error;
    }

    // Upsert all current menus
    if (menuList.length > 0) {
      const { error } = await sb.from("coffee_menus").upsert(
        menuList.map((m) => ({
          id: m.id,
          label: m.label,
          image_url: m.imageUrl,
          alt: m.alt ?? "",
          order_num: m.order,
          active: m.active,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "id" }
      );
      if (error) throw error;
    }

    // Verify
    const { data: verify } = await sb.from("coffee_menus").select("id");
    console.log("[coffee POST] verified", verify?.length, "menus in DB");

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("[POST /api/admin/coffee]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
```

No DELETE endpoint needed — removal is handled in the POST (save-all pattern).

---

## Data Fetcher: New `src/lib/coffeedata.ts`

**Replace the entire file.** Much simpler now.

```ts
import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";

export interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
}

export async function getCoffeeMenus(): Promise<CoffeeMenu[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("coffee_menus")
      .select("*")
      .eq("active", true)
      .order("order_num");

    if (error) throw error;

    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      imageUrl: r.image_url,
      alt: r.alt ?? "",
      order: r.order_num,
      active: r.active,
    }));
  } catch {
    return [];
  }
}
```

---

## Customer-Facing Page: New `src/app/coffee/CoffeePageClient.tsx`

**Replace the entire file.** The page shows tabs along the top. Each tab displays its menu image. Tapping the image opens a full-screen lightbox with pinch-to-zoom.

```tsx
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import type { PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import clsx from "clsx";

interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
}

interface Props {
  menus: CoffeeMenu[];
  header: PageHeaderData;
}

export default function CoffeePageClient({ menus, header }: Props) {
  const themeName: ThemeName = header.theme ?? "olive";
  const theme = THEMES[themeName];
  const [activeId, setActiveId] = useState(menus[0]?.id ?? "");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeMenu = menus.find((m) => m.id === activeId);

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration={false} bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen" style={{ color: theme.text }}>
        {/* Page title */}
        <header className="text-center pt-16 pb-6 px-6">
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

        {/* Tabs */}
        {menus.length > 1 && (
          <div className="flex justify-center gap-0 px-3 mb-6"
            style={{ background: "rgba(0,0,0,0.15)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            {menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => setActiveId(menu.id)}
                className={clsx(
                  "px-4 py-3 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200 border-b-2",
                  activeId === menu.id
                    ? "border-[#C97D5A] text-[#C97D5A]"
                    : "border-transparent opacity-60 hover:opacity-90"
                )}
                style={{ color: activeId === menu.id ? "#C97D5A" : theme.text }}
              >
                {menu.label}
              </button>
            ))}
          </div>
        )}

        {/* Menu image display */}
        <div className="px-4 pb-16 max-w-3xl mx-auto">
          {activeMenu?.imageUrl ? (
            <button
              onClick={() => setLightboxOpen(true)}
              className="w-full block relative group cursor-zoom-in"
            >
              <Image
                src={activeMenu.imageUrl}
                alt={activeMenu.alt || `${activeMenu.label} menu`}
                width={850}
                height={1100}
                className="w-full h-auto rounded-lg shadow-lg"
                sizes="(max-width: 768px) 100vw, 750px"
                priority
              />
              {/* Subtle zoom hint */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs tracking-widest uppercase bg-black/50 px-3 py-1.5 rounded-full">
                  Tap to zoom
                </span>
              </div>
            </button>
          ) : (
            <div
              className="w-full aspect-[8.5/11] rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", border: `1px dashed ${theme.muted}40` }}
            >
              <p className="text-sm opacity-40" style={{ color: theme.text }}>
                Menu image coming soon
              </p>
            </div>
          )}
        </div>

        {/* Full-screen lightbox with pinch-to-zoom */}
        {lightboxOpen && activeMenu?.imageUrl && (
          <Lightbox
            imageUrl={activeMenu.imageUrl}
            alt={activeMenu.alt || `${activeMenu.label} menu`}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </PageThemeWrapper>
  );
}

/* ─── Lightbox with native pinch-to-zoom ─────────────────────────────── */

function Lightbox({ imageUrl, alt, onClose }: { imageUrl: string; alt: string; onClose: () => void }) {
  const imgRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Scrollable + zoomable container */}
      <div
        ref={imgRef}
        className="w-full h-full overflow-auto overscroll-contain"
        style={{
          touchAction: "pinch-zoom pan-x pan-y",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex items-center justify-center p-4">
          {/* 
            Using a regular <img> here instead of next/image because:
            1. We want native browser pinch-to-zoom behavior
            2. next/image constrains dimensions which fights zoom
            3. The image is already loaded from the page view
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-none"
            style={{
              width: "100%",
              maxWidth: "1200px",
              height: "auto",
              touchAction: "pinch-zoom",
            }}
          />
        </div>
      </div>

      {/* Hint text */}
      <p className="absolute bottom-6 left-0 right-0 text-center text-white/40 text-xs tracking-widest uppercase pointer-events-none">
        Pinch to zoom · Tap background to close
      </p>
    </div>
  );
}
```

### Key UX decisions:
- **Tabs at the top** — same styling as the cocktail menu tabs, consistent look
- **Image fills the width** with a subtle shadow — looks like a real printed menu
- **Tap to zoom** opens a full-screen overlay. Uses native CSS `touch-action: pinch-zoom` so pinch-to-zoom works on iOS/Android without JavaScript complexity
- **Placeholder** for tabs that don't have an image yet
- **Responsive** — `max-w-3xl` on desktop so the menu image doesn't stretch too wide, full-width on mobile

---

## Server Page: Update `src/app/coffee/page.tsx`

```tsx
import { getCoffeeMenus } from "@/lib/coffeedata";
import { getPageHeader } from "@/lib/pageheaders";
import CoffeePageClient from "./CoffeePageClient";

export default async function CoffeePage() {
  const [menus, header] = await Promise.all([
    getCoffeeMenus(),
    getPageHeader("coffee"),
  ]);
  return <CoffeePageClient menus={menus} header={header} />;
}
```

---

## Admin Page: New `CoffeeAdminPanel`

**Replace `src/app/admin/coffee/page.tsx`** with a purpose-built admin panel. This is NOT the MenuAdminPanel — it's simpler and focused on image management.

```tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, GripVertical, Loader2, Eye, EyeOff } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ImagePicker from "@/components/ui/ImagePicker";

interface CoffeeMenu {
  id: string;
  label: string;
  imageUrl: string | null;
  alt: string;
  order: number;
  active: boolean;
}

function newId() {
  return `cm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminCoffeePage() {
  const [menus, setMenus] = useState<CoffeeMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  // Load menus on mount
  useEffect(() => {
    fetch("/api/admin/coffee")
      .then((r) => r.json())
      .then((d) => {
        const loaded: CoffeeMenu[] = d.menus ?? [];
        setMenus(loaded);
        if (loaded.length > 0) setExpandedId(loaded[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setMenus((prev) => {
      const oi = prev.findIndex((m) => m.id === active.id);
      const ni = prev.findIndex((m) => m.id === over.id);
      return arrayMove(prev, oi, ni).map((m, i) => ({ ...m, order: i }));
    });
  }

  function addMenu() {
    const menu: CoffeeMenu = {
      id: newId(),
      label: "New Menu",
      imageUrl: null,
      alt: "",
      order: menus.length,
      active: true,
    };
    setMenus((prev) => [...prev, menu]);
    setExpandedId(menu.id);
  }

  function updateMenu(id: string, updates: Partial<CoffeeMenu>) {
    setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }

  function removeMenu(id: string) {
    setMenus((prev) => prev.filter((m) => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/coffee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? `Server error ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-10">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          Coffee Menus
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
      </div>

      {/* Menu list — each is an expandable card */}
      <div className="space-y-3 mb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={menus.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {menus.map((menu) => (
              <SortableMenuCard
                key={menu.id}
                menu={menu}
                expanded={expandedId === menu.id}
                onToggleExpand={() => setExpandedId(expandedId === menu.id ? null : menu.id)}
                onUpdate={(updates) => updateMenu(menu.id, updates)}
                onRemove={() => removeMenu(menu.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add menu button */}
      <button
        onClick={addMenu}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/30 transition-colors text-xs tracking-widest uppercase rounded-sm"
      >
        <Plus size={14} /> Add Menu
      </button>
    </div>
  );
}

/* ─── Sortable menu card ──────────────────────────────────────────── */

function SortableMenuCard({
  menu,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  menu: CoffeeMenu;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<CoffeeMenu>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: menu.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-sm overflow-hidden">
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 p-3">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        >
          <GripVertical size={14} />
        </button>

        {/* Thumbnail */}
        {menu.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={menu.imageUrl} alt="" className="w-12 h-12 object-cover rounded-sm shrink-0 border border-gray-200" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded-sm shrink-0 flex items-center justify-center">
            <span className="text-[10px] text-gray-300">No img</span>
          </div>
        )}

        {/* Label (click to expand) */}
        <button onClick={onToggleExpand} className="flex-1 min-w-0 text-left">
          <p className="text-gray-700 text-sm tracking-wider">{menu.label}</p>
          <p className="text-gray-400 text-xs">
            {menu.imageUrl ? "Image uploaded" : "No image yet"}
            {!menu.active && " · Hidden"}
          </p>
        </button>

        {/* Active toggle */}
        <button
          onClick={() => onUpdate({ active: !menu.active })}
          className="text-gray-300 hover:text-gray-600 transition-colors shrink-0"
          title={menu.active ? "Hide from customers" : "Show to customers"}
        >
          {menu.active ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-4 pt-1 border-t border-gray-100 space-y-4">
          {/* Tab label */}
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">
              Tab Label
            </label>
            <input
              type="text"
              value={menu.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="e.g. Coffee Menu, Pastries, Specials"
              className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
            />
          </div>

          {/* Menu image */}
          <ImagePicker
            label="Menu Image"
            value={menu.imageUrl ?? undefined}
            onChange={(url) => onUpdate({ imageUrl: url || null })}
          />

          {/* Alt text */}
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">
              Alt Text (accessibility)
            </label>
            <input
              type="text"
              value={menu.alt}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              placeholder="e.g. Common Good coffee and espresso menu"
              className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Admin UX:
- Each menu is an **expandable card** — collapsed shows thumbnail + label, expanded shows the editor
- **Drag to reorder** tabs
- **Eye icon** to toggle visibility without deleting
- **ImagePicker** (already exists in the codebase) for uploading menu images to Supabase Storage
- **Add Menu** button for future expansion
- Simple **Save** button that sends everything to the API

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `coffee_menus` table | **CREATE** | New Supabase table (run SQL above) |
| `src/app/api/admin/coffee/route.ts` | **REPLACE** | Simple GET/POST for `coffee_menus` table |
| `src/lib/coffeedata.ts` | **REPLACE** | Fetches active coffee menus |
| `src/app/coffee/CoffeePageClient.tsx` | **REPLACE** | Tabbed image display with lightbox zoom |
| `src/app/coffee/page.tsx` | **REPLACE** | Server component passes menus to client |
| `src/app/admin/coffee/page.tsx` | **REPLACE** | New `CoffeeAdminPanel` with expandable cards |

**Do NOT modify** any menu (cocktail) files — they're separate and working.

---

## Implementation order

1. **Create `coffee_menus` table** in Supabase (run the SQL)
2. **Replace API route** (`route.ts`) — test with curl or browser to confirm GET/POST work
3. **Replace data fetcher** (`coffeedata.ts`)
4. **Replace admin page** — test: add 3 menus, upload images, save, refresh, confirm persistence
5. **Replace customer-facing page** — test: tabs switch, images display, tap-to-zoom works on mobile
6. **(Later)** Once confirmed working, uncomment the `DROP TABLE` lines for `coffee_items` and `coffee_tabs`

---

## Verification checklist

- [ ] Admin: Can add a new menu tab
- [ ] Admin: Can upload an image for each tab
- [ ] Admin: Can rename tabs
- [ ] Admin: Can reorder tabs via drag
- [ ] Admin: Can toggle visibility (eye icon)
- [ ] Admin: Save works — refresh page and data is still there
- [ ] Admin: Delete a tab and save — it's gone
- [ ] Customer: Coffee page shows tabs
- [ ] Customer: Tapping tab switches displayed menu image
- [ ] Customer: Tapping image opens full-screen lightbox
- [ ] Customer: Pinch-to-zoom works on mobile in lightbox
- [ ] Customer: Tap background or X to close lightbox
- [ ] Customer: Hidden tabs don't appear on customer page
