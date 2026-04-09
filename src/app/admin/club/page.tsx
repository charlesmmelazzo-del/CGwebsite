"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import type { ContentSection } from "@/types";
import { DEFAULT_CLUB } from "@/lib/pagedata";
import ImagePicker from "@/components/ui/ImagePicker";

function newId() { return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
const textareaCls = inputCls + " resize-none";

function SectionCard({
  section, isFirst, isLast,
  onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  section: ContentSection; isFirst: boolean; isLast: boolean;
  onUpdate: (patch: Partial<ContentSection>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <span className="text-xs text-gray-500 truncate flex-1">{section.title || "(no title)"}</span>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onMoveUp}  disabled={isFirst} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={isLast}  className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
          <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={section.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Section title" />
        </div>
        <div>
          <label className={labelCls}>Body Text</label>
          <textarea className={textareaCls} rows={4} value={section.body ?? ""} onChange={(e) => onUpdate({ body: e.target.value })} placeholder="Body text…" />
        </div>
        <ImagePicker label="Image (optional)" value={section.imageUrl ?? ""} onChange={(url) => onUpdate({ imageUrl: url || undefined })} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Button Label</label>
            <input className={inputCls} value={section.buttonLabel ?? ""} onChange={(e) => onUpdate({ buttonLabel: e.target.value || undefined })} placeholder="e.g. Learn More" />
          </div>
          <div>
            <label className={labelCls}>Button URL</label>
            <input className={inputCls} value={section.buttonUrl ?? ""} onChange={(e) => onUpdate({ buttonUrl: e.target.value || undefined })} placeholder="https://..." />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={section.buttonNewTab ?? false} onChange={(e) => onUpdate({ buttonNewTab: e.target.checked })} className="accent-[#C97D5A]" />
          Open button in new tab
        </label>
      </div>
    </div>
  );
}

export default function AdminClubPage() {
  const [sections, setSections] = useState<ContentSection[]>(DEFAULT_CLUB);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/page-content?slug=club")
      .then((r) => r.json())
      .then(({ sections: data }) => {
        if (Array.isArray(data) && data.length > 0) setSections(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function updateSection(id: string, patch: Partial<ContentSection>) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
    setSaved(false);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
    setSaved(false);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setSections((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
    setSaved(false);
  }

  function moveDown(idx: number) {
    setSections((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
    setSaved(false);
  }

  function addSection() {
    setSections((prev) => [...prev, { id: newId(), order: prev.length, title: "", body: "" }]);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/page-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "club", label: "Club", sections }),
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
          <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>Club Page</h1>
          <p className="text-gray-400 text-xs mt-1">Edit the Cocktail Club page content and link</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60">
          <Save size={14} />
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <SectionCard
              key={section.id}
              section={section}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
              onUpdate={(patch) => updateSection(section.id, patch)}
              onRemove={() => removeSection(section.id)}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
            />
          ))}
          <button onClick={addSection} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/40 transition-colors text-xs tracking-widest uppercase rounded-sm">
            <Plus size={13} /> Add Section
          </button>
        </div>
      )}
    </div>
  );
}
