"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Info } from "lucide-react";
import SliderInput from "@/components/ui/SliderInput";
import ImagePicker from "@/components/ui/ImagePicker";
import type { PageHeaderData, PageHeaderTab } from "@/types";
import { getPageDefault } from "@/lib/pagedefaults";
import ThemeEditor from "@/components/ui/ThemeEditor";

// ─── Page config metadata ──────────────────────────────────────────────────────
const PAGES = [
  { id: "menu",   label: "Menu",   hasSubtitle: true,  tabNote: "Menu tab labels are managed in the Menu admin section." },
  { id: "coffee", label: "Coffee", hasSubtitle: true,  tabNote: "Coffee tab labels are managed in the Coffee admin section." },
  { id: "events", label: "Events", hasSubtitle: false, tabNote: null },
  { id: "club",   label: "Club",   hasSubtitle: false, tabNote: null },
  { id: "about",  label: "About",  hasSubtitle: false, tabNote: null },
  { id: "shop",   label: "Shop",   hasSubtitle: false, tabNote: null },
] as const;

type PageId = typeof PAGES[number]["id"];

// ─── Component ────────────────────────────────────────────────────────────────
export default function PageTextAdmin() {
  const [activePageId, setActivePageId] = useState<PageId>("menu");
  const [data, setData] = useState<Record<PageId, PageHeaderData>>(() => {
    const init = {} as Record<PageId, PageHeaderData>;
    for (const p of PAGES) init[p.id] = getPageDefault(p.id);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load saved values from DB
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/page-headers");
        if (!res.ok) return;
        const { pages } = await res.json() as { pages: Record<string, PageHeaderData> };
        setData((prev) => {
          const next = { ...prev };
          for (const p of PAGES) {
            if (pages[p.id]) next[p.id] = { ...prev[p.id], ...pages[p.id] };
          }
          return next;
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const page = PAGES.find((p) => p.id === activePageId)!;
  const current = data[activePageId];

  function update(patch: Partial<PageHeaderData>) {
    setData((prev) => ({ ...prev, [activePageId]: { ...prev[activePageId], ...patch } }));
    setSaved(false);
  }

  function updateTab(tabId: string, label: string) {
    const tabs = (current.tabs ?? []).map((t) =>
      t.id === tabId ? { ...t, label } : t
    );
    update({ tabs });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/page-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: activePageId, data: current }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const labelCls = "block text-[10px] tracking-widest uppercase text-gray-500 mb-1 font-medium";
  const inputCls = "w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C97D5A]";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Page Text</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] disabled:opacity-50 transition-colors rounded"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Page tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-0">
        {PAGES.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActivePageId(p.id); setSaved(false); }}
            className={`px-4 py-2 text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
              activePageId === p.id
                ? "border-[#C97D5A] text-[#C97D5A]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Title ── */}
      <section className="bg-white rounded border border-gray-200 p-5 space-y-4">
        <p className={labelCls + " text-gray-700"}>Page Title</p>
        <div>
          <label className={labelCls}>Title Text</label>
          <input
            className={inputCls}
            value={current.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <SliderInput
          label="Title Size"
          value={current.titleSize}
          min={24}
          max={120}
          step={2}
          onChange={(v) => update({ titleSize: v })}
        />
        <p className="text-[10px] text-gray-400 italic">
          Preview: <span style={{ fontSize: Math.round(current.titleSize * 0.35) + "px", fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{current.title || "—"}</span>
        </p>
      </section>

      {/* ── Subtitle ── */}
      {page.hasSubtitle && (
        <section className="bg-white rounded border border-gray-200 p-5 space-y-4">
          <p className={labelCls + " text-gray-700"}>Subtitle / Tagline</p>
          <div>
            <label className={labelCls}>Subtitle Text <span className="normal-case text-gray-400">(leave blank to hide)</span></label>
            <input
              className={inputCls}
              value={current.subtitle ?? ""}
              onChange={(e) => update({ subtitle: e.target.value })}
            />
          </div>
          <SliderInput
            label="Subtitle Size"
            value={current.subtitleSize ?? 13}
            min={10}
            max={24}
            onChange={(v) => update({ subtitleSize: v })}
          />
        </section>
      )}

      {/* ── Background Image ── */}
      <section className="bg-white rounded border border-gray-200 p-5 space-y-4">
        <p className={labelCls + " text-gray-700"}>Background Image</p>
        <p className="text-xs text-gray-400">Upload from your image library or paste a URL. Leave blank to use the default page color.</p>
        <ImagePicker
          label="Upload from library"
          value={current.bgImageUrl ?? ""}
          onChange={(url) => update({ bgImageUrl: url })}
        />
        <div>
          <label className={labelCls}>Or paste an image URL</label>
          <input
            className={inputCls}
            placeholder="https://..."
            value={current.bgImageUrl ?? ""}
            onChange={(e) => update({ bgImageUrl: e.target.value })}
          />
        </div>
      </section>

      {/* ── Theme ── */}
      <section className="bg-white rounded border border-gray-200 p-5 space-y-4">
        <p className={labelCls + " text-gray-700"}>Page Color Theme</p>
        <p className="text-xs text-gray-400">
          Pick a preset to start, then customize each color with the color wheel or enter a hex value.
        </p>
        <ThemeEditor
          theme={current.theme}
          customBg={current.customBg}
          customText={current.customText}
          customMuted={current.customMuted}
          onChange={(updates) => update(updates)}
        />
      </section>

      {/* ── Tabs ── */}
      {(current.tabs && current.tabs.length > 0) || page.tabNote ? (
        <section className="bg-white rounded border border-gray-200 p-5 space-y-4">
          <p className={labelCls + " text-gray-700"}>Tab Labels</p>
          {page.tabNote ? (
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded p-3">
              <Info size={13} className="shrink-0 mt-0.5 text-gray-400" />
              <span>{page.tabNote}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {(current.tabs as PageHeaderTab[]).map((tab) => (
                <div key={tab.id}>
                  <label className={labelCls}>
                    Tab: <span className="text-gray-400 normal-case">{tab.id}</span>
                  </label>
                  <input
                    className={inputCls}
                    value={tab.label}
                    onChange={(e) => updateTab(tab.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
