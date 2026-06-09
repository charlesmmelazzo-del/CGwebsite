"use client";

import { useState, useEffect } from "react";
import { Plus, Save } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import type { ContentSection } from "@/types";
import type { ShopTab } from "@/lib/pagedata";
import { DEFAULT_ABOUT, DEFAULT_CLUB, DEFAULT_SHOP_TABS } from "@/lib/pagedata";
import SectionCard from "@/components/admin/SectionCard";
import ShopTabCard from "@/components/admin/ShopTabCard";

export type ContentSlug = "about" | "club" | "shop";
type Item = ContentSection | ShopTab;

function newId() { return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function newTabId() { return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// Per-page config — keeps the save payload + add-item defaults byte-identical
// to the original standalone editors. "sections" pages reindex `order` on
// reorder/remove; "tabs" pages (shop) do not.
const PAGE_CONFIG: Record<ContentSlug, {
  label: string;
  kind: "sections" | "tabs";
  defaults: Item[];
  addLabel: string;
}> = {
  about: { label: "About", kind: "sections", defaults: DEFAULT_ABOUT,     addLabel: "Add Section" },
  club:  { label: "Club",  kind: "sections", defaults: DEFAULT_CLUB,      addLabel: "Add Section" },
  shop:  { label: "Shop",  kind: "tabs",     defaults: DEFAULT_SHOP_TABS, addLabel: "Add Tab" },
};

const PAGE_ORDER: ContentSlug[] = ["about", "club", "shop"];

export default function ContentPagesEditor({ initialSlug = "about" }: { initialSlug?: ContentSlug }) {
  const [slug, setSlug] = useState<ContentSlug>(initialSlug);
  const [items, setItems] = useState<Item[]>(PAGE_CONFIG[initialSlug].defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");

  const config = PAGE_CONFIG[slug];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Load the selected page's content whenever the slug changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    setDirty(false);
    setSaveError("");
    fetch(`/api/admin/page-content?slug=${slug}`)
      .then((r) => r.json())
      .then(({ sections: data }) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) setItems(data as Item[]);
        else setItems(PAGE_CONFIG[slug].defaults);
      })
      .catch(() => { if (!cancelled) setItems(PAGE_CONFIG[slug].defaults); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  function switchPage(next: ContentSlug) {
    if (next === slug) return;
    if (dirty && !window.confirm("You have unsaved changes that will be lost. Switch pages anyway?")) return;
    setSlug(next);
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } as Item : it));
    setDirty(true);
    setSaved(false);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      return config.kind === "sections"
        ? (filtered as ContentSection[]).map((s, i) => ({ ...s, order: i }))
        : filtered;
    });
    setDirty(true);
    setSaved(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((it) => it.id === active.id);
      const newIdx = prev.findIndex((it) => it.id === over.id);
      const moved = arrayMove(prev, oldIdx, newIdx);
      return config.kind === "sections"
        ? (moved as ContentSection[]).map((s, i) => ({ ...s, order: i }))
        : moved;
    });
    setDirty(true);
    setSaved(false);
  }

  function addItem() {
    setItems((prev) => {
      if (config.kind === "sections") {
        const next: ContentSection = { id: newId(), order: prev.length, title: "", body: "" };
        return [...(prev as ContentSection[]), next];
      }
      const next: ShopTab = {
        id: newTabId(),
        label: "New Tab",
        body: "",
        buttonLabel: "Shop Now",
        buttonUrl: "https://commongoodcocktailhouse.com/shop",
        buttonNewTab: true,
      };
      return [...(prev as ShopTab[]), next];
    });
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/page-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, label: config.label, sections: items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
            Content Pages
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Edit the body content of the About, Club, and Shop pages
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60"
        >
          <Save size={14} />
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Page picker */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {PAGE_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => switchPage(s)}
            className={`px-4 py-2.5 text-xs tracking-wider uppercase transition-colors border-b-2 -mb-px ${
              slug === s
                ? "border-[#C97D5A] text-[#C97D5A]"
                : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {PAGE_CONFIG[s].label}
            {dirty && slug === s && <span className="ml-1 text-[#C97D5A]">•</span>}
          </button>
        ))}
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">
          {saveError}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {config.kind === "sections"
                ? (items as ContentSection[]).map((section) => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      onUpdate={(patch) => updateItem(section.id, patch)}
                      onRemove={() => removeItem(section.id)}
                    />
                  ))
                : (items as ShopTab[]).map((tab) => (
                    <ShopTabCard
                      key={tab.id}
                      tab={tab}
                      onUpdate={(patch) => updateItem(tab.id, patch)}
                      onRemove={() => removeItem(tab.id)}
                    />
                  ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!loading && (
        <button
          onClick={addItem}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/40 transition-colors text-xs tracking-widest uppercase rounded-sm"
        >
          <Plus size={13} /> {config.addLabel}
        </button>
      )}
    </div>
  );
}
