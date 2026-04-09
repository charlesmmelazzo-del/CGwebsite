"use client";

import { useEffect, useCallback, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { CarouselItem, CarouselInstagramItem, CarouselTextItem, CarouselImageItem, CarouselFormItem } from "@/types";
import Image from "next/image";
import { X } from "lucide-react";

interface Props {
  items: CarouselItem[];
  autoAdvance?: boolean;
  autoAdvanceInterval?: number; // seconds
}

export default function HomeCarousel({ items, autoAdvance = true, autoAdvanceInterval = 6 }: Props) {
  const plugins = autoAdvance
    ? [Autoplay({ delay: autoAdvanceInterval * 1000, stopOnInteraction: true })]
    : [];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: items.length >= 3 }, plugins);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (!items.length) return null;

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Carousel */}
      <div className="embla home-carousel-viewport" ref={emblaRef}>
        <div className="embla__container">
          {items.map((item) => (
            <div key={item.id} className="embla__slide px-4">
              <SlideContent item={item} onExpand={setExpandedImage} />
            </div>
          ))}
        </div>
      </div>

      {/* Scrollbar */}
      {items.length > 1 && (
        <div className="px-6 mt-5">
          <input
            type="range"
            min={0}
            max={items.length - 1}
            value={selectedIndex}
            onChange={(e) => emblaApi?.scrollTo(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: "#C97D5A" }}
            aria-label="Navigate carousel"
          />
        </div>
      )}

      {/* Expanded image overlay */}
      {expandedImage && (
        <div
          className="iframe-modal-overlay"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
            <Image
              src={expandedImage}
              alt="Expanded view"
              width={800}
              height={600}
              className="w-full rounded-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Link button shared by image + instagram slides ───────────────────────────
function SlideLink({ label, url, newTab }: { label: string; url: string; newTab?: boolean }) {
  if (!label || !url) return null;
  return (
    <div className="flex justify-center mt-4">
      <a
        href={url}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener noreferrer" : undefined}
        className="inline-block px-6 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors rounded-sm"
      >
        {label}
      </a>
    </div>
  );
}

function SlideContent({
  item,
  onExpand,
}: {
  item: CarouselItem;
  onExpand: (url: string) => void;
}) {
  if (item.type === "text") {
    const t = item as CarouselTextItem;
    const align = t.alignment ?? "center";
    return (
      <div className="py-10 px-6" style={{ textAlign: align }}>
        <p
          style={{
            fontFamily: t.fontFamily ?? "var(--font-display)",
            fontSize:   t.fontSize ? `${t.fontSize}px` : undefined,
            color:      t.textColor ?? undefined,
            letterSpacing: t.letterSpacing ?? undefined,
          }}
          className={`leading-relaxed ${!t.fontSize ? "text-2xl md:text-4xl" : ""}`}
        >
          {t.text}
        </p>
      </div>
    );
  }

  if (item.type === "image") {
    const img = item as CarouselImageItem;
    return (
      <div className="flex flex-col items-center py-6">
        <div
          className={`relative ${img.expandedImageUrl ? "cursor-pointer" : ""}`}
          onClick={() => img.expandedImageUrl && onExpand(img.expandedImageUrl)}
        >
          <Image
            src={img.imageUrl}
            alt={img.altText ?? "Promotion"}
            width={500}
            height={350}
            className="object-contain max-h-[calc(100dvh-280px)] md:max-h-96 w-auto rounded-sm"
          />
          {img.expandedImageUrl && (
            <p className="text-center text-xs mt-2 opacity-60 tracking-widest uppercase">
              Tap to expand
            </p>
          )}
        </div>
        <SlideLink label={img.linkLabel ?? ""} url={img.linkUrl ?? ""} newTab={img.linkNewTab} />
      </div>
    );
  }

  if (item.type === "form") {
    return <CarouselForm item={item as CarouselFormItem} />;
  }

  if (item.type === "instagram") {
    return <InstagramSlide item={item as CarouselInstagramItem} />;
  }

  return null;
}

// ─── Inline Instagram SVG glyph ───────────────────────────────────────────────
function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InstagramSlide({ item }: { item: CarouselInstagramItem }) {
  const caption = item.captionOverride || item.cachedCaption || "";
  const truncated = caption.length > 200 ? caption.slice(0, 197) + "…" : caption;

  if (!item.cachedImageUrl) {
    return (
      <div className="flex flex-col items-center">
        <a
          href={item.instagramUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-10 px-6 text-center opacity-50"
          onClick={!item.instagramUrl ? (e) => e.preventDefault() : undefined}
        >
          <InstagramIcon size={32} />
          <p className="text-xs mt-3 tracking-wider opacity-60">Instagram post loading…</p>
        </a>
        <SlideLink label={item.linkLabel ?? ""} url={item.linkUrl ?? ""} newTab={item.linkNewTab} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <a
        href={item.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative group w-full"
        aria-label="View on Instagram"
      >
        <div className="relative flex justify-center py-2">
          <Image
            src={item.cachedImageUrl}
            alt="Instagram post"
            width={480}
            height={480}
            unoptimized
            className="object-cover max-h-80 w-auto rounded-sm"
          />
          {truncated && (
            <div
              className="absolute inset-x-0 bottom-0 h-24 rounded-b-sm"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)" }}
            />
          )}
          <div className="absolute top-4 right-4 text-white/80 group-hover:text-white transition-colors">
            <InstagramIcon size={18} />
          </div>
          {truncated && (
            <p
              className="absolute bottom-4 inset-x-4 text-xs leading-relaxed line-clamp-3"
              style={{ color: item.textColor ?? "white" }}
            >
              {truncated}
            </p>
          )}
        </div>
      </a>
      <SlideLink label={item.linkLabel ?? ""} url={item.linkUrl ?? ""} newTab={item.linkNewTab} />
    </div>
  );
}

function CarouselForm({ item }: { item: CarouselFormItem }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: item.formId, formName: item.title, data: values }),
      });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-10 text-center">
        <p className="text-lg tracking-wider">Thank you!</p>
        <p className="text-sm mt-2 opacity-60">We received your submission.</p>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 max-w-md mx-auto overflow-y-auto max-h-[calc(100dvh-220px)] md:max-h-none">
      {item.headerImageUrl ? (
        <div className="mb-4 flex justify-center">
          <Image
            src={item.headerImageUrl}
            alt=""
            width={480}
            height={240}
            className="w-full max-h-48 object-cover rounded-sm"
          />
        </div>
      ) : (
        <>
          {item.title && (
            <h3
              className="mb-2 leading-tight"
              style={{
                fontFamily:  item.titleFontFamily ?? "var(--font-display)",
                fontSize:    item.titleFontSize ? `${item.titleFontSize}px` : "1.25rem",
                color:       item.titleColor ?? undefined,
                textAlign:   item.titleAlignment ?? "center",
              }}
            >
              {item.title}
            </h3>
          )}
          {item.description && (
            <p
              className="mb-4 leading-relaxed opacity-70"
              style={{
                fontSize:  item.descriptionFontSize ? `${item.descriptionFontSize}px` : "0.875rem",
                color:     item.descriptionColor ?? undefined,
                textAlign: item.titleAlignment ?? "center",
              }}
            >
              {item.description}
            </p>
          )}
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {item.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-xs tracking-wider mb-1 opacity-70 uppercase">
              {field.label}{field.required && " *"}
            </label>
            {field.type === "textarea" ? (
              <textarea
                required={field.required}
                rows={3}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                className="w-full bg-transparent border-b border-current/30 focus:border-current/70 outline-none py-1 text-sm resize-none transition-colors"
              />
            ) : (
              <input
                type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                required={field.required}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                className="w-full bg-transparent border-b border-current/30 focus:border-current/70 outline-none py-1 text-sm transition-colors"
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full py-2.5 bg-[#C97D5A] text-white text-sm tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-50"
        >
          {loading ? "Sending..." : item.submitLabel || "Submit"}
        </button>
      </form>
    </div>
  );
}
