"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import clsx from "clsx";
import type { MenuTab, MenuPdfPage } from "@/types";
import { uploadMenuPdf } from "@/lib/pdfPages";

// Admin editor for a menu tab that shows an uploaded PDF instead of cocktails.
export default function PdfTabPanel({
  tab,
  onChange,
}: {
  tab: MenuTab;
  onChange: (patch: Partial<MenuTab>) => void;
}) {
  const label = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";

  return (
    <div className="space-y-5 bg-white border border-gray-200 rounded-sm p-5">
      <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className={label}>Section Name</label>
          <input
            type="text"
            value={tab.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500 pb-2">
          <input
            type="checkbox"
            checked={tab.active}
            onChange={(e) => onChange({ active: e.target.checked })}
            className="accent-[#C97D5A]"
          />
          Visible to customers
        </label>
      </div>

      <PdfUploader value={tab} onChange={onChange} />
    </div>
  );
}

export interface PdfValue {
  pdfUrl?: string;
  pdfPages?: MenuPdfPage[];
}

// Drop zone → page previews, with replace / open / remove. Shared by the
// cocktail menu's PDF sections and the coffee menus.
export function PdfUploader({
  value,
  onChange,
}: {
  value: PdfValue;
  onChange: (patch: PdfValue) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);

  const busy = !!progress;
  const pages = value.pdfPages ?? [];

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("That isn't a PDF — export the menu as a PDF and try again.");
      return;
    }
    setError("");
    setJustUploaded(false);
    try {
      const { pdfUrl, pages } = await uploadMenuPdf(file, setProgress);
      onChange({ pdfUrl, pdfPages: pages });
      setJustUploaded(true);
    } catch (e) {
      setError("Upload failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const label = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {pages.length > 0 && !busy ? (
        <div>
          <p className={label}>
            {pages.length} {pages.length === 1 ? "page" : "pages"} — as guests will see {pages.length === 1 ? "it" : "them"}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
            {pages.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.url}
                src={p.url}
                alt={`Page ${i + 1}`}
                className="h-56 w-auto shrink-0 rounded-[2px] border border-gray-200 bg-white shadow-md"
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-[10px] tracking-widest uppercase hover:border-[#C97D5A] hover:text-[#C97D5A] transition-colors rounded-sm"
            >
              <RefreshCw size={12} /> Replace PDF
            </button>
            {value.pdfUrl && (
              <a
                href={value.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-[10px] tracking-widest uppercase hover:border-gray-400 transition-colors rounded-sm"
              >
                <ExternalLink size={12} /> Open PDF
              </a>
            )}
            <button
              onClick={() => {
                if (confirm("Remove this PDF from the section?")) {
                  onChange({ pdfUrl: undefined, pdfPages: undefined });
                  setJustUploaded(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-400 text-[10px] tracking-widest uppercase hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} /> Remove PDF
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          disabled={busy}
          className={clsx(
            "w-full flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed rounded-sm transition-colors",
            dragOver ? "border-[#C97D5A] bg-[#C97D5A]/5" : "border-gray-200 hover:border-[#C97D5A]/40",
            busy && "cursor-wait"
          )}
        >
          {busy ? (
            <>
              <Loader2 size={22} className="animate-spin text-[#C97D5A]" />
              <span className="text-xs text-gray-500">{progress}</span>
            </>
          ) : (
            <>
              <FileUp size={22} className="text-gray-300" />
              <span className="text-xs tracking-widest uppercase text-gray-500">Drop a PDF here or click to choose</span>
              <span className="text-[11px] text-gray-400">Each page shows as its own menu card — 4.25 × 11 works great</span>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">{error}</div>
      )}
      {justUploaded && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-sm">
          PDF ready — click <strong>Save</strong> at the top to publish it.
        </div>
      )}
    </div>
  );
}
