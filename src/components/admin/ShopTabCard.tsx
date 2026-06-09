"use client";

import { Trash2, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ShopTab } from "@/lib/pagedata";
import ImagePicker from "@/components/ui/ImagePicker";
import { labelCls, inputCls, textareaCls } from "@/components/admin/SectionCard";

// A single draggable shop tab (label / body / image / button).
// Used by the Content Pages editor when the Shop page is selected.
export default function ShopTabCard({
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
