"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Trash2, GripVertical, Save, Eye, EyeOff,
  Monitor, Smartphone, Type as TypeIcon, Image as ImageIcon, Zap,
  Calendar, Minus, SlidersHorizontal, ChevronLeft, FilePlus,
  AlignLeft, AlignCenter, AlignRight, ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import type {
  PageDocument, PageSection, TextSection, ImageSection,
  CtaSection, EventsSection, SpacerSection, CarouselSection, CarouselImageItem,
} from "@/types";
import { THEMES, type ThemeName } from "@/lib/themes";
import ColorPicker from "@/components/ui/ColorPicker";
import SliderInput from "@/components/ui/SliderInput";
import ImagePicker from "@/components/ui/ImagePicker";

// ─── Image cleanup helpers ─────────────────────────────────────────────────────
function isStorageImageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/images/");
}
function storagePathFromUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}
function extractStorageImagePaths(section: PageSection): string[] {
  const urls: string[] = [];
  if (section.type === "image") {
    const url = (section as ImageSection).imageUrl;
    if (url) urls.push(url);
  } else if (section.type === "carousel") {
    const slides = (section as CarouselSection).slides ?? [];
    slides.forEach((slide) => {
      if (slide.type === "image") {
        const s = slide as CarouselImageItem;
        if (s.imageUrl) urls.push(s.imageUrl);
        if (s.expandedImageUrl) urls.push(s.expandedImageUrl);
      }
    });
  }
  return urls.filter(isStorageImageUrl).map(storagePathFromUrl).filter(Boolean) as string[];
}
function deleteStorageImages(paths: string[]) {
  // Fire-and-forget — don't block section removal if cleanup fails
  paths.forEach((path) => {
    fetch("/api/admin/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }).catch(() => {});
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SECTION_TYPES = [
  { type: "text"     as const, label: "Text Block",  icon: TypeIcon },
  { type: "image"    as const, label: "Image",        icon: ImageIcon },
  { type: "cta"      as const, label: "CTA Banner",   icon: Zap },
  { type: "events"   as const, label: "Events List",  icon: Calendar },
  { type: "carousel" as const, label: "Carousel",     icon: SlidersHorizontal },
  { type: "spacer"   as const, label: "Spacer",       icon: Minus },
];

const THEME_OPTIONS: { value: ThemeName; label: string; bg: string }[] = [
  { value: "olive",      label: "Dark Olive",    bg: "#1A1F17" },
  { value: "green",      label: "Forest Green",  bg: "#3B5040" },
  { value: "amber",      label: "Golden Amber",  bg: "#866515" },
  { value: "terracotta", label: "Terracotta",    bg: "#9D5242" },
  { value: "plum",       label: "Deep Plum",     bg: "#4E3456" },
  { value: "teal",       label: "Dark Teal",     bg: "#2F4A4E" },
  { value: "blue",       label: "Steel Blue",    bg: "#364260" },
];

const MOCK_EVENTS = [
  { date: "2026-04-12", title: "Spring Cocktail Night",   time: "7pm" },
  { date: "2026-04-19", title: "Mixology Workshop",        time: "6pm" },
  { date: "2026-04-26", title: "Live Music + Cocktails",   time: "8pm" },
  { date: "2026-05-03", title: "Seasonal Menu Launch",     time: "7pm" },
  { date: "2026-05-10", title: "Members Night",            time: "7pm" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function newId() { return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function createSection(type: PageSection["type"], order: number): PageSection {
  const base = { id: newId(), order, visible: true };
  switch (type) {
    case "text":     return { ...base, type: "text",     title: "New Section", body: "",          alignment: "left" };
    case "image":    return { ...base, type: "image",    imageUrl: "",         layout: "full",     aspectRatio: "16:9" };
    case "cta":      return { ...base, type: "cta",      heading: "Headline",  buttonLabel: "Learn More", buttonUrl: "#" };
    case "events":   return { ...base, type: "events",   title: "Upcoming Events", maxItems: 5,   showPastEvents: false };
    case "carousel": return { ...base, type: "carousel", slides: [],           autoplay: false };
    case "spacer":   return { ...base, type: "spacer",   height: 48 };
  }
}

function sectionLabel(s: PageSection): string {
  switch (s.type) {
    case "text":     return (s as TextSection).title  || "Text Section";
    case "image":    return "Image";
    case "cta":      return (s as CtaSection).heading || "CTA Banner";
    case "events":   return (s as EventsSection).title || "Events";
    case "carousel": return "Carousel";
    case "spacer":   return `Spacer (${(s as SpacerSection).height}px)`;
  }
}

function sectionIcon(type: PageSection["type"]) {
  return SECTION_TYPES.find((t) => t.type === type)?.icon ?? TypeIcon;
}

// ─── Shared editor styles ─────────────────────────────────────────────────────
const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
const textareaCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm resize-none";

function LabelRow({ label, picker }: { label: string; picker?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-1">
      <span className={labelCls}>{label}</span>
      {picker}
    </div>
  );
}

// ─── Divider used between Content and Size sections ──────────────────────────
function EditorDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <hr className="flex-1 border-gray-100" />
      <span className="text-[9px] tracking-[0.2em] uppercase text-gray-300">{label}</span>
      <hr className="flex-1 border-gray-100" />
    </div>
  );
}

// ─── Section Editors ──────────────────────────────────────────────────────────
function TextSectionEditor({ section, onChange }: { section: TextSection; onChange: (u: Partial<TextSection>) => void }) {
  return (
    <div className="space-y-4 p-4">
      {/* Content */}
      <div>
        <LabelRow label="Title" picker={<ColorPicker label="Title color" value={section.titleColor} onChange={(h) => onChange({ titleColor: h })} />} />
        <input className={inputCls} value={section.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <LabelRow label="Body" picker={<ColorPicker label="Body color" value={section.bodyColor} onChange={(h) => onChange({ bodyColor: h })} />} />
        <textarea className={textareaCls} rows={4} value={section.body ?? ""} onChange={(e) => onChange({ body: e.target.value })} />
      </div>
      <div>
        <span className={labelCls}>Alignment</span>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            return (
              <button key={a} onClick={() => onChange({ alignment: a })} className={clsx("p-2 border rounded-sm transition-colors", section.alignment === a ? "border-[#C97D5A] text-[#C97D5A] bg-[#C97D5A]/10" : "border-gray-200 text-gray-400 hover:border-gray-400")}>
                <Icon size={14} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <LabelRow label="Button Label" picker={<ColorPicker label="Btn color" value={section.buttonColor} onChange={(h) => onChange({ buttonColor: h })} size="sm" />} />
          <input className={inputCls} value={section.buttonLabel ?? ""} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
        </div>
        <div>
          <span className={labelCls}>Button URL</span>
          <input className={inputCls} value={section.buttonUrl ?? ""} onChange={(e) => onChange({ buttonUrl: e.target.value })} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={section.buttonNewTab ?? false} onChange={(e) => onChange({ buttonNewTab: e.target.checked })} className="accent-[#C97D5A]" />
        Open button in new tab
      </label>

      {/* Sizes */}
      <EditorDivider label="Size & Spacing" />
      <SliderInput label="Title Size"           value={section.titleSize  ?? 32} min={14} max={72}  onChange={(v) => onChange({ titleSize: v })} />
      <SliderInput label="Body Size"            value={section.bodySize   ?? 16} min={12} max={28}  onChange={(v) => onChange({ bodySize: v })} />
      <SliderInput label="Button Size"          value={section.buttonSize ?? 11} min={9}  max={20}  onChange={(v) => onChange({ buttonSize: v })} />
      <SliderInput label="Vertical Padding"     value={section.paddingY   ?? 48} min={0}  max={128} step={4} onChange={(v) => onChange({ paddingY: v })} />
      <SliderInput label="Horizontal Padding"   value={section.paddingX   ?? 64} min={0}  max={128} step={4} onChange={(v) => onChange({ paddingX: v })} />
    </div>
  );
}

function ImageSectionEditor({ section, onChange }: { section: ImageSection; onChange: (u: Partial<ImageSection>) => void }) {
  return (
    <div className="space-y-4 p-4">
      {/* Content */}
      <ImagePicker
        label="Image"
        value={section.imageUrl}
        onChange={(url) => onChange({ imageUrl: url })}
      />
      <div>
        <span className={labelCls}>Layout</span>
        <select className={inputCls} value={section.layout ?? "full"} onChange={(e) => onChange({ layout: e.target.value as ImageSection["layout"] })}>
          <option value="full">Full Width</option>
          <option value="contained">Contained (max-width)</option>
          <option value="left">Float Left</option>
          <option value="right">Float Right</option>
        </select>
      </div>
      <div>
        <span className={labelCls}>Aspect Ratio</span>
        <select className={inputCls} value={section.aspectRatio ?? "16:9"} onChange={(e) => onChange({ aspectRatio: e.target.value as ImageSection["aspectRatio"] })}>
          <option value="16:9">16:9 (Widescreen)</option>
          <option value="4:3">4:3 (Standard)</option>
          <option value="3:2">3:2 (Photo)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
      </div>
      <div>
        <span className={labelCls}>Alt Text</span>
        <input className={inputCls} value={section.altText ?? ""} onChange={(e) => onChange({ altText: e.target.value })} />
      </div>
      <div>
        <span className={labelCls}>Caption</span>
        <input className={inputCls} value={section.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
      </div>

      {/* Sizes */}
      <EditorDivider label="Size & Spacing" />
      <SliderInput label="Max Width"            value={section.maxWidth    ?? 100} min={20}  max={100} unit="%"  onChange={(v) => onChange({ maxWidth: v })} />
      <SliderInput label="Caption Size"         value={section.captionSize ?? 12}  min={10}  max={20}           onChange={(v) => onChange({ captionSize: v })} />
    </div>
  );
}

function CtaSectionEditor({ section, onChange }: { section: CtaSection; onChange: (u: Partial<CtaSection>) => void }) {
  return (
    <div className="space-y-4 p-4">
      {/* Content */}
      <div>
        <LabelRow label="Heading" picker={<ColorPicker label="Text color" value={section.textColor} onChange={(h) => onChange({ textColor: h })} />} />
        <input className={inputCls} value={section.heading} onChange={(e) => onChange({ heading: e.target.value })} />
      </div>
      <div>
        <span className={labelCls}>Subheading</span>
        <textarea className={textareaCls} rows={3} value={section.subheading ?? ""} onChange={(e) => onChange({ subheading: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <LabelRow label="Button Label" picker={<ColorPicker label="Btn color" value={section.buttonColor} onChange={(h) => onChange({ buttonColor: h })} size="sm" />} />
          <input className={inputCls} value={section.buttonLabel} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
        </div>
        <div>
          <span className={labelCls}>Button URL</span>
          <input className={inputCls} value={section.buttonUrl} onChange={(e) => onChange({ buttonUrl: e.target.value })} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={section.buttonNewTab ?? false} onChange={(e) => onChange({ buttonNewTab: e.target.checked })} className="accent-[#C97D5A]" />
        Open in new tab
      </label>
      <div>
        <LabelRow label="Background Color (optional)" picker={<ColorPicker label="BG color" value={section.bgColor} onChange={(h) => onChange({ bgColor: h })} />} />
        <p className="text-xs text-gray-400">Leave blank to use page theme color</p>
      </div>

      {/* Sizes */}
      <EditorDivider label="Size & Spacing" />
      <SliderInput label="Heading Size"         value={section.headingSize    ?? 40} min={18} max={80}  onChange={(v) => onChange({ headingSize: v })} />
      <SliderInput label="Subheading Size"      value={section.subheadingSize ?? 16} min={12} max={28}  onChange={(v) => onChange({ subheadingSize: v })} />
      <SliderInput label="Button Size"          value={section.buttonSize     ?? 11} min={9}  max={20}  onChange={(v) => onChange({ buttonSize: v })} />
      <SliderInput label="Vertical Padding"     value={section.paddingY       ?? 64} min={0}  max={128} step={4} onChange={(v) => onChange({ paddingY: v })} />
      <SliderInput label="Horizontal Padding"   value={section.paddingX       ?? 64} min={0}  max={128} step={4} onChange={(v) => onChange({ paddingX: v })} />
    </div>
  );
}

function EventsSectionEditor({ section, onChange }: { section: EventsSection; onChange: (u: Partial<EventsSection>) => void }) {
  return (
    <div className="space-y-4 p-4">
      {/* Content */}
      <div>
        <span className={labelCls}>Section Title</span>
        <input className={inputCls} value={section.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <span className={labelCls}>Max Events to Show</span>
        <input type="number" min={1} max={20} className={inputCls} value={section.maxItems ?? 5} onChange={(e) => onChange({ maxItems: Number(e.target.value) })} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={section.showPastEvents ?? false} onChange={(e) => onChange({ showPastEvents: e.target.checked })} className="accent-[#C97D5A]" />
        Include past events
      </label>

      {/* Sizes */}
      <EditorDivider label="Size & Spacing" />
      <SliderInput label="Title Size"           value={section.titleSize ?? 32} min={14} max={64}  onChange={(v) => onChange({ titleSize: v })} />
      <SliderInput label="Event Item Size"      value={section.itemSize  ?? 15} min={11} max={22}  onChange={(v) => onChange({ itemSize: v })} />
      <SliderInput label="Vertical Padding"     value={section.paddingY  ?? 48} min={0}  max={128} step={4} onChange={(v) => onChange({ paddingY: v })} />
      <SliderInput label="Horizontal Padding"   value={section.paddingX  ?? 64} min={0}  max={128} step={4} onChange={(v) => onChange({ paddingX: v })} />
    </div>
  );
}

function SpacerSectionEditor({ section, onChange }: { section: SpacerSection; onChange: (u: Partial<SpacerSection>) => void }) {
  return (
    <div className="space-y-4 p-4">
      <SliderInput label="Height" value={section.height} min={8} max={240} step={8} onChange={(v) => onChange({ height: v })} />
    </div>
  );
}

function SectionEditor({ section, onChange }: {
  section: PageSection;
  onChange: (updates: Partial<PageSection>) => void;
}) {
  switch (section.type) {
    case "text":     return <TextSectionEditor     section={section as TextSection}   onChange={onChange as (u: Partial<TextSection>) => void} />;
    case "image":    return <ImageSectionEditor    section={section as ImageSection}  onChange={onChange as (u: Partial<ImageSection>) => void} />;
    case "cta":      return <CtaSectionEditor      section={section as CtaSection}    onChange={onChange as (u: Partial<CtaSection>) => void} />;
    case "events":   return <EventsSectionEditor   section={section as EventsSection} onChange={onChange as (u: Partial<EventsSection>) => void} />;
    case "spacer":   return <SpacerSectionEditor   section={section as SpacerSection} onChange={onChange as (u: Partial<SpacerSection>) => void} />;
    case "carousel": return (
      <div className="p-4 text-xs text-gray-400 italic">
        Carousel section — slides editor coming soon.
      </div>
    );
  }
}

// ─── Section Preview Components ───────────────────────────────────────────────
function aspectToCss(ar?: string): string {
  switch (ar) {
    case "4:3":  return "4/3";
    case "1:1":  return "1/1";
    case "3:2":  return "3/2";
    default:     return "16/9";
  }
}

function TextSectionPreview({ section, theme }: { section: TextSection; theme: (typeof THEMES)[ThemeName] }) {
  const align      = section.alignment ?? "left";
  const py         = section.paddingY  ?? 48;
  const px         = section.paddingX  ?? 64;
  const titleSize  = section.titleSize  ?? 32;
  const bodySize   = section.bodySize   ?? 16;
  const buttonSize = section.buttonSize ?? 11;
  return (
    <div style={{ padding: `${py}px ${px}px`, textAlign: align }}>
      {section.title && (
        <h2 style={{ color: section.titleColor ?? theme.text, fontFamily: "var(--font-display)", fontSize: titleSize + "px", lineHeight: 1.2, marginBottom: "20px" }}>
          {section.title}
        </h2>
      )}
      {section.body && (
        <p style={{ color: section.bodyColor ?? theme.muted, fontFamily: "var(--font-body)", fontSize: bodySize + "px", lineHeight: 1.8, maxWidth: "680px", margin: align === "center" ? "0 auto" : undefined }}>
          {section.body}
        </p>
      )}
      {section.buttonLabel && (
        <a style={{ display: "inline-block", marginTop: "28px", padding: "12px 36px", border: `1px solid ${section.buttonColor ?? "#C97D5A"}`, color: section.buttonColor ?? "#C97D5A", fontFamily: "var(--font-button)", fontSize: buttonSize + "px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {section.buttonLabel}
        </a>
      )}
    </div>
  );
}

function ImageSectionPreview({ section }: { section: ImageSection }) {
  const mw          = section.maxWidth    ?? 100;
  const captionSize = section.captionSize ?? 12;
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ width: mw + "%", maxWidth: "100%" }}>
        {section.imageUrl ? (
          <img src={section.imageUrl} alt={section.altText ?? ""} style={{ width: "100%", aspectRatio: aspectToCss(section.aspectRatio), objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", aspectRatio: aspectToCss(section.aspectRatio), background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px" }}>
            <ImageIcon size={40} style={{ color: "rgba(255,255,255,0.2)" }} />
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase" }}>Add an image URL</span>
          </div>
        )}
        {section.caption && (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: captionSize + "px", padding: "8px 16px", fontFamily: "var(--font-label)" }}>
            {section.caption}
          </p>
        )}
      </div>
    </div>
  );
}

function CtaSectionPreview({ section, theme }: { section: CtaSection; theme: (typeof THEMES)[ThemeName] }) {
  const py             = section.paddingY       ?? 64;
  const px             = section.paddingX       ?? 64;
  const headingSize    = section.headingSize    ?? 40;
  const subheadingSize = section.subheadingSize ?? 16;
  const buttonSize     = section.buttonSize     ?? 11;
  return (
    <div style={{ padding: `${py}px ${px}px`, textAlign: "center", background: section.bgColor ? section.bgColor + "33" : "rgba(255,255,255,0.06)" }}>
      <h2 style={{ color: section.textColor ?? theme.text, fontFamily: "var(--font-display)", fontSize: headingSize + "px", lineHeight: 1.2, marginBottom: "16px" }}>
        {section.heading}
      </h2>
      {section.subheading && (
        <p style={{ color: section.textColor ? section.textColor + "cc" : theme.muted, fontFamily: "var(--font-body)", fontSize: subheadingSize + "px", lineHeight: 1.7, maxWidth: "600px", margin: "0 auto 32px" }}>
          {section.subheading}
        </p>
      )}
      <a style={{ display: "inline-block", padding: "14px 40px", border: `1px solid ${section.buttonColor ?? "#C97D5A"}`, color: section.buttonColor ?? "#C97D5A", fontFamily: "var(--font-button)", fontSize: buttonSize + "px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        {section.buttonLabel}
        {section.buttonNewTab && <ExternalLink size={10} style={{ display: "inline-block", marginLeft: "6px", verticalAlign: "middle" }} />}
      </a>
    </div>
  );
}

function EventsSectionPreview({ section, theme }: { section: EventsSection; theme: (typeof THEMES)[ThemeName] }) {
  const max       = section.maxItems  ?? 5;
  const py        = section.paddingY  ?? 48;
  const px        = section.paddingX  ?? 64;
  const titleSize = section.titleSize ?? 32;
  const itemSize  = section.itemSize  ?? 15;
  const events = MOCK_EVENTS.slice(0, max);
  const grouped: Record<string, typeof MOCK_EVENTS> = {};
  events.forEach((e) => {
    const mo = new Date(e.date).toLocaleString("en-US", { month: "long", year: "numeric" });
    if (!grouped[mo]) grouped[mo] = [];
    grouped[mo].push(e);
  });
  return (
    <div style={{ padding: `${py}px ${px}px` }}>
      {section.title && (
        <h2 style={{ color: theme.text, fontFamily: "var(--font-display)", fontSize: titleSize + "px", marginBottom: "32px" }}>
          {section.title}
        </h2>
      )}
      {Object.entries(grouped).map(([month, evs]) => (
        <div key={month} style={{ marginBottom: "28px" }}>
          <p style={{ color: theme.muted, fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-label)", marginBottom: "12px" }}>
            {month}
          </p>
          {evs.map((ev) => (
            <div key={ev.title} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${theme.muted}30` }}>
              <div>
                <p style={{ color: theme.text, fontFamily: "var(--font-body)", fontSize: itemSize + "px" }}>{ev.title}</p>
                <p style={{ color: theme.muted, fontSize: Math.max(10, itemSize - 3) + "px", marginTop: "2px" }}>
                  {new Date(ev.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
              <span style={{ color: theme.muted, fontSize: Math.max(10, itemSize - 2) + "px", letterSpacing: "0.05em" }}>{ev.time}</span>
            </div>
          ))}
        </div>
      ))}
      {events.length === 0 && (
        <p style={{ color: theme.muted, fontStyle: "italic" }}>No upcoming events.</p>
      )}
    </div>
  );
}

function SpacerSectionPreview({ section }: { section: SpacerSection }) {
  return <div style={{ height: section.height + "px" }} />;
}

function CarouselSectionPreview({ theme }: { theme: (typeof THEMES)[ThemeName] }) {
  return (
    <div style={{ padding: "48px 64px", textAlign: "center" }}>
      <div style={{ border: `1px dashed ${theme.muted}60`, padding: "40px", borderRadius: "4px" }}>
        <SlidersHorizontal size={28} style={{ color: theme.muted, margin: "0 auto 12px" }} />
        <p style={{ color: theme.muted, fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase" }}>Carousel</p>
      </div>
    </div>
  );
}

function SectionPreview({ section, theme }: { section: PageSection; theme: (typeof THEMES)[ThemeName] }) {
  switch (section.type) {
    case "text":     return <TextSectionPreview     section={section as TextSection}   theme={theme} />;
    case "image":    return <ImageSectionPreview    section={section as ImageSection} />;
    case "cta":      return <CtaSectionPreview      section={section as CtaSection}    theme={theme} />;
    case "events":   return <EventsSectionPreview   section={section as EventsSection} theme={theme} />;
    case "spacer":   return <SpacerSectionPreview   section={section as SpacerSection} />;
    case "carousel": return <CarouselSectionPreview theme={theme} />;
    default:         return null;
  }
}

// ─── Live Page Preview Panel ──────────────────────────────────────────────────
function PagePreviewPanel({ page, viewport }: { page: PageDocument; viewport: "desktop" | "mobile" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef   = useRef<HTMLDivElement>(null);
  const [scale, setScale]       = useState(1);
  const [containerH, setContainerH] = useState(500);
  const vpWidth = viewport === "desktop" ? 1280 : 375;
  const theme = THEMES[page.theme ?? "olive"];

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;
    const recalc = () => {
      const w = containerRef.current!.clientWidth;
      const s = w / vpWidth;
      const h = contentRef.current!.scrollHeight;
      setScale(s);
      setContainerH(Math.max(h * s, 120));
    };
    const ro = new ResizeObserver(recalc);
    ro.observe(containerRef.current);
    ro.observe(contentRef.current);
    recalc();
    return () => ro.disconnect();
  }, [vpWidth, page]);

  const sorted = [...page.sections].filter((s) => s.visible).sort((a, b) => a.order - b.order);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: containerH }}>
      <div
        ref={contentRef}
        style={{
          width: vpWidth,
          position: "absolute",
          top: 0,
          left: 0,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          background: theme.bg,
          minHeight: "100vh",
        }}
      >
        {/* Mini header bar for context */}
        <div style={{ height: 56, background: "#1A1F17", borderBottom: "1px solid #2a3020", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 44, height: 44, background: "rgba(138,154,120,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#8A9A78", fontSize: "10px", letterSpacing: "0.15em", fontFamily: "var(--font-display)" }}>CG</span>
          </div>
        </div>
        {/* Page sections */}
        {sorted.length > 0 ? (
          sorted.map((s) => <SectionPreview key={s.id} section={s} theme={theme} />)
        ) : (
          <div style={{ padding: "80px 64px", textAlign: "center" }}>
            <p style={{ color: theme.muted, fontSize: "13px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Add sections using the panel on the left
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Section Row ─────────────────────────────────────────────────────
function SortableSectionRow({
  section, isActive, onClick, onRemove, onToggleVisible,
}: {
  section: PageSection; isActive: boolean;
  onClick: () => void; onRemove: () => void; onToggleVisible: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const Icon = sectionIcon(section.type);

  return (
    <div
      ref={setNodeRef} style={style}
      className={clsx("flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 cursor-pointer transition-colors", isActive ? "bg-[#C97D5A]/10" : "hover:bg-gray-50")}
      onClick={onClick}
    >
      <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="text-gray-300 hover:text-gray-500 cursor-grab touch-none shrink-0">
        <GripVertical size={13} />
      </button>
      <Icon size={13} className={clsx("shrink-0", isActive ? "text-[#C97D5A]" : "text-gray-400")} />
      <span className={clsx("flex-1 text-xs truncate", isActive ? "text-[#C97D5A]" : "text-gray-600")}>
        {sectionLabel(section)}
      </span>
      <button onClick={(e) => { e.stopPropagation(); onToggleVisible(); }} className={clsx("shrink-0 transition-colors", section.visible ? "text-gray-400 hover:text-gray-600" : "text-gray-300 hover:text-gray-500")}>
        {section.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── Add Section Picker ───────────────────────────────────────────────────────
function AddSectionPicker({ onAdd, onClose }: { onAdd: (type: PageSection["type"]) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 shadow-lg z-20 rounded-sm overflow-hidden">
      {SECTION_TYPES.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => { onAdd(type); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-600 hover:bg-[#C97D5A]/10 hover:text-[#C97D5A] transition-colors"
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── New Page Modal ───────────────────────────────────────────────────────────
function NewPageModal({ onCreate, onClose }: { onCreate: (page: PageDocument) => void; onClose: () => void }) {
  const [label, setLabel]   = useState("");
  const [slug, setSlug]     = useState("");
  const [theme, setTheme]   = useState<ThemeName>("olive");
  const [slugEdited, setSlugEdited] = useState(false);

  function handleLabelChange(val: string) {
    setLabel(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function handleCreate() {
    if (!label.trim() || !slug.trim()) return;
    const page: PageDocument = {
      pageId: slug,
      label: label.trim(),
      slug,
      theme,
      sections: [],
      updatedAt: new Date().toISOString(),
    };
    onCreate(page);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 shadow-xl w-full max-w-md p-6 rounded-sm">
        <h2 className="text-lg text-gray-800 mb-5" style={{ fontFamily: "var(--font-display)" }}>New Page</h2>
        <div className="space-y-4">
          <div>
            <span className={labelCls}>Page Name *</span>
            <input className={inputCls} value={label} onChange={(e) => handleLabelChange(e.target.value)} placeholder="e.g. About Us" autoFocus />
          </div>
          <div>
            <span className={labelCls}>URL Slug *</span>
            <div className="flex items-center gap-0">
              <span className="bg-gray-100 border border-r-0 border-gray-200 px-3 py-2 text-xs text-gray-400 rounded-l-sm">/</span>
              <input className={clsx(inputCls, "rounded-l-none")} value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }} placeholder="about" />
            </div>
          </div>
          <div>
            <span className={labelCls}>Theme</span>
            <div className="flex gap-2 flex-wrap">
              {THEME_OPTIONS.map((t) => (
                <button key={t.value} onClick={() => setTheme(t.value)} className={clsx("flex items-center gap-2 px-2.5 py-1.5 border text-xs rounded-sm transition-colors", theme === t.value ? "border-[#C97D5A] text-[#C97D5A]" : "border-gray-200 text-gray-500 hover:border-gray-400")}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.bg }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={handleCreate} disabled={!label.trim() || !slug.trim()} className="flex-1 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-50">
            Create Page
          </button>
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 text-gray-500 text-xs tracking-widest uppercase hover:border-gray-400 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPagesPage() {
  const [pages, setPages]                   = useState<PageDocument[]>([]);
  const [activePage, setActivePage]         = useState<PageDocument | null>(null);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [panelView, setPanelView]           = useState<"list" | "edit">("list");
  const [viewport, setViewport]             = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved]                   = useState(false);
  const [dirty, setDirty]                   = useState(false);
  const [loading, setLoading]               = useState(true);
  const [showAddPicker, setShowAddPicker]   = useState(false);
  const [showNewPage, setShowNewPage]       = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  // Load pages from API
  useEffect(() => {
    fetch("/api/admin/pages")
      .then((r) => r.json())
      .then((data) => {
        const pgs: PageDocument[] = data.pages ?? [];
        setPages(pgs);
        if (pgs.length > 0) setActivePage(pgs[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Sync activePage back into pages array
  function updateActivePage(updates: Partial<PageDocument>) {
    setActivePage((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      setPages((ps) => ps.map((p) => p.pageId === updated.pageId ? updated : p));
      setDirty(true);
      return updated;
    });
  }

  // Save to API
  async function handleSave() {
    if (!activePage) return;
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activePage),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? `Server error ${res.status}`);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("Save failed: " + String(e));
    }
  }

  // Section operations
  function updateSection(id: string, updates: Partial<PageSection>) {
    updateActivePage({
      sections: (activePage?.sections ?? []).map((s) =>
        s.id === id ? { ...s, ...updates } as PageSection : s
      ),
    });
  }

  function addSection(type: PageSection["type"]) {
    if (!activePage) return;
    const order = activePage.sections.length;
    const s = createSection(type, order);
    updateActivePage({ sections: [...activePage.sections, s] });
    setSelectedId(s.id);
    setPanelView("edit");
  }

  function removeSection(id: string) {
    // Auto-delete any Supabase Storage images owned by this section
    const section = activePage?.sections.find((s) => s.id === id);
    if (section) {
      const paths = extractStorageImagePaths(section);
      if (paths.length > 0) deleteStorageImages(paths);
    }
    updateActivePage({
      sections: (activePage?.sections ?? [])
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i })),
    });
    if (selectedId === id) {
      setSelectedId(null);
      setPanelView("list");
    }
  }

  function toggleSectionVisible(id: string) {
    updateSection(id, { visible: !(activePage?.sections.find((s) => s.id === id)?.visible ?? true) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !activePage) return;
    const sorted = [...activePage.sections].sort((a, b) => a.order - b.order);
    const oi = sorted.findIndex((s) => s.id === active.id);
    const ni = sorted.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sorted, oi, ni).map((s, i) => ({ ...s, order: i }));
    updateActivePage({ sections: reordered });
  }

  function handleNewPage(page: PageDocument) {
    setPages((prev) => [...prev, page]);
    setActivePage(page);
    setSelectedId(null);
    setPanelView("list");
    setShowNewPage(false);
    setDirty(true);
  }

  function selectSection(id: string) {
    setSelectedId(id);
    setPanelView("edit");
  }

  const sortedSections = activePage
    ? [...activePage.sections].sort((a, b) => a.order - b.order)
    : [];

  const selectedSection = selectedId
    ? activePage?.sections.find((s) => s.id === selectedId) ?? null
    : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading pages…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* ── Left Panel ── */}
      <div className="w-[340px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 shrink-0">
          <select
            value={activePage?.pageId ?? ""}
            onChange={(e) => {
              const p = pages.find((pg) => pg.pageId === e.target.value);
              if (p) { setActivePage(p); setSelectedId(null); setPanelView("list"); }
            }}
            className="flex-1 bg-transparent text-xs text-gray-700 outline-none cursor-pointer truncate"
          >
            {pages.map((p) => (
              <option key={p.pageId} value={p.pageId}>{p.label}</option>
            ))}
          </select>
          <button onClick={() => setShowNewPage(true)} className="text-gray-400 hover:text-[#C97D5A] transition-colors shrink-0" title="New page">
            <FilePlus size={14} />
          </button>
          <button
            onClick={handleSave}
            className={clsx("flex items-center gap-1.5 px-2.5 py-1 text-white text-[10px] tracking-widest uppercase transition-colors rounded-sm shrink-0", saved ? "bg-green-500" : "bg-[#C97D5A] hover:bg-[#b86d4a]")}
          >
            <Save size={11} />
            {saved ? "Saved!" : dirty ? "Save*" : "Save"}
          </button>
        </div>

        {/* Theme selector */}
        {activePage && (
          <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center gap-2">
            <span className="text-[10px] tracking-widest uppercase text-gray-400">Theme</span>
            <div className="flex gap-1.5 flex-wrap">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => updateActivePage({ theme: t.value })}
                  title={t.label}
                  className={clsx("w-4 h-4 rounded-full border-2 transition-all", activePage.theme === t.value ? "border-[#C97D5A] scale-110" : "border-transparent hover:border-gray-400")}
                  style={{ background: t.bg }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {!activePage ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-gray-400 text-sm">No pages yet.</p>
              <button onClick={() => setShowNewPage(true)} className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a]">
                <Plus size={13} /> Create First Page
              </button>
            </div>
          ) : panelView === "list" ? (
            /* ── Section list ── */
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {sortedSections.map((s) => (
                      <SortableSectionRow
                        key={s.id}
                        section={s}
                        isActive={s.id === selectedId}
                        onClick={() => selectSection(s.id)}
                        onRemove={() => removeSection(s.id)}
                        onToggleVisible={() => toggleSectionVisible(s.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {sortedSections.length === 0 && (
                  <p className="text-gray-400 text-xs text-center py-8">No sections yet — add one below.</p>
                )}
              </div>
              {/* Add section button */}
              <div className="relative p-3 border-t border-gray-100 shrink-0">
                <button
                  onClick={() => setShowAddPicker((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-200 text-gray-400 hover:text-[#C97D5A] hover:border-[#C97D5A]/40 transition-colors text-xs tracking-widest uppercase rounded-sm"
                >
                  <Plus size={13} /> Add Section
                </button>
                {showAddPicker && (
                  <AddSectionPicker onAdd={addSection} onClose={() => setShowAddPicker(false)} />
                )}
              </div>
            </div>
          ) : (
            /* ── Section editor ── */
            selectedSection ? (
              <div className="flex flex-col h-full">
                {/* Editor header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
                  <button onClick={() => setPanelView("list")} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <ChevronLeft size={15} />
                  </button>
                  {(() => { const Icon = sectionIcon(selectedSection.type); return <Icon size={13} className="text-gray-400 shrink-0" />; })()}
                  <span className="text-xs text-gray-600 flex-1 truncate">{sectionLabel(selectedSection)}</span>
                  <button onClick={() => toggleSectionVisible(selectedSection.id)} className={clsx("transition-colors shrink-0", selectedSection.visible ? "text-gray-400 hover:text-gray-600" : "text-gray-300")}>
                    {selectedSection.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button onClick={() => { removeSection(selectedSection.id); }} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
                {/* Editor body */}
                <div className="flex-1 overflow-y-auto">
                  <SectionEditor
                    section={selectedSection}
                    onChange={(updates) => updateSection(selectedSection.id, updates)}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-gray-400">No section selected.</div>
            )
          )}
        </div>
      </div>

      {/* ── Right Panel: Live Preview ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">
        {/* Viewport toggle */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
          <p className="text-[10px] tracking-widest uppercase text-gray-400">
            {activePage?.label ?? "Preview"} — {activePage?.slug ? `/${activePage.slug}` : ""}
          </p>
          <div className="flex gap-1">
            {(["desktop", "mobile"] as const).map((v) => {
              const Icon = v === "desktop" ? Monitor : Smartphone;
              return (
                <button
                  key={v}
                  onClick={() => setViewport(v)}
                  className={clsx("p-1.5 rounded transition-colors", viewport === v ? "bg-[#C97D5A]/15 text-[#C97D5A]" : "text-gray-400 hover:text-gray-600")}
                  title={v === "desktop" ? "Desktop (1280px)" : "Mobile (375px)"}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {activePage ? (
            <div className={clsx("mx-auto shadow-xl overflow-hidden", viewport === "mobile" ? "max-w-[375px]" : "w-full")}>
              <PagePreviewPanel page={activePage} viewport={viewport} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">Select or create a page to preview it.</p>
            </div>
          )}
        </div>
      </div>

      {/* New page modal */}
      {showNewPage && <NewPageModal onCreate={handleNewPage} onClose={() => setShowNewPage(false)} />}
    </div>
  );
}
