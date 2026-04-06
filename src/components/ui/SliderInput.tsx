"use client";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
};

export default function SliderInput({
  label, value, min, max, step = 1, unit = "px", onChange,
}: Props) {
  function clamp(n: number) { return Math.min(max, Math.max(min, n)); }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] tracking-widest uppercase text-gray-400">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!isNaN(n)) onChange(clamp(n));
            }}
            className="w-14 text-right bg-gray-50 border border-gray-200 text-gray-700 text-xs px-2 py-1 outline-none focus:border-[#C97D5A]/50 rounded-sm tabular-nums"
          />
          {unit && <span className="text-[10px] text-gray-400 w-5 shrink-0">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#C97D5A] h-1 cursor-pointer"
        style={{ height: "4px" }}
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-300">{min}{unit}</span>
        <span className="text-[9px] text-gray-300">{max}{unit}</span>
      </div>
    </div>
  );
}
