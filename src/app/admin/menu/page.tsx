"use client";

import { useState } from "react";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MenuTab, MenuItem } from "@/types";
import ColorPicker from "@/components/ui/ColorPicker";
import clsx from "clsx";

function newId() { return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// This component is reused for both menu and coffee admin pages
export function MenuAdminPanel({
  pageLabel,
  initialTabs,
  initialItems,
}: {
  pageLabel: string;
  initialTabs: MenuTab[];
  initialItems: MenuItem[];
}) {
  const [tabs, setTabs] = useState<MenuTab[]>(initialTabs);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [activeTabId, setActiveTabId] = useState(initialTabs[0]?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleTabDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTabs((prev) => {
      const oi = prev.findIndex((t) => t.id === active.id);
      const ni = prev.findIndex((t) => t.id === over.id);
      return arrayMove(prev, oi, ni).map((t, i) => ({ ...t, order: i }));
    });
  }

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const tabItems = prev.filter((i) => i.tabId === activeTabId);
      const oi = tabItems.findIndex((i) => i.id === active.id);
      const ni = tabItems.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(tabItems, oi, ni).map((item, i) => ({ ...item, order: i }));
      return [...prev.filter((i) => i.tabId !== activeTabId), ...reordered];
    });
  }

  function addTab() {
    const newTab: MenuTab = { id: newId(), label: "New Tab", order: tabs.length, active: true };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function updateTabLabel(id: string, label: string) {
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, label } : t));
  }

  function removeTab(id: string) {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setItems((prev) => prev.filter((i) => i.tabId !== id));
    if (activeTabId === id) setActiveTabId(tabs.find((t) => t.id !== id)?.id ?? "");
  }

  function openNewItem() {
    setEditingItem({ tabId: activeTabId, title: "", description: "", price: "", imageUrl: "", active: true, order: 0 });
  }

  function openEditItem(item: MenuItem) {
    setEditingItem({ ...item });
  }

  function saveItem() {
    if (!editingItem?.title) return;
    const isNew = !editingItem.id;
    const item: MenuItem = {
      id: editingItem.id ?? newId(),
      tabId: editingItem.tabId ?? activeTabId,
      title: editingItem.title!,
      description: editingItem.description,
      price: editingItem.price,
      imageUrl: editingItem.imageUrl,
      order: editingItem.order ?? items.filter((i) => i.tabId === activeTabId).length,
      active: editingItem.active ?? true,
    };
    if (isNew) setItems((prev) => [...prev, item]);
    else setItems((prev) => prev.map((i) => i.id === item.id ? item : i));
    setEditingItem(null);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const activeItems = items.filter((i) => i.tabId === activeTabId).sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          {pageLabel}
        </h1>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
        >
          <Save size={14} />
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      {/* Tabs row */}
      <div className="mb-4">
        <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 pb-px mb-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
            <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  active={tab.id === activeTabId}
                  onClick={() => setActiveTabId(tab.id)}
                  onLabelChange={updateTabLabel}
                  onRemove={removeTab}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            onClick={addTab}
            className="px-2 py-1.5 text-gray-400 hover:text-[#C97D5A] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
          <SortableContext items={activeItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {activeItems.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onEdit={openEditItem}
                onRemove={removeItem}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <button
        onClick={openNewItem}
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/30 transition-colors text-xs tracking-widest uppercase rounded-sm"
      >
        <Plus size={14} /> Add Item
      </button>

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 shadow-xl w-full max-w-lg p-6 rounded-sm">
            <h2 className="text-lg text-gray-800 mb-4" style={{ fontFamily: "var(--font-display)" }}>
              {editingItem.id ? "Edit Item" : "New Item"}
            </h2>
            <div className="space-y-3">
              {/* Name */}
              <div>
                <div className="flex items-end justify-between mb-1">
                  <label className="block text-[10px] tracking-widest uppercase text-gray-400">Name *</label>
                  <ColorPicker
                    label="Title color"
                    value={editingItem.titleColor}
                    onChange={(hex) => setEditingItem((v) => ({ ...v, titleColor: hex }))}
                  />
                </div>
                <input
                  type="text"
                  value={editingItem.title ?? ""}
                  onChange={(e) => setEditingItem((v) => ({ ...v, title: e.target.value }))}
                  style={{ color: editingItem.titleColor }}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
                />
              </div>

              {/* Price */}
              <div>
                <div className="flex items-end justify-between mb-1">
                  <label className="block text-[10px] tracking-widest uppercase text-gray-400">Price</label>
                  <ColorPicker
                    label="Price color"
                    value={editingItem.priceColor}
                    onChange={(hex) => setEditingItem((v) => ({ ...v, priceColor: hex }))}
                  />
                </div>
                <input
                  type="text"
                  value={editingItem.price ?? ""}
                  onChange={(e) => setEditingItem((v) => ({ ...v, price: e.target.value }))}
                  style={{ color: editingItem.priceColor }}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Image URL (menu page PNG)</label>
                <input
                  type="text"
                  value={editingItem.imageUrl ?? ""}
                  onChange={(e) => setEditingItem((v) => ({ ...v, imageUrl: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-end justify-between mb-1">
                  <label className="block text-[10px] tracking-widest uppercase text-gray-400">Description</label>
                  <ColorPicker
                    label="Desc color"
                    value={editingItem.descriptionColor}
                    onChange={(hex) => setEditingItem((v) => ({ ...v, descriptionColor: hex }))}
                  />
                </div>
                <textarea
                  rows={3}
                  value={editingItem.description ?? ""}
                  onChange={(e) => setEditingItem((v) => ({ ...v, description: e.target.value }))}
                  style={{ color: editingItem.descriptionColor }}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none resize-none focus:border-[#C97D5A]/50 rounded-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={editingItem.active ?? true}
                  onChange={(e) => setEditingItem((v) => ({ ...v, active: e.target.checked }))}
                  className="accent-[#C97D5A]"
                />
                Active (visible to customers)
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveItem} className="flex-1 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors">
                {editingItem.id ? "Update" : "Add"} Item
              </button>
              <button onClick={() => setEditingItem(null)} className="px-5 py-2.5 border border-gray-200 text-gray-500 text-xs tracking-widest uppercase hover:border-gray-400 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTab({ tab, active, onClick, onLabelChange, onRemove }: {
  tab: MenuTab; active: boolean;
  onClick: () => void;
  onLabelChange: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: tab.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [editing, setEditing] = useState(false);

  return (
    <div ref={setNodeRef} style={style} className={clsx("flex items-center border-b-2 -mb-px", active ? "border-[#C97D5A]" : "border-transparent")}>
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 px-1 cursor-grab active:cursor-grabbing touch-none">
        <GripVertical size={12} />
      </button>
      {editing ? (
        <input
          type="text"
          value={tab.label}
          onChange={(e) => onLabelChange(tab.id, e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
          className="bg-transparent text-xs text-gray-700 outline-none border-b border-[#C97D5A] px-1 w-24"
        />
      ) : (
        <button onClick={onClick} onDoubleClick={() => setEditing(true)} className={clsx("text-xs tracking-wider uppercase px-2 py-2 transition-colors", active ? "text-[#C97D5A]" : "text-gray-500 hover:text-gray-800")}>
          {tab.label}
        </button>
      )}
      <button onClick={() => onRemove(tab.id)} className="text-gray-300 hover:text-red-500 px-1 transition-colors">
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function SortableItem({ item, onEdit, onRemove }: { item: MenuItem; onEdit: (item: MenuItem) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border border-gray-200 cursor-pointer hover:border-[#C97D5A]/40 transition-colors rounded-sm" onClick={() => onEdit(item)}>
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0 touch-none">
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-gray-700 text-xs tracking-wider">{item.title}</p>
        {item.price && <p className="text-[#C97D5A] text-xs">{item.price}</p>}
        {item.description && <p className="text-gray-400 text-xs truncate">{item.description}</p>}
      </div>
      {!item.active && <span className="text-[10px] text-gray-400 tracking-widest uppercase shrink-0">Hidden</span>}
      <button onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// Default export for /admin/menu
const MENU_TABS: MenuTab[] = [
  { id: "seasonal", label: "Seasonal Cocktails", order: 0, active: true },
  { id: "classics", label: "Classics", order: 1, active: true },
  { id: "nonalc", label: "Non-Alcoholic", order: 2, active: true },
  { id: "beer", label: "Beer & Wine", order: 3, active: true },
];
const MENU_ITEMS: MenuItem[] = [
  { id: "1", tabId: "seasonal", order: 0, active: true, title: "Hugo Ascending", description: "Lemongrass Infused Elderflower Liqueur, Gen-P, Bitter Bianco, Cap Corse Blanc, Cava" },
  { id: "2", tabId: "seasonal", order: 1, active: true, title: "The Riggs", description: "Coconut Roasted Strawberry & Asparagus Infused Aperitivo..." },
  { id: "3", tabId: "classics", order: 0, active: true, title: "Old Fashioned", description: "Bourbon, Demerara, Angostura Bitters" },
];

export default function AdminMenuPage() {
  return <MenuAdminPanel pageLabel="Menu" initialTabs={MENU_TABS} initialItems={MENU_ITEMS} />;
}
