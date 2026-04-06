"use client";

import { useEffect, useCallback, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { CarouselItem } from "@/types";
import Image from "next/image";
import { X } from "lucide-react";

interface Props {
  items: CarouselItem[];
}

export default function HomeCarousel({ items }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);
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

  const active = items.filter((i) => i.active);
  if (!active.length) return null;

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Carousel */}
      <div className="embla" ref={emblaRef}>
        <div className="embla__container">
          {active.map((item) => (
            <div key={item.id} className="embla__slide px-4">
              <SlideContent item={item} onExpand={setExpandedImage} />
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      {active.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {active.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === selectedIndex ? "bg-[#C97D5A] w-4" : "bg-current opacity-30"
              }`}
            />
          ))}
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

function SlideContent({
  item,
  onExpand,
}: {
  item: CarouselItem;
  onExpand: (url: string) => void;
}) {
  if (item.type === "text") {
    return (
      <div className="py-10 px-6 text-center">
        <p
          className="text-2xl md:text-4xl leading-relaxed"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {item.text}
        </p>
      </div>
    );
  }

  if (item.type === "image") {
    return (
      <div className="flex justify-center py-6">
        <div
          className={`relative ${item.expandedImageUrl ? "cursor-pointer" : ""}`}
          onClick={() => item.expandedImageUrl && onExpand(item.expandedImageUrl)}
        >
          <Image
            src={item.imageUrl}
            alt={item.altText ?? "Promotion"}
            width={500}
            height={350}
            className="object-contain max-h-64 md:max-h-96 w-auto rounded-sm"
          />
          {item.expandedImageUrl && (
            <p className="text-center text-xs mt-2 opacity-60 tracking-widest uppercase">
              Tap to expand
            </p>
          )}
        </div>
      </div>
    );
  }

  if (item.type === "form") {
    return <CarouselForm item={item} />;
  }

  return null;
}

function CarouselForm({ item }: { item: Extract<CarouselItem, { type: "form" }> }) {
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
    <div className="py-6 px-4 max-w-md mx-auto">
      {item.title && (
        <h3 className="text-xl tracking-wider mb-2" style={{ fontFamily: "var(--font-display)" }}>
          {item.title}
        </h3>
      )}
      {item.description && (
        <p className="text-sm opacity-70 mb-4 leading-relaxed">{item.description}</p>
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
