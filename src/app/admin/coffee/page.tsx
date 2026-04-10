"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, GripVertical, Loader2, Eye, EyeOff } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
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
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>

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

        {menus.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            No menus yet — click Add Menu to create your first one.
          </p>
        )}
      </div>

      <button
        onClick={addMenu}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/30 transition-colors text-xs tracking-widest uppercase rounded-sm"
      >
        <Plus size={14} /> Add Menu
      </button>
    </div>
  );
}

/* ─── Sortable menu card ─────────────────────────────────────────────── */

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-sm overflow-hidden"
    >
      {/* Header row — always visible */}
      <div className="flex items-center gap-3 p-3">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>

        {/* Thumbnail */}
        {menu.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={menu.imageUrl}
            alt=""
            className="w-12 h-12 object-cover rounded-sm shrink-0 border border-gray-200"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded-sm shrink-0 flex items-center justify-center">
            <span className="text-[10px] text-gray-300">No img</span>
          </div>
        )}

        {/* Label + status — click to expand */}
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
          aria-label="Delete menu"
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
