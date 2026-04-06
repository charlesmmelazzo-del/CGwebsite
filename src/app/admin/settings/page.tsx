"use client";

import { useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { SITE_SETTINGS } from "@/lib/constants";
import type { SiteSettings } from "@/types";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>({ ...SITE_SETTINGS });
  const [saved, setSaved] = useState(false);

  function updateField(field: keyof SiteSettings, value: string) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  function updateHoursLabel(index: number, value: string) {
    const hours = [...settings.hours];
    hours[index] = { ...hours[index], label: value };
    setSettings((s) => ({ ...s, hours }));
  }

  function updateHoursLine(hIndex: number, lIndex: number, value: string) {
    const hours = [...settings.hours];
    const lines = [...hours[hIndex].lines];
    lines[lIndex] = value;
    hours[hIndex] = { ...hours[hIndex], lines };
    setSettings((s) => ({ ...s, hours }));
  }

  function addHoursLine(hIndex: number) {
    const hours = [...settings.hours];
    hours[hIndex] = { ...hours[hIndex], lines: [...hours[hIndex].lines, ""] };
    setSettings((s) => ({ ...s, hours }));
  }

  function removeHoursLine(hIndex: number, lIndex: number) {
    const hours = [...settings.hours];
    const lines = hours[hIndex].lines.filter((_, i) => i !== lIndex);
    hours[hIndex] = { ...hours[hIndex], lines };
    setSettings((s) => ({ ...s, hours }));
  }

  function addHoursGroup() {
    setSettings((s) => ({
      ...s,
      hours: [...s.hours, { label: "NEW", lines: [""] }],
    }));
  }

  function removeHoursGroup(index: number) {
    setSettings((s) => ({
      ...s,
      hours: s.hours.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          Site Settings
        </h1>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
        >
          <Save size={14} />
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      <div className="space-y-8">
        {/* Contact */}
        <section>
          <h2 className="text-sm tracking-widest uppercase text-gray-400 mb-4 border-b border-gray-200 pb-2">
            Contact Info
          </h2>
          <div className="space-y-4">
            {(["phone", "email", "address", "addressLine2"] as const).map((field) => (
              <div key={field}>
                <label className="block text-xs tracking-wider uppercase text-gray-400 mb-1 capitalize">
                  {field === "addressLine2" ? "Address Line 2" : field}
                </label>
                <input
                  type="text"
                  value={settings[field] as string}
                  onChange={(e) => updateField(field, e.target.value)}
                  className="w-full bg-white border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 transition-colors rounded-sm"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Hours */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
            <h2 className="text-sm tracking-widest uppercase text-gray-400">Hours</h2>
            <button onClick={addHoursGroup} className="text-gray-400 hover:text-[#C97D5A] transition-colors">
              <Plus size={16} />
            </button>
          </div>
          {settings.hours.map((group, hIndex) => (
            <div key={hIndex} className="mb-4 p-4 bg-white border border-gray-200 rounded-sm space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={group.label}
                  onChange={(e) => updateHoursLabel(hIndex, e.target.value)}
                  placeholder="Label (e.g. COFFEE)"
                  className="flex-1 bg-transparent border-b border-gray-200 text-gray-700 text-xs tracking-wider uppercase py-1 outline-none focus:border-[#C97D5A]/50"
                />
                <button
                  onClick={() => removeHoursGroup(hIndex)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {group.lines.map((line, lIndex) => (
                <div key={lIndex} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => updateHoursLine(hIndex, lIndex, e.target.value)}
                    placeholder="e.g. Mon - Sat | 7am - 12pm"
                    className="flex-1 bg-transparent border-b border-gray-200 text-gray-600 text-xs py-1 outline-none focus:border-[#C97D5A]/50"
                  />
                  <button
                    onClick={() => removeHoursLine(hIndex, lIndex)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addHoursLine(hIndex)}
                className="text-xs text-gray-400 hover:text-[#C97D5A] flex items-center gap-1 transition-colors"
              >
                <Plus size={12} /> Add line
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
