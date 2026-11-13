"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BibleConfig, ReserveContent } from "@/lib/reserve/types";
import { telHref } from "@/lib/reserve/format";
import BookingFlow from "@/components/reserve/BookingFlow";
import { FaqModal, RvRoot, type RvTheme } from "@/components/reserve/ui";


export default function ReservePageClient({
  content,
  config,
  unavailable,
  phone,
  theme,
  titleSize,
}: {
  content: ReserveContent;
  config: BibleConfig | null;
  unavailable: string;
  phone: string;
  theme: RvTheme;
  titleSize?: number;
}) {
  const [faqOpen, setFaqOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const hasPhoto = !!content.imageUrl;

  return (
    <RvRoot theme={theme} className="min-h-screen py-12 md:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <header className="text-center mb-10">
          <h1
            className="tracking-widest uppercase leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: `clamp(1.6rem, 6vw, ${Math.min(titleSize ?? 52, 52)}px)`,
            }}
          >
            {content.title}
          </h1>
          <div className="w-16 h-px mx-auto mt-5" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* ── Top: photo + intro ── */}
        <div className={`grid gap-8 md:gap-12 items-start ${hasPhoto ? "md:grid-cols-2" : "max-w-2xl mx-auto"}`}>
          {hasPhoto && (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="block w-full overflow-hidden group"
              aria-label={`Enlarge photo${content.imageAlt ? `: ${content.imageAlt}` : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.imageUrl}
                alt={content.imageAlt || ""}
                className="w-full h-auto object-cover aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </button>
          )}
          <div className={hasPhoto ? "" : "text-center"}>
            <p className="text-[15px] md:text-base leading-relaxed whitespace-pre-line opacity-90">{content.intro}</p>
            {content.faq.length > 0 && (
              <button type="button" className="rv-btn rv-btn-ghost mt-6" onClick={() => setFaqOpen(true)}>
                Frequently asked questions
              </button>
            )}
          </div>
        </div>

        <div className="h-px my-12" style={{ background: `${theme.muted}50` }} />

        {/* ── Booking ── */}
        {config && config.party.min != null && config.party.max != null ? (
          <BookingFlow party={{ min: config.party.min, max: config.party.max }} policies={config.policies} rules={config.rules} phone={phone} />
        ) : (
          <div className="max-w-xl mx-auto text-center" role="status">
            <p className="text-lg">{unavailable || "Online reservations aren't open right now."}</p>
            <p className="mt-3 text-sm opacity-80">
              Call us at{" "}
              <a className="rv-link" href={telHref(phone)}>
                {phone}
              </a>
              .
            </p>
          </div>
        )}
      </div>

      <FaqModal open={faqOpen} onClose={() => setFaqOpen(false)} faq={content.faq} />

      {photoOpen && hasPhoto && <PhotoOverlay src={content.imageUrl!} alt={content.imageAlt || ""} onClose={() => setPhotoOpen(false)} />}
    </RvRoot>
  );
}

/** Tap-to-enlarge photo (same pattern as the menu's enlarged tile). */
function PhotoOverlay({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={onClose} />
      <div className="relative max-w-5xl w-full flex justify-center pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[85vh] w-auto max-w-full object-contain shadow-2xl pointer-events-auto" onClick={onClose} />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="pointer-events-auto absolute -top-3 -right-1 md:-right-3 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
