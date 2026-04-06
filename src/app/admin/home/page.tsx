"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CarouselItem, CarouselTextItem, CarouselImageItem, CarouselFormItem, FormField } from "@/types";
import ColorPicker from "@/components/ui/ColorPicker";
import ImagePicker from "@/components/ui/ImagePicker";
import clsx from "clsx";

// ─── Supabase Storage auto-cleanup helpers ────────────────────────────────────
function isStorageImageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/images/");
}
function storagePathFromUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
function deleteStorageImage(url: string) {
  if (!isStorageImageUrl(url)) return;
  const path = storagePathFromUrl(url);
  if (!path) return;
  fetch("/api/admin/images", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}

type ItemType = "text" | "image" | "form";

const EMPTY_TEXT: Omit<CarouselTextItem, "id"> = {
  type: "text", order: 0, active: true, text: ""
};
const EMPTY_IMAGE: Omit<CarouselImageItem, "id"> = {
  type: "image", order: 0, active: true, imageUrl: "", expandedImageUrl: "", altText: ""
};
const EMPTY_FORM: Omit<CarouselFormItem, "id"> = {
  type: "form", order: 0, active: true,
  formId: `form-${Date.now()}`,
  title: "", description: "",
  fields: [{ id: "f1", label: "Name", type: "text", required: true }],
  submitLabel: "Submit",
};

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

// ─── Sortable wrapper for each carousel item card ─────────────────────────────
function SortableCard({
  item,
  onToggle,
  onRemove,
  onUpdateText,
  onUpdateTextColor,
  onUpdateImageField,
  onUpdateFormField,
  onAddFormField,
  onUpdateFormFieldDef,
  onRemoveFormField,
}: {
  item: CarouselItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateTextColor: (id: string, color: string | undefined) => void;
  onUpdateImageField: (id: string, field: "imageUrl" | "expandedImageUrl" | "altText", value: string) => void;
  onUpdateFormField: (id: string, field: keyof Omit<CarouselFormItem, "id" | "type" | "order" | "active" | "fields">, value: string) => void;
  onAddFormField: (itemId: string) => void;
  onUpdateFormFieldDef: (itemId: string, fieldId: string, key: keyof FormField, value: string | boolean) => void;
  onRemoveFormField: (itemId: string, fieldId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "border transition-colors rounded-sm",
        item.active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-70"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={14} />
          </button>
          <span className="text-xs tracking-widest uppercase text-gray-400">
            {item.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(item.id)}
            className={clsx(
              "text-xs tracking-wider px-2 py-0.5 border rounded-sm transition-colors",
              item.active
                ? "border-gray-300 text-gray-500 hover:border-[#C97D5A] hover:text-[#C97D5A]"
                : "border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"
            )}
          >
            {item.active ? "Active" : "Hidden"}
          </button>
          <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {item.type === "text" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] tracking-widest uppercase text-gray-400">Slide Text</label>
              <ColorPicker
                label="Text color"
                value={(item as CarouselTextItem).textColor}
                onChange={(hex) => onUpdateTextColor(item.id, hex)}
              />
            </div>
            <textarea
              value={item.text}
              onChange={(e) => onUpdateText(item.id, e.target.value)}
              rows={2}
              placeholder="Text to display over the background..."
              style={{ color: (item as CarouselTextItem).textColor }}
              className="w-full bg-white border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none resize-none focus:border-[#C97D5A]/50 rounded-sm"
            />
          </div>
        )}

        {item.type === "image" && (
          <div className="space-y-3">
            <ImagePicker
              label="Carousel Image"
              value={item.imageUrl}
              onChange={(url) => onUpdateImageField(item.id, "imageUrl", url)}
            />
            <ImagePicker
              label="Expanded Image (shown on tap, optional)"
              value={item.expandedImageUrl ?? ""}
              onChange={(url) => onUpdateImageField(item.id, "expandedImageUrl", url)}
            />
            <div>
              <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Alt Text</label>
              <input
                type="text"
                value={item.altText ?? ""}
                onChange={(e) => onUpdateImageField(item.id, "altText", e.target.value)}
                placeholder="Describe the image"
                className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 outline-none focus:border-[#C97D5A]/50 rounded-sm"
              />
            </div>
          </div>
        )}

        {item.type === "form" && (
          <div className="space-y-2">
            <input
              type="text"
              value={item.title}
              onChange={(e) => onUpdateFormField(item.id, "title", e.target.value)}
              placeholder="Form title"
              className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 outline-none focus:border-[#C97D5A]/50 rounded-sm"
            />
            <textarea
              value={item.description}
              onChange={(e) => onUpdateFormField(item.id, "description", e.target.value)}
              placeholder="Description"
              rows={2}
              className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 outline-none resize-none focus:border-[#C97D5A]/50 rounded-sm"
            />
            <div className="mt-2">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Fields</p>
              {item.fields.map((f) => (
                <div key={f.id} className="flex items-center gap-2 mb-1.5">
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => onUpdateFormFieldDef(item.id, f.id, "label", e.target.value)}
                    placeholder="Label"
                    className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 outline-none rounded-sm"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => onUpdateFormFieldDef(item.id, f.id, "type", e.target.value)}
                    className="bg-white border border-gray-200 text-gray-500 text-xs px-2 py-1 outline-none rounded-sm"
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="textarea">Textarea</option>
                  </select>
                  <button
                    onClick={() => onRemoveFormField(item.id, f.id)}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => onAddFormField(item.id)}
                className="text-xs text-gray-400 hover:text-[#C97D5A] flex items-center gap-1 mt-1 transition-colors"
              >
                <Plus size={11} /> Add field
              </button>
            </div>
            <input
              type="text"
              value={item.submitLabel}
              onChange={(e) => onUpdateFormField(item.id, "submitLabel", e.target.value)}
              placeholder="Submit button label"
              className="w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 outline-none focus:border-[#C97D5A]/50 rounded-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [bgUrl, setBgUrl] = useState("");
  const [addType, setAddType] = useState<ItemType>("text");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  // Load from Supabase on mount
  useEffect(() => {
    fetch("/api/admin/home")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.carouselItems)) setItems(d.carouselItems);
        if (typeof d.bgUrl === "string") setBgUrl(d.bgUrl);
      })
      .catch(() => setLoadError(true));
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((item, idx) => ({ ...item, order: idx }));
    });
  }

  function addItem() {
    const id = newId();
    let item: CarouselItem;
    if (addType === "text") item = { ...EMPTY_TEXT, id, order: items.length };
    else if (addType === "image") item = { ...EMPTY_IMAGE, id, order: items.length };
    else item = { ...EMPTY_FORM, formId: `form-${id}`, id, order: items.length };
    setItems((prev) => [...prev, item]);
  }

  function removeItem(id: string) {
    // Auto-delete any Supabase Storage images owned by this carousel item
    const item = items.find((i) => i.id === id);
    if (item?.type === "image") {
      const img = item as CarouselImageItem;
      if (img.imageUrl) deleteStorageImage(img.imageUrl);
      if (img.expandedImageUrl) deleteStorageImage(img.expandedImageUrl);
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleActive(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, active: !i.active } : i));
  }

  function updateText(id: string, text: string) {
    setItems((prev) => prev.map((i) => i.id === id && i.type === "text" ? { ...i, text } : i));
  }

  function updateTextColor(id: string, color: string | undefined) {
    setItems((prev) => prev.map((i) => i.id === id && i.type === "text" ? { ...i, textColor: color } : i));
  }

  function updateImageField(id: string, field: "imageUrl" | "expandedImageUrl" | "altText", value: string) {
    setItems((prev) => prev.map((i) => i.id === id && i.type === "image" ? { ...i, [field]: value } : i));
  }

  function updateFormField(id: string, field: keyof Omit<CarouselFormItem, "id" | "type" | "order" | "active" | "fields">, value: string) {
    setItems((prev) => prev.map((i) => i.id === id && i.type === "form" ? { ...i, [field]: value } : i));
  }

  function addFormField(itemId: string) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== itemId || i.type !== "form") return i;
      const newField: FormField = { id: newId(), label: "Field", type: "text", required: false };
      return { ...i, fields: [...i.fields, newField] };
    }));
  }

  function updateFormFieldDef(itemId: string, fieldId: string, key: keyof FormField, value: string | boolean) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== itemId || i.type !== "form") return i;
      return { ...i, fields: i.fields.map((f) => f.id === fieldId ? { ...f, [key]: value } : f) };
    }));
  }

  function removeFormField(itemId: string, fieldId: string) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== itemId || i.type !== "form") return i;
      return { ...i, fields: i.fields.filter((f) => f.id !== fieldId) };
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bgUrl, carouselItems: items }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          Home Page
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60"
        >
          <Save size={14} />
          {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {loadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">
          Could not load saved data. Changes will be saved when you click Save.
        </div>
      )}

      {/* Background image */}
      <section className="mb-8 p-4 bg-white border border-gray-200 rounded-sm">
        <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-3">Background Image</h2>
        <input
          type="text"
          value={bgUrl}
          onChange={(e) => setBgUrl(e.target.value)}
          placeholder="https://... or /images/..."
          className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
        />
        <p className="text-gray-400 text-xs mt-2">
          Leave blank to use default background image
        </p>
      </section>

      {/* Carousel items */}
      <section>
        <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-4 border-b border-gray-200 pb-2">
          Carousel Items — drag to reorder
        </h2>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mb-6">
              {items.map((item) => (
                <SortableCard
                  key={item.id}
                  item={item}
                  onToggle={toggleActive}
                  onRemove={removeItem}
                  onUpdateText={updateText}
                  onUpdateTextColor={updateTextColor}
                  onUpdateImageField={updateImageField}
                  onUpdateFormField={updateFormField}
                  onAddFormField={addFormField}
                  onUpdateFormFieldDef={updateFormFieldDef}
                  onRemoveFormField={removeFormField}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add item */}
        <div className="flex items-center gap-2 p-3 border border-dashed border-gray-200 rounded-sm">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as ItemType)}
            className="bg-white border border-gray-200 text-gray-500 text-xs px-2 py-1.5 outline-none rounded-sm"
          >
            <option value="text">Text Slide</option>
            <option value="image">Image Slide</option>
            <option value="form">Form Slide</option>
          </select>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-wider text-[#C97D5A] border border-[#C97D5A]/30 hover:bg-[#C97D5A]/10 transition-colors uppercase rounded-sm"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </section>
    </div>
  );
}
