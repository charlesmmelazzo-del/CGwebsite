"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CarouselItem, CarouselTextItem, CarouselImageItem, CarouselFormItem, CarouselInstagramItem, FormField } from "@/types";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import ColorPicker from "@/components/ui/ColorPicker";
import ImagePicker from "@/components/ui/ImagePicker";
import SliderInput from "@/components/ui/SliderInput";
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

type ItemType = "text" | "image" | "form" | "instagram";

const EMPTY_TEXT: Omit<CarouselTextItem, "id"> = {
  type: "text", order: 0, active: true, text: "", alignment: "center",
};
const EMPTY_IMAGE: Omit<CarouselImageItem, "id"> = {
  type: "image", order: 0, active: true, imageUrl: "", expandedImageUrl: "", altText: "",
};
const EMPTY_FORM: Omit<CarouselFormItem, "id"> = {
  type: "form", order: 0, active: true,
  formId: `form-${Date.now()}`,
  title: "", description: "",
  fields: [{ id: "f1", label: "Name", type: "text", required: true }],
  submitLabel: "Submit",
};
const EMPTY_INSTAGRAM: Omit<CarouselInstagramItem, "id"> = {
  type: "instagram", order: 0, active: true,
  instagramUrl: "", captionOverride: "",
};

const FONT_OPTIONS = [
  { label: "Display (Headings)",  value: "var(--font-display)" },
  { label: "Body",                value: "var(--font-body)" },
  { label: "Nav",                 value: "var(--font-nav)" },
  { label: "Button",              value: "var(--font-button)" },
  { label: "Label",               value: "var(--font-label)" },
];

const LETTER_SPACING_OPTIONS = [
  { label: "Default",    value: "" },
  { label: "Tight",      value: "-0.02em" },
  { label: "Normal",     value: "0em" },
  { label: "Wide",       value: "0.1em" },
  { label: "Wider",      value: "0.2em" },
  { label: "Widest",     value: "0.3em" },
];

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls = "w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 outline-none focus:border-[#C97D5A]/50 rounded-sm";

// ─── Link section (shared by image + instagram) ───────────────────────────────
function LinkSection({
  linkLabel, linkUrl, linkNewTab,
  onUpdate,
}: {
  linkLabel: string; linkUrl: string; linkNewTab: boolean;
  onUpdate: (field: "linkLabel" | "linkUrl" | "linkNewTab", value: string | boolean) => void;
}) {
  return (
    <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
      <p className={labelCls + " !mb-2"}>CTA Button (optional)</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Button Text</label>
          <input
            className={inputCls}
            placeholder="e.g. Learn More"
            value={linkLabel}
            onChange={(e) => onUpdate("linkLabel", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>URL</label>
          <input
            className={inputCls}
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => onUpdate("linkUrl", e.target.value)}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={linkNewTab}
          onChange={(e) => onUpdate("linkNewTab", e.target.checked)}
          className="accent-[#C97D5A]"
        />
        <span className="text-xs text-gray-500">Open in new tab</span>
      </label>
    </div>
  );
}

// ─── Sortable card ─────────────────────────────────────────────────────────────
function SortableCard({
  item,
  onToggle, onRemove,
  onUpdateItem,
  onAddFormField, onUpdateFormFieldDef, onRemoveFormField,
  onRefreshInstagram,
}: {
  item: CarouselItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateItem: (id: string, patch: Partial<CarouselItem>) => void;
  onAddFormField: (itemId: string) => void;
  onUpdateFormFieldDef: (itemId: string, fieldId: string, key: keyof FormField, value: string | boolean) => void;
  onRemoveFormField: (itemId: string, fieldId: string) => void;
  onRefreshInstagram: (id: string, data?: { imageUrl: string; caption: string; fetchedAt: string }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  function patch(p: Partial<CarouselItem>) { onUpdateItem(item.id, p); }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "border transition-colors rounded-sm",
        item.active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-70"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none">
            <GripVertical size={14} />
          </button>
          <span className="text-xs tracking-widest uppercase text-gray-400">{item.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(item.id)}
            className={clsx(
              "text-xs tracking-wider px-2 py-0.5 border rounded-sm transition-colors",
              item.active ? "border-gray-300 text-gray-500 hover:border-[#C97D5A] hover:text-[#C97D5A]" : "border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"
            )}
          >
            {item.active ? "Active" : "Hidden"}
          </button>
          <button onClick={() => onRemove(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* ── Text slide ── */}
        {item.type === "text" && (() => {
          const t = item as CarouselTextItem;
          return (
            <div className="space-y-3">
              <textarea
                value={t.text}
                onChange={(e) => patch({ text: e.target.value } as Partial<CarouselTextItem>)}
                rows={2}
                placeholder="Text to display..."
                className={inputCls + " resize-none"}
              />
              {/* Typography controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Font</label>
                  <select
                    value={t.fontFamily ?? "var(--font-display)"}
                    onChange={(e) => patch({ fontFamily: e.target.value } as Partial<CarouselTextItem>)}
                    className={inputCls}
                  >
                    {FONT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Letter Spacing</label>
                  <select
                    value={t.letterSpacing ?? ""}
                    onChange={(e) => patch({ letterSpacing: e.target.value || undefined } as Partial<CarouselTextItem>)}
                    className={inputCls}
                  >
                    {LETTER_SPACING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <SliderInput
                label="Font Size (px)"
                value={t.fontSize ?? 32}
                min={12}
                max={72}
                onChange={(v) => patch({ fontSize: v } as Partial<CarouselTextItem>)}
              />
              <div className="flex items-center justify-between">
                {/* Alignment */}
                <div>
                  <label className={labelCls}>Alignment</label>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => {
                      const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                      return (
                        <button
                          key={a}
                          onClick={() => patch({ alignment: a } as Partial<CarouselTextItem>)}
                          className={clsx(
                            "p-1.5 border rounded-sm transition-colors",
                            (t.alignment ?? "center") === a
                              ? "border-[#C97D5A] text-[#C97D5A] bg-[#C97D5A]/10"
                              : "border-gray-200 text-gray-400 hover:border-gray-400"
                          )}
                        >
                          <Icon size={13} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Color */}
                <div>
                  <label className={labelCls}>Text Color</label>
                  <ColorPicker
                    label=""
                    value={t.textColor}
                    onChange={(hex) => patch({ textColor: hex } as Partial<CarouselTextItem>)}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Image slide ── */}
        {item.type === "image" && (() => {
          const img = item as CarouselImageItem;
          return (
            <div className="space-y-3">
              <ImagePicker label="Carousel Image" value={img.imageUrl} onChange={(url) => patch({ imageUrl: url } as Partial<CarouselImageItem>)} />
              <ImagePicker label="Expanded Image (on tap, optional)" value={img.expandedImageUrl ?? ""} onChange={(url) => patch({ expandedImageUrl: url } as Partial<CarouselImageItem>)} />
              <div>
                <label className={labelCls}>Alt Text</label>
                <input type="text" className={inputCls} value={img.altText ?? ""} onChange={(e) => patch({ altText: e.target.value } as Partial<CarouselImageItem>)} placeholder="Describe the image" />
              </div>
              <LinkSection
                linkLabel={img.linkLabel ?? ""} linkUrl={img.linkUrl ?? ""} linkNewTab={img.linkNewTab ?? false}
                onUpdate={(field, value) => patch({ [field]: value } as Partial<CarouselImageItem>)}
              />
            </div>
          );
        })()}

        {/* ── Instagram slide ── */}
        {item.type === "instagram" && (() => {
          const ig = item as CarouselInstagramItem;
          return (
            <div className="space-y-3">
              <InstagramSlideEditor
                item={ig}
                onUpdateField={(id, field, value) => patch({ [field]: value } as Partial<CarouselInstagramItem>)}
                onRefresh={onRefreshInstagram}
              />
              <LinkSection
                linkLabel={ig.linkLabel ?? ""} linkUrl={ig.linkUrl ?? ""} linkNewTab={ig.linkNewTab ?? false}
                onUpdate={(field, value) => patch({ [field]: value } as Partial<CarouselInstagramItem>)}
              />
            </div>
          );
        })()}

        {/* ── Form slide ── */}
        {item.type === "form" && (() => {
          const f = item as CarouselFormItem;
          return (
            <div className="space-y-2">
              <ImagePicker
                label="Header Image (optional — replaces title/description)"
                value={f.headerImageUrl ?? ""}
                onChange={(url) => patch({ headerImageUrl: url || undefined } as Partial<CarouselFormItem>)}
              />
              {!f.headerImageUrl && (
                <>
                  <input type="text" value={f.title} onChange={(e) => patch({ title: e.target.value } as Partial<CarouselFormItem>)} placeholder="Form title" className={inputCls} />
                  <textarea value={f.description} onChange={(e) => patch({ description: e.target.value } as Partial<CarouselFormItem>)} placeholder="Description" rows={2} className={inputCls + " resize-none"} />
                </>
              )}
              <div className="mt-2">
                <p className={labelCls + " !mb-2"}>Fields</p>
                {f.fields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 mb-1.5">
                    <input type="text" value={field.label} onChange={(e) => onUpdateFormFieldDef(item.id, field.id, "label", e.target.value)} placeholder="Label" className="flex-1 bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 outline-none rounded-sm" />
                    <select value={field.type} onChange={(e) => onUpdateFormFieldDef(item.id, field.id, "type", e.target.value)} className="bg-white border border-gray-200 text-gray-500 text-xs px-2 py-1 outline-none rounded-sm">
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="textarea">Textarea</option>
                    </select>
                    <button onClick={() => onRemoveFormField(item.id, field.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button onClick={() => onAddFormField(item.id)} className="text-xs text-gray-400 hover:text-[#C97D5A] flex items-center gap-1 mt-1 transition-colors">
                  <Plus size={11} /> Add field
                </button>
              </div>
              <input type="text" value={f.submitLabel} onChange={(e) => patch({ submitLabel: e.target.value } as Partial<CarouselFormItem>)} placeholder="Submit button label" className={inputCls} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Instagram Slide Editor ───────────────────────────────────────────────────
function InstagramSlideEditor({
  item, onUpdateField, onRefresh,
}: {
  item: CarouselInstagramItem;
  onUpdateField: (id: string, field: keyof Pick<CarouselInstagramItem, "instagramUrl" | "captionOverride">, value: string) => void;
  onRefresh: (id: string, data?: { imageUrl: string; caption: string; fetchedAt: string }) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function handleRefresh() {
    if (!item.instagramUrl) { setError("Enter a URL first."); return; }
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.instagramUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Fetch failed");
      onRefresh(item.id, data);
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Instagram Post URL *</label>
        <div className="flex gap-2">
          <input type="url" value={item.instagramUrl} onChange={(e) => onUpdateField(item.id, "instagramUrl", e.target.value)} placeholder="https://www.instagram.com/p/XXXXXXXXX/" className={inputCls + " flex-1"} />
          <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-wider uppercase text-white bg-[#C97D5A] hover:bg-[#b86d4a] disabled:opacity-60 rounded-sm transition-colors shrink-0">
            {refreshing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {refreshing ? "Fetching…" : "Refresh"}
          </button>
        </div>
      </div>
      {item.lastFetchFailed && (
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] px-2.5 py-2 rounded-sm">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>Last refresh failed — showing cached content{item.fetchedAt ? ` from ${new Date(item.fetchedAt).toLocaleDateString()}` : ""}.</span>
        </div>
      )}
      {item.cachedImageUrl && (
        <div className="flex items-start gap-3 p-2 bg-gray-50 border border-gray-200 rounded-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.cachedImageUrl} alt="" className="w-16 h-16 object-cover rounded-sm shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 tracking-wider uppercase mb-1">Cached preview</p>
            <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{item.captionOverride || item.cachedCaption || "No caption"}</p>
            {item.fetchedAt && <p className="text-[9px] text-gray-400 mt-1">Fetched {new Date(item.fetchedAt).toLocaleString()}</p>}
          </div>
        </div>
      )}
      {!item.cachedImageUrl && <p className="text-[10px] text-gray-400">Paste the URL above and click Refresh to fetch the post photo and caption.</p>}
      {error && <p className="text-[10px] text-red-500 bg-red-50 border border-red-200 px-2.5 py-2 rounded-sm">{error}</p>}
      <div>
        <label className={labelCls}>Caption Override <span className="normal-case opacity-60">(optional)</span></label>
        <textarea rows={2} value={item.captionOverride ?? ""} onChange={(e) => onUpdateField(item.id, "captionOverride", e.target.value)} placeholder="Custom caption…" className={inputCls + " resize-none"} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminHomePage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [bgUrl, setBgUrl] = useState("");
  const [addType, setAddType] = useState<ItemType>("text");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

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
    if (addType === "text")           item = { ...EMPTY_TEXT,      id, order: items.length };
    else if (addType === "image")     item = { ...EMPTY_IMAGE,     id, order: items.length };
    else if (addType === "instagram") item = { ...EMPTY_INSTAGRAM, id, order: items.length };
    else                              item = { ...EMPTY_FORM, formId: `form-${id}`, id, order: items.length };
    setItems((prev) => [...prev, item]);
  }

  function removeItem(id: string) {
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

  function updateItem(id: string, patch: Partial<CarouselItem>) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } as CarouselItem : i));
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

  function refreshInstagram(id: string, data?: { imageUrl: string; caption: string; fetchedAt: string }) {
    if (!data) return;
    setItems((prev) => prev.map((i) =>
      i.id === id && i.type === "instagram"
        ? { ...i, cachedImageUrl: data.imageUrl, cachedCaption: data.caption, fetchedAt: data.fetchedAt, lastFetchFailed: false }
        : i
    ));
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
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>Home Page</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60">
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
        <input type="text" value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="https://... or /images/..." className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm" />
        <p className="text-gray-400 text-xs mt-2">Leave blank to use default background image</p>
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
                  onUpdateItem={updateItem}
                  onAddFormField={addFormField}
                  onUpdateFormFieldDef={updateFormFieldDef}
                  onRemoveFormField={removeFormField}
                  onRefreshInstagram={refreshInstagram}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add item */}
        <div className="flex items-center gap-2 p-3 border border-dashed border-gray-200 rounded-sm">
          <select value={addType} onChange={(e) => setAddType(e.target.value as ItemType)} className="bg-white border border-gray-200 text-gray-500 text-xs px-2 py-1.5 outline-none rounded-sm">
            <option value="text">Text Slide</option>
            <option value="image">Image Slide</option>
            <option value="form">Form Slide</option>
            <option value="instagram">Instagram Slide</option>
          </select>
          <button onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-wider text-[#C97D5A] border border-[#C97D5A]/30 hover:bg-[#C97D5A]/10 transition-colors uppercase rounded-sm">
            <Plus size={13} /> Add
          </button>
        </div>
      </section>
    </div>
  );
}
