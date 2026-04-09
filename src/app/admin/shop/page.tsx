"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import type { ShopTab } from "@/lib/pagedata";
import { DEFAULT_SHOP_TABS } from "@/lib/pagedata";

function newTabId() { return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
const textareaCls = inputCls + " resize-none";

function TabCard({
  tab, isFirst, isLast,
  onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  tab: ShopTab; isFirst: boolean; isLast: boolean;
  onUpdate: (patch: Partial<ShopTab>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <span className="text-xs text-gray-500 truncate flex-1">{tab.label || "(no label)"}</span>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onMoveUp}   disabled={isFirst} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={isLast}  className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={14} /></button>
          <button onClick={onRemove} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className={labelCls}>Tab Label</label>
          <input className={inputCls} value={tab.label} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="e.g. Bottles & Merch" />
        </div>
        <div>
          <label className={labelCls}>Body Text</label>
          <textarea className={textareaCls} rows={3} value={tab.body} onChange={(e) => onUpdate({ body: e.target.value })} placeholder="Description shown on this tab…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Button Label</label>
            <input className={inputCls} value={tab.buttonLabel} onChange={(e) => onUpdate({ buttonLabel: e.target.value })} placeholder="e.g. Shop Now" />
          </div>
          <div>
            <label className={labelCls}>Button URL</label>
            <input className={inputCls} value={tab.buttonUrl} onChange={(e) => onUpdate({ buttonUrl: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input type="checkbox" checked={tab.buttonNewTab} onChange={(e) => onUpdate({ buttonNewTab: e.target.checked })} className="accent-[#C97D5A]" />
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

  function moveUp(idx: number) {
    if (idx === 0) return;
    setTabs((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }

  function moveDown(idx: number) {
    setTabs((prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  function addTab() {
    setTabs((prev) => [...prev, {
      id: newTabId(), label: "New Tab", body: "", buttonLabel: "Shop Now",
      buttonUrl: "https://commongoodcocktailhouse.com/shop", buttonNewTab: true,
    }]);
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
          <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>Shop Page</h1>
          <p className="text-gray-400 text-xs mt-1">Edit shop tabs — each tab has its own label, description, and button link</p>
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
          {tabs.map((tab, idx) => (
            <TabCard
              key={tab.id}
              tab={tab}
              isFirst={idx === 0}
              isLast={idx === tabs.length - 1}
              onUpdate={(patch) => updateTab(tab.id, patch)}
              onRemove={() => removeTab(tab.id)}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
            />
          ))}
          <button onClick={addTab} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/40 transition-colors text-xs tracking-widest uppercase rounded-sm">
            <Plus size={13} /> Add Tab
          </button>
        </div>
      )}
    </div>
  );
}
