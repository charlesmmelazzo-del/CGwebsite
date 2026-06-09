"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import type { CarouselItem } from "@/types";
import SliderInput from "@/components/ui/SliderInput";
import CarouselEditor from "@/components/admin/CarouselEditor";

export default function AdminHomePage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [bgUrl, setBgUrl] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [autoAdvanceInterval, setAutoAdvanceInterval] = useState(6);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetch("/api/admin/home")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.carouselItems)) setItems(d.carouselItems);
        if (typeof d.bgUrl === "string") setBgUrl(d.bgUrl);
        if (typeof d.autoAdvance === "boolean") setAutoAdvance(d.autoAdvance);
        if (typeof d.autoAdvanceInterval === "number") setAutoAdvanceInterval(d.autoAdvanceInterval);
      })
      .catch(() => setLoadError(true));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bgUrl, carouselItems: items, autoAdvance, autoAdvanceInterval }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError("Failed to save: " + (e instanceof Error ? e.message : String(e)));
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

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">
          {saveError}
        </div>
      )}

      {/* Background image */}
      <section className="mb-4 p-4 bg-white border border-gray-200 rounded-sm">
        <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-3">Background Image</h2>
        <input type="text" value={bgUrl} onChange={(e) => setBgUrl(e.target.value)} placeholder="https://... or /images/..." className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm" />
        <p className="text-gray-400 text-xs mt-2">Leave blank to use default background image</p>
      </section>

      {/* Auto-advance */}
      <section className="mb-8 p-4 bg-white border border-gray-200 rounded-sm space-y-3">
        <h2 className="text-xs tracking-widest uppercase text-gray-400">Carousel Settings</h2>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
            className="accent-[#C97D5A] w-3.5 h-3.5"
          />
          <span className="text-sm text-gray-700">Auto-advance slides</span>
        </label>
        {autoAdvance && (
          <div className="pl-6">
            <SliderInput
              label={`Interval — ${autoAdvanceInterval}s`}
              value={autoAdvanceInterval}
              min={2}
              max={30}
              step={1}
              onChange={setAutoAdvanceInterval}
            />
          </div>
        )}
      </section>

      {/* Carousel items */}
      <section>
        <h2 className="text-xs tracking-widest uppercase text-gray-400 mb-4 border-b border-gray-200 pb-2">
          Carousel Items — drag to reorder
        </h2>
        <CarouselEditor items={items} onChange={setItems} />
      </section>
    </div>
  );
}
