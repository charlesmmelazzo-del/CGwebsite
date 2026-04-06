"use client";

import { useState, useRef, useEffect } from "react";
import { COLOR_GROUPS } from "@/lib/brandColors";

interface ColorPickerProps {
  value?: string;          // currently selected hex, or undefined = default
  onChange: (hex: string | undefined) => void;
  label?: string;          // optional label shown above the picker row
  size?: "sm" | "md";      // swatch size
}

export default function ColorPicker({ value, onChange, label, size = "sm" }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const swatchSize = size === "sm" ? 18 : 24;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      {label && (
        <span className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">{label}</span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border border-gray-200 rounded-sm px-2 py-1 hover:border-gray-400 transition-colors bg-white"
        title={value ?? "Default color"}
      >
        {/* Color preview swatch */}
        <span
          style={{
            width: swatchSize,
            height: swatchSize,
            backgroundColor: value ?? "transparent",
            border: value ? "none" : "1px dashed #d1d5db",
          }}
          className="rounded-sm shrink-0 inline-block"
        />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider leading-none">
          {value ? value.toUpperCase() : "Default"}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-sm p-3 w-max">
          {/* Clear / default option */}
          <button
            type="button"
            onClick={() => { onChange(undefined); setOpen(false); }}
            className="mb-2 text-[10px] uppercase tracking-wider text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
          >
            <span className="inline-block w-4 h-4 border border-dashed border-gray-300 rounded-sm" />
            Use default
          </button>

          {/* Color groups */}
          <div className="space-y-2">
            {COLOR_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[9px] uppercase tracking-widest text-gray-300 mb-1">{group.label}</p>
                <div className="flex gap-1">
                  {group.colors.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={`${c.label} — ${c.hex}`}
                      onClick={() => { onChange(c.hex); setOpen(false); }}
                      style={{ backgroundColor: c.hex, width: swatchSize + 2, height: swatchSize + 2 }}
                      className={`rounded-sm border-2 transition-all hover:scale-110 ${
                        value === c.hex ? "border-gray-700 scale-110" : "border-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
