"use client";

import { useEffect, useState } from "react";
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
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import type { PopupCocktail } from "@/lib/popup/types";

/**
 * Shown when a guest tries to vote for a second cocktail.
 *
 * Rather than refusing the extra vote or silently counting it equally, we ask
 * them to put their picks in order — which is exactly what the owner asked
 * for, and gives lower-ranked picks a real (smaller) say in the standings.
 */
export default function RankingModal({
  open,
  cocktails,
  initialOrder,
  weights,
  rankDepth,
  accent = "#C97D5A",
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  cocktails: PopupCocktail[];
  /** Cocktail ids, current favorite first. */
  initialOrder: string[];
  weights: number[];
  rankDepth: number;
  accent?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (rankedIds: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Re-seed whenever the modal is opened with a different set of picks.
  useEffect(() => {
    if (open) setOrder(initialOrder);
  }, [open, initialOrder]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const byId = new Map(cocktails.map((c) => [c.id, c]));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      return arrayMove(prev, i, j);
    });
  }

  function remove(id: string) {
    setOrder((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div
      // Above the cocktail detail card (z-50), below a running game (z-70).
      // Keep those three in step when adding another overlay.
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Rank your favorites"
    >
      <div className="w-full sm:max-w-lg bg-[#14180f] border border-white/15 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/10">
          <div>
            <h2 className="text-sm tracking-[0.2em] uppercase text-white/90">
              Rank your favorites
            </h2>
            <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
              You&apos;ve picked more than one — put them in order and your lower picks still
              count toward the leader, just for fewer points.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-white/40 hover:text-white shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {order.map((id, i) => {
                  const c = byId.get(id);
                  if (!c) return null;
                  return (
                    <SortableRow
                      key={id}
                      id={id}
                      index={i}
                      name={c.name}
                      points={weights[i] ?? 0}
                      accent={accent}
                      canUp={i > 0}
                      canDown={i < order.length - 1}
                      onUp={() => move(id, -1)}
                      onDown={() => move(id, 1)}
                      onRemove={order.length > 1 ? () => remove(id) : undefined}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>

          <p className="mt-4 text-[11px] text-white/35 leading-relaxed">
            You can rank up to {rankDepth} cocktail{rankDepth === 1 ? "" : "s"}. Drag, or use the
            arrows.
          </p>

          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        </div>

        <div className="p-5 border-t border-white/10 flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 text-[11px] tracking-[0.2em] uppercase text-white/60 border border-white/15 rounded-lg hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(order)}
            disabled={busy || !order.length}
            style={{ background: accent }}
            className="flex-1 py-3 text-[11px] tracking-[0.2em] uppercase text-black font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save ranking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableRow({
  id,
  index,
  name,
  points,
  accent,
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
}: {
  id: string;
  index: number;
  name: string;
  points: number;
  accent: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-2 px-3 py-3 bg-white/[0.05] border border-white/10 rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-white/25 hover:text-white/60 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Reorder ${name}`}
      >
        <GripVertical size={16} />
      </button>

      <span
        style={{ color: accent }}
        className="w-5 text-sm tabular-nums font-semibold shrink-0"
      >
        {index + 1}
      </span>

      <span className="flex-1 min-w-0 text-sm text-white/90 truncate">{name}</span>

      <span className="shrink-0 text-[10px] tracking-wider uppercase text-white/35 tabular-nums">
        {points} pt{points === 1 ? "" : "s"}
      </span>

      <div className="flex flex-col shrink-0">
        <button
          onClick={onUp}
          disabled={!canUp}
          className="text-white/30 hover:text-white disabled:opacity-20"
          aria-label={`Move ${name} up`}
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={onDown}
          disabled={!canDown}
          className="text-white/30 hover:text-white disabled:opacity-20"
          aria-label={`Move ${name} down`}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {onRemove && (
        <button
          onClick={onRemove}
          className="text-white/25 hover:text-red-300 shrink-0 ml-1"
          aria-label={`Remove ${name}`}
        >
          <X size={14} />
        </button>
      )}
    </li>
  );
}
