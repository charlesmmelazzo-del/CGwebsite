"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save, Plus, Trash2, GripVertical, ExternalLink, Info } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ImagePicker from "@/components/ui/ImagePicker";
import type { ReserveContent, ReserveFaq } from "@/lib/reserve/types";

const inputCls =
  "w-full bg-white border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 transition-colors rounded-sm";
const labelCls = "block text-xs tracking-wider uppercase text-gray-400 mb-1";
const sectionH = "text-sm tracking-widest uppercase text-gray-400 mb-4 border-b border-gray-200 pb-2";

const newId = () => `faq-${Math.random().toString(36).slice(2, 10)}`;

function FaqRow({
  item,
  index,
  onChange,
  onDelete,
}: {
  item: ReserveFaq;
  index: number;
  onChange: (u: Partial<ReserveFaq>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex gap-2 p-3 bg-white border border-gray-200 rounded-sm"
    >
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing self-start mt-1.5"
        aria-label={`Drag to reorder question ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 space-y-2">
        <input
          className={inputCls}
          placeholder="Question"
          value={item.question}
          onChange={(e) => onChange({ question: e.target.value })}
          aria-label={`Question ${index + 1}`}
        />
        <textarea
          className={`${inputCls} min-h-[72px] resize-y`}
          placeholder="Answer"
          value={item.answer}
          onChange={(e) => onChange({ answer: e.target.value })}
          aria-label={`Answer ${index + 1}`}
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-gray-300 hover:text-red-500 transition-colors self-start mt-1.5"
        aria-label={`Delete question ${index + 1}`}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function AdminReservePage() {
  const [content, setContent] = useState<ReserveContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetch("/api/admin/reserve")
      .then((r) => r.json())
      .then((d: ReserveContent) => setContent(d))
      .catch(() => setSaveError("Couldn't load the Reserve page content."));
  }, []);

  function update(u: Partial<ReserveContent>) {
    setContent((c) => (c ? { ...c, ...u } : c));
    setSaved(false);
  }
  function updateFaq(id: string, u: Partial<ReserveFaq>) {
    if (!content) return;
    update({ faq: content.faq.map((f) => (f.id === id ? { ...f, ...u } : f)) });
  }
  function onDragEnd(e: DragEndEvent) {
    if (!content || !e.over || e.active.id === e.over.id) return;
    const from = content.faq.findIndex((f) => f.id === e.active.id);
    const to = content.faq.findIndex((f) => f.id === e.over!.id);
    update({ faq: arrayMove(content.faq, from, to) });
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");
      setContent(data.content);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error && e.message !== "Save failed" ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        {saveError ? (
          <span className="text-sm text-red-500">{saveError}</span>
        ) : (
          <>
            <Loader2 size={18} className="animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          Reserve Page
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/reserve"
            target="_blank"
            className="flex items-center gap-1.5 text-xs tracking-widest uppercase text-gray-500 hover:text-[#C97D5A]"
          >
            Preview <ExternalLink size={12} />
          </Link>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Saved!" : saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-sm flex gap-2">
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>Booking rules, hours, and policies are managed in the CG Bible under Comms → Reservations → Settings.</span>
      </div>

      {saveError && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">{saveError}</div>}

      <div className="space-y-8">
        <section>
          <h2 className={sectionH}>Heading</h2>
          <label className={labelCls} htmlFor="rp-title">
            Title
          </label>
          <input id="rp-title" className={inputCls} value={content.title} onChange={(e) => update({ title: e.target.value })} />
        </section>

        <section>
          <h2 className={sectionH}>Photo</h2>
          <ImagePicker value={content.imageUrl} onChange={(url) => update({ imageUrl: url })} />
          <label className={`${labelCls} mt-3`} htmlFor="rp-alt">
            Alt text
          </label>
          <input
            id="rp-alt"
            className={inputCls}
            placeholder="Describe the photo for screen readers"
            value={content.imageAlt ?? ""}
            onChange={(e) => update({ imageAlt: e.target.value })}
          />
          <p className="text-[11px] text-gray-400 mt-1">With no photo, the intro takes the full width.</p>
        </section>

        <section>
          <h2 className={sectionH}>Intro paragraph</h2>
          <textarea
            className={`${inputCls} min-h-[180px] resize-y`}
            value={content.intro}
            onChange={(e) => update({ intro: e.target.value })}
            aria-label="Intro paragraph"
          />
          <p className="text-[11px] text-gray-400 mt-1">Line breaks are kept.</p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
            <h2 className="text-sm tracking-widest uppercase text-gray-400">Frequently asked questions</h2>
            <button
              type="button"
              onClick={() => update({ faq: [...content.faq, { id: newId(), question: "", answer: "" }] })}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#C97D5A] transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {content.faq.length === 0 ? (
            <p className="text-sm text-gray-400">No questions. The FAQ button is hidden until you add one.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={content.faq.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {content.faq.map((f, i) => (
                    <FaqRow
                      key={f.id}
                      item={f}
                      index={i}
                      onChange={(u) => updateFaq(f.id, u)}
                      onDelete={() => update({ faq: content.faq.filter((x) => x.id !== f.id) })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </div>
  );
}
