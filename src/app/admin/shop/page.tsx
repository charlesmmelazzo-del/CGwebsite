"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import ImagePicker from "@/components/ui/ImagePicker";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ShopTab } from "@/lib/pagedata";
import { DEFAULT_SHOP_TABS } from "@/lib/pagedata";

function newTabId() { return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
const textareaCls = inputCls + " resize-none";

function TabCard({
  tab,
  onUpdate,
  onRemove,
}: {
  tab: ShopTab;
  onUpdate: (patch: Partial<ShopTab>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
      className="border border-gray-200 bg-white rounded-sm"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical size={15} />
        </button>
        <span className="text-xs text-gray-500 truncate flex-1">{tab.label || "(no label)"}</span>
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Tab Label</label>
          <input
            className={inputCls}
            value={tab.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Bottles & Merch"
          />
        </div>
        <div>
          <label className={labelCls}>Body Text</label>
          <textarea
            className={textareaCls}
            rows={3}
            value={tab.body}
            onChange={(e) => onUpdate({ body: e.target.value })}
            placeholder="Description shown on this tab…"
          />
        </div>
        <ImagePicker
          label="Image (optional)"
          value={tab.imageUrl ?? ""}
          onChange={(url) => onUpdate({ imageUrl: url || undefined })}
        />
        {tab.imageUrl && (
          <div>
            <label className={labelCls}>Image Alt Text</label>
            <input
              className={inputCls}
              value={tab.imageAlt ?? ""}
              onChange={(e) => onUpdate({ imageAlt: e.target.value || undefined })}
              placeholder="Describe the image for accessibility"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Button Label</label>
            <input
              className={inputCls}
              value={tab.buttonLabel}
              onChange={(e) => onUpdate({ buttonLabel: e.target.value })}
              placeholder="e.g. Shop Now"
            />
          </div>
          <div>
            <label className={labelCls}>Button URL</label>
            <input
              className={inputCls}
              value={tab.buttonUrl}
              onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={tab.buttonNewTab}
            onChange={(e) => onUpdate({ buttonNewTab: e.target.checked })}
            className="accent-[#C97D5A]"
          />
          Open in new tab
        </label>
      </div>
    </div>
  );
}

export default function AdminShopPage() {
  const [tabs, setTabs] = useState<ShopTab[]>(DEFAULT_SHOP_TABS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    fetch("/api/admin/page-content?slug=shop")
      .then((r) => r.json())
      .then(({ sections: data }) => {
        if (Array.isArray(data) && data.length > 0) setTabs(data as ShopTab[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function updateTab(id: string, patch: Partial<ShopTab>) {
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    setSaved(false);
  }

  function removeTab(id: string) {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setSaved(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTabs((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id);
      const newIdx = prev.findIndex((t) => t.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
    setSaved(false);
  }

  function addTab() {
    setTabs((prev) => [
      ...prev,
      {
        id: newTabId(),
        label: "New Tab",
        body: "",
        buttonLabel: "Shop Now",
        buttonUrl: "https://commongoodcocktailhouse.com/shop",
        buttonNewTab: true,
      },
    ]);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/page-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "shop", label: "Shop", sections: tabs }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Save failed: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
            Shop Page
          </h1>
          <p className="text-gray-400 text-xs mt-1">
            Edit shop tabs — each tab has its own label, description, and button link
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

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {tabs.map((tab) => (
                <TabCard
                  key={tab.id}
                  tab={tab}
                  onUpdate={(patch) => updateTab(tab.id, patch)}
                  onRemove={() => removeTab(tab.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!loading && (
        <button
          onClick={addTab}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/40 transition-colors text-xs tracking-widest uppercase rounded-sm"
        >
          <Plus size={13} /> Add Tab
        </button>
      )}
    </div>
  );
}
