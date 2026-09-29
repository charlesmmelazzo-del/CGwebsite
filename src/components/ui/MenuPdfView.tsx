"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from "lucide-react";
import clsx from "clsx";
import type { MenuTab, MenuPdfPage } from "@/types";

interface Props {
  tab: Pick<MenuTab, "label" | "pdfUrl" | "pdfPages">;
  textColor: string;
  mutedColor: string;
  /** "spread" lays pages side by side like cards on a bar top (desktop);
   *  "stack" runs them full width, one under the other (mobile). */
  layout: "spread" | "stack";
}

// A tilt per page so a spread reads like printed cards set down by hand.
const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9];

export default function MenuPdfView({ tab, textColor, mutedColor, layout }: Props) {
  const pages = tab.pdfPages ?? [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!pages.length) {
    return (
      <div className="flex items-center justify-center h-32 text-xs tracking-widest uppercase opacity-40" style={{ color: textColor }}>
        Coming soon
      </div>
    );
  }

  return (
    <div className={clsx(layout === "stack" ? "px-4 pt-3 pb-6" : "px-6 pt-2 pb-4")}>
      <div
        className={clsx(
          layout === "spread"
            ? "flex flex-wrap justify-center items-start gap-8"
            : "flex flex-col items-center gap-5"
        )}
      >
        {pages.map((page, i) => (
          <PaperPage
            key={page.url}
            page={page}
            alt={`${tab.label} menu${pages.length > 1 ? `, page ${i + 1}` : ""}`}
            tilt={layout === "spread" && pages.length > 1 ? TILTS[i % TILTS.length] : 0}
            className={
              layout === "spread"
                ? pages.length === 1
                  ? "w-[min(420px,100%)]"
                  : "w-[min(360px,calc((100%_-_4rem)/3))] min-w-[240px]"
                : "w-full max-w-[480px]"
            }
            onOpen={() => setOpenIndex(i)}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <p className="text-[10px] tracking-[0.25em] uppercase opacity-50" style={{ color: mutedColor }}>
          {layout === "stack" ? "Tap" : "Click"} a page to zoom
        </p>
        {tab.pdfUrl && (
          <a
            href={tab.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] tracking-[0.2em] uppercase transition-colors hover:bg-[#C97D5A] hover:text-white"
            style={{ border: "1px solid #C97D5A80", color: "#C97D5A" }}
          >
            <Download size={11} /> PDF
          </a>
        )}
      </div>

      {openIndex !== null && (
        <PageLightbox
          pages={pages}
          label={tab.label}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

function PaperPage({
  page,
  alt,
  tilt,
  className,
  onOpen,
}: {
  page: MenuPdfPage;
  alt: string;
  tilt: number;
  className: string;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      onClick={onOpen}
      className={clsx(
        "group relative block rounded-[3px] overflow-hidden bg-white transition-all duration-300 ease-out",
        "rotate-[var(--tilt)] hover:rotate-0 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C97D5A]",
        className
      )}
      style={{
        aspectRatio: `${page.width} / ${page.height}`,
        "--tilt": `${tilt}deg`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.25), 0 18px 40px -14px rgba(0,0,0,0.6)",
      } as React.CSSProperties}
      aria-label={`Open ${alt}`}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-200" />}
      {/* Pages are pre-sized WebPs in Supabase — next/image resizing adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={page.url}
        alt={alt}
        width={page.width}
        height={page.height}
        onLoad={() => setLoaded(true)}
        className={clsx("w-full h-full object-contain transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        draggable={false}
      />
      {/* Soft paper sheen that lifts on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-black/[0.06] group-hover:to-black/0 transition-colors" />
    </button>
  );
}

function PageLightbox({
  pages,
  label,
  index,
  onIndexChange,
  onClose,
}: {
  pages: MenuPdfPage[];
  label: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const page = pages[index];
  const hasPrev = index > 0;
  const hasNext = index < pages.length - 1;

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= pages.length) return;
      setZoomed(false);
      onIndexChange(next);
    },
    [index, pages.length, onIndexChange]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  const btn = "w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-25";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${label} menu`}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 text-white">
        <p className="text-xs tracking-[0.25em] uppercase opacity-80" style={{ fontFamily: "var(--font-display)" }}>
          {label}
          {pages.length > 1 && <span className="opacity-50"> · {index + 1} / {pages.length}</span>}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoomed((z) => !z)} className={btn} aria-label={zoomed ? "Zoom out" : "Zoom in"}>
            {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
          </button>
          <button onClick={onClose} className={btn} aria-label="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Page — scrolls in both directions when zoomed */}
      <div
        className="flex-1 min-h-0 overflow-auto overscroll-contain"
        style={{ touchAction: "pinch-zoom pan-x pan-y" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          className="mx-auto px-3 pb-6"
          style={{ width: zoomed ? "min(1300px, 200vw)" : "min(640px, 100%)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={page.url}
            src={page.url}
            alt={`${label} menu, page ${index + 1}`}
            width={page.width}
            height={page.height}
            onClick={() => setZoomed((z) => !z)}
            className={clsx("w-full h-auto rounded-[3px] bg-white shadow-2xl", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
            draggable={false}
          />
        </div>
      </div>

      {pages.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-6 py-3">
          <button onClick={() => go(-1)} disabled={!hasPrev} className={btn} aria-label="Previous page">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => go(1)} disabled={!hasNext} className={btn} aria-label="Next page">
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
