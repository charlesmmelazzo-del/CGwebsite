"use client";

import { Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ContentSection } from "@/types";
import ImagePicker from "@/components/ui/ImagePicker";

// Shared field styles — also reused by other admin section editors
export const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
export const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
export const textareaCls = inputCls + " resize-none";

// A single draggable content section (title / body / image / button).
// Used by the About, Club, and Content Pages editors.
export default function SectionCard({
  section,
  onUpdate,
  onRemove,
}: {
  section: ContentSection;
  onUpdate: (patch: Partial<ContentSection>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

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
        <span className="text-xs text-gray-500 truncate flex-1">{section.title || "(no title)"}</span>
        <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={section.title ?? ""}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Section title"
          />
        </div>
        <div>
          <label className={labelCls}>Body Text</label>
          <textarea
            className={textareaCls}
            rows={4}
            value={section.body ?? ""}
            onChange={(e) => onUpdate({ body: e.target.value })}
            placeholder="Body text…"
          />
        </div>
        <ImagePicker
          label="Image (optional)"
          value={section.imageUrl ?? ""}
          onChange={(url) => onUpdate({ imageUrl: url || undefined })}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Button Label</label>
            <input
              className={inputCls}
              value={section.buttonLabel ?? ""}
              onChange={(e) => onUpdate({ buttonLabel: e.target.value || undefined })}
              placeholder="e.g. Learn More"
            />
          </div>
          <div>
            <label className={labelCls}>Button URL</label>
            <input
              className={inputCls}
              value={section.buttonUrl ?? ""}
              onChange={(e) => onUpdate({ buttonUrl: e.target.value || undefined })}
              placeholder="https://..."
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={section.buttonNewTab ?? false}
            onChange={(e) => onUpdate({ buttonNewTab: e.target.checked })}
            className="accent-[#C97D5A]"
          />
          Open button in new tab
        </label>
      </div>
    </div>
  );
}
