"use client";

import { useState, useEffect } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Save, GripVertical, Plus, Trash2, Eye, EyeOff, ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import type { SiteConfig, NavLink } from "@/types";
import ColorPicker from "@/components/ui/ColorPicker";
import SliderInput from "@/components/ui/SliderInput";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function newId() { return `nl-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const labelCls  = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls  = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";

const DEFAULT_CONFIG: SiteConfig = {
  header: {
    logoSize: 58, mobileLogoSize: 44,
    headerHeight: 72, mobileHeaderHeight: 52,
    bgColor: "#1A1F17", textColor: "#8A9A78", activeColor: "#C97D5A", borderColor: "#2a3020",
    navFontSize: 13, navLetterSpacing: "0.22em", navPaddingX: 20,
    navLinks: [
      { id: "nav-menu",   label: "Menu",   href: "/menu",   visible: true, order: 0 },
      { id: "nav-coffee", label: "Coffee", href: "/coffee", visible: true, order: 1 },
      { id: "nav-events", label: "Events", href: "/events", visible: true, order: 2 },
      { id: "nav-club",   label: "Club",   href: "/club",   visible: true, order: 3 },
      { id: "nav-shop",   label: "Shop",   href: "/shop",   visible: true, order: 4 },
      { id: "nav-about",  label: "About",  href: "/about",  visible: true, order: 5 },
    ],
  },
  footer: {
    bgColor: "#1A1F17", textColor: "#8A9A78", mutedColor: "#4a5a3a",
    showHours: true, showContact: true, showSocialLinks: true,
    copyrightText: "© 2025 Common Good Cocktail House",
  },
  updatedAt: new Date().toISOString(),
};

// ─── Sortable Nav Link Row ────────────────────────────────────────────────────
function SortableNavRow({
  link, onUpdate, onRemove,
}: {
  link: NavLink;
  onUpdate: (id: string, updates: Partial<NavLink>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2.5 border border-gray-200 bg-white mb-1.5 rounded-sm">
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab touch-none shrink-0">
        <GripVertical size={13} />
      </button>
      <input
        type="text"
        value={link.label}
        onChange={(e) => onUpdate(link.id, { label: e.target.value })}
        placeholder="Label"
        className="w-20 bg-gray-50 border border-gray-200 text-gray-700 text-xs px-2 py-1 outline-none focus:border-[#C97D5A]/50 rounded-sm shrink-0"
      />
      <input
        type="text"
        value={link.href}
        onChange={(e) => onUpdate(link.id, { href: e.target.value })}
        placeholder="/path"
        className="flex-1 bg-gray-50 border border-gray-200 text-gray-500 text-xs px-2 py-1 outline-none focus:border-[#C97D5A]/50 rounded-sm"
      />
      <button
        onClick={() => onUpdate(link.id, { openInNewTab: !link.openInNewTab })}
        title="Open in new tab"
        className={clsx("shrink-0 transition-colors", link.openInNewTab ? "text-[#C97D5A]" : "text-gray-300 hover:text-gray-500")}
      >
        <ExternalLink size={12} />
      </button>
      <button
        onClick={() => onUpdate(link.id, { visible: !link.visible })}
        className={clsx("shrink-0 transition-colors", link.visible ? "text-gray-400 hover:text-gray-700" : "text-gray-300")}
        title={link.visible ? "Visible" : "Hidden"}
      >
        {link.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button onClick={() => onRemove(link.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── Header Preview ───────────────────────────────────────────────────────────
function HeaderPreview({ config }: { config: SiteConfig["header"] }) {
  const links       = [...config.navLinks].sort((a, b) => a.order - b.order).filter((l) => l.visible);
  const half        = Math.ceil(links.length / 2);
  const left        = links.slice(0, half);
  const right       = links.slice(half);
  const h           = config.headerHeight       ?? 72;
  const mh          = config.mobileHeaderHeight ?? 52;
  const navPx       = config.navPaddingX        ?? 20;

  return (
    <div style={{ background: config.bgColor, borderBottom: `1px solid ${config.borderColor}` }}>
      {/* Desktop */}
      <div style={{ display: "flex", alignItems: "stretch", height: h + "px", maxWidth: "1280px", margin: "0 auto" }}>
        {/* Left nav */}
        <nav style={{ display: "flex", alignItems: "stretch", flex: 1, justifyContent: "flex-end" }}>
          {left.map((link) => (
            <div key={link.id} style={{
              display: "flex", alignItems: "center", padding: `0 ${navPx}px`,
              color: config.textColor, fontFamily: "var(--font-nav)",
              fontSize: config.navFontSize + "px", letterSpacing: config.navLetterSpacing,
              textTransform: "uppercase", whiteSpace: "nowrap",
              borderBottom: "2px solid transparent",
            }}>
              {link.label}
            </div>
          ))}
        </nav>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 28px", flexShrink: 0 }}>
          <div style={{ width: config.logoSize, height: config.logoSize, borderRadius: "50%", background: "rgba(138,154,120,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: config.textColor, fontSize: Math.max(8, config.logoSize * 0.19) + "px", letterSpacing: "0.12em", fontFamily: "var(--font-display)" }}>CG</span>
          </div>
        </div>
        {/* Right nav */}
        <nav style={{ display: "flex", alignItems: "stretch", flex: 1, justifyContent: "flex-start" }}>
          {right.map((link) => (
            <div key={link.id} style={{
              display: "flex", alignItems: "center", padding: `0 ${navPx}px`,
              color: config.textColor, fontFamily: "var(--font-nav)",
              fontSize: config.navFontSize + "px", letterSpacing: config.navLetterSpacing,
              textTransform: "uppercase", whiteSpace: "nowrap",
              borderBottom: "2px solid transparent",
            }}>
              {link.label}
            </div>
          ))}
        </nav>
      </div>
      {/* Mobile strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: mh + "px", borderTop: `1px solid ${config.borderColor}` }}>
        <div style={{ width: 24, height: 3, background: config.textColor, opacity: 0.5, boxShadow: `0 6px 0 ${config.textColor}60, 0 12px 0 ${config.textColor}60` }} />
        <div style={{ width: config.mobileLogoSize, height: config.mobileLogoSize, borderRadius: "50%", background: "rgba(138,154,120,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: config.textColor, fontSize: Math.max(7, config.mobileLogoSize * 0.17) + "px", letterSpacing: "0.1em", fontFamily: "var(--font-display)" }}>CG</span>
        </div>
        <div style={{ width: 20 }} />
      </div>
    </div>
  );
}

// ─── Footer Preview ───────────────────────────────────────────────────────────
function FooterPreview({ config }: { config: SiteConfig["footer"] }) {
  return (
    <div style={{ background: config.bgColor, padding: "48px 48px 24px", minHeight: "160px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "32px", marginBottom: "32px" }}>
        {config.showHours && (
          <div>
            <p style={{ color: config.mutedColor, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-label)", marginBottom: "12px" }}>Hours</p>
            <p style={{ color: config.textColor, fontSize: "13px", lineHeight: 1.7 }}>Mon–Sat | 7am–12pm</p>
            <p style={{ color: config.textColor, fontSize: "13px" }}>Mon–Sat | 5pm–Close</p>
          </div>
        )}
        {config.showContact && (
          <div>
            <p style={{ color: config.mutedColor, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-label)", marginBottom: "12px" }}>Contact</p>
            <p style={{ color: config.textColor, fontSize: "13px", lineHeight: 1.7 }}>Glen Ellyn, IL</p>
            <p style={{ color: config.textColor, fontSize: "13px" }}>info@commongood.com</p>
          </div>
        )}
        {config.showSocialLinks && (
          <div>
            <p style={{ color: config.mutedColor, fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-label)", marginBottom: "12px" }}>Follow</p>
            <p style={{ color: config.textColor, fontSize: "13px", lineHeight: 1.7 }}>Instagram</p>
            <p style={{ color: config.textColor, fontSize: "13px" }}>Facebook</p>
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${config.mutedColor}40`, paddingTop: "16px" }}>
        <p style={{ color: config.mutedColor, fontSize: "11px", letterSpacing: "0.1em" }}>{config.copyrightText}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminHeaderPage() {
  const [config, setConfig]   = useState<SiteConfig>(DEFAULT_CONFIG);
  const [tab, setTab]         = useState<"header" | "footer">("header");
  const [saved, setSaved]     = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    fetch("/api/admin/siteconfig")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function updateHeader(updates: Partial<SiteConfig["header"]>) {
    setConfig((prev) => ({ ...prev, header: { ...prev.header, ...updates } }));
    setDirty(true);
  }

  function updateFooter(updates: Partial<SiteConfig["footer"]>) {
    setConfig((prev) => ({ ...prev, footer: { ...prev.footer, ...updates } }));
    setDirty(true);
  }

  function updateNavLink(id: string, updates: Partial<NavLink>) {
    updateHeader({
      navLinks: config.header.navLinks.map((l) => l.id === id ? { ...l, ...updates } : l),
    });
  }

  function removeNavLink(id: string) {
    updateHeader({ navLinks: config.header.navLinks.filter((l) => l.id !== id) });
  }

  function addNavLink() {
    const order = config.header.navLinks.length;
    const link: NavLink = { id: newId(), label: "Link", href: "/", visible: true, order };
    updateHeader({ navLinks: [...config.header.navLinks, link] });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...config.header.navLinks].sort((a, b) => a.order - b.order);
    const oi = sorted.findIndex((l) => l.id === active.id);
    const ni = sorted.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(sorted, oi, ni).map((l, i) => ({ ...l, order: i }));
    updateHeader({ navLinks: reordered });
  }

  async function handleSave() {
    try {
      await fetch("/api/admin/siteconfig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  const sortedLinks = [...config.header.navLinks].sort((a, b) => a.order - b.order);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* ── Left Editor Panel ── */}
      <div className="w-[340px] shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 shrink-0">
          <div className="flex gap-0.5 flex-1">
            {(["header", "footer"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx("px-3 py-1.5 text-[10px] tracking-widest uppercase rounded-sm transition-colors", tab === t ? "bg-[#C97D5A]/15 text-[#C97D5A]" : "text-gray-400 hover:text-gray-600")}
              >
                {t === "header" ? "Header & Nav" : "Footer"}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            className={clsx("flex items-center gap-1.5 px-2.5 py-1 text-white text-[10px] tracking-widest uppercase rounded-sm shrink-0", saved ? "bg-green-500" : "bg-[#C97D5A] hover:bg-[#b86d4a]")}
          >
            <Save size={11} />
            {saved ? "Saved!" : dirty ? "Save*" : "Save"}
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto">
          {tab === "header" ? (
            <div className="p-4 space-y-5">
              {/* Colors */}
              <section>
                <p className="text-[10px] tracking-widest uppercase text-gray-500 mb-3 font-medium">Colors</p>
                <div className="space-y-3">
                  {[
                    { label: "Background",  key: "bgColor"     as const },
                    { label: "Nav Text",    key: "textColor"   as const },
                    { label: "Active/Hover",key: "activeColor" as const },
                    { label: "Border",      key: "borderColor" as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className={labelCls}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">{config.header[key]}</span>
                        <ColorPicker
                          label={label}
                          value={config.header[key]}
                          onChange={(h) => updateHeader({ [key]: h ?? config.header[key] })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Header Heights */}
              <section>
                <p className="text-[10px] tracking-widest uppercase text-gray-500 mb-3 font-medium">Header Height</p>
                <div className="space-y-4">
                  <SliderInput label="Desktop Height" value={config.header.headerHeight ?? 72} min={48} max={120} step={2} onChange={(v) => updateHeader({ headerHeight: v })} />
                  <SliderInput label="Mobile Height"  value={config.header.mobileHeaderHeight ?? 52} min={40} max={80} step={2} onChange={(v) => updateHeader({ mobileHeaderHeight: v })} />
                </div>
              </section>

              {/* Logo sizes */}
              <section>
                <p className="text-[10px] tracking-widest uppercase text-gray-500 mb-3 font-medium">Logo Size</p>
                <div className="space-y-4">
                  <SliderInput label="Desktop Logo" value={config.header.logoSize}       min={28} max={100} step={2} onChange={(v) => updateHeader({ logoSize: v })} />
                  <SliderInput label="Mobile Logo"  value={config.header.mobileLogoSize} min={22} max={72}  step={2} onChange={(v) => updateHeader({ mobileLogoSize: v })} />
                </div>
              </section>

              {/* Typography */}
              <section>
                <p className="text-[10px] tracking-widest uppercase text-gray-500 mb-3 font-medium">Nav Typography</p>
                <div className="space-y-4">
                  <SliderInput label="Font Size"     value={config.header.navFontSize}  min={10} max={20} onChange={(v) => updateHeader({ navFontSize: v })} />
                  <SliderInput label="Link Padding"  value={config.header.navPaddingX ?? 20} min={8} max={48} step={2} onChange={(v) => updateHeader({ navPaddingX: v })} />
                  <div>
                    <span className={labelCls}>Letter Spacing</span>
                    <input type="text" className={inputCls} value={config.header.navLetterSpacing} onChange={(e) => updateHeader({ navLetterSpacing: e.target.value })} placeholder="0.22em" />
                  </div>
                </div>
              </section>

              {/* Nav links */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] tracking-widest uppercase text-gray-500 font-medium">Nav Links</p>
                  <button onClick={addNavLink} className="text-gray-400 hover:text-[#C97D5A] transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mb-2">Drag to reorder • 👁 toggle visibility • ↗ new tab</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortedLinks.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                    {sortedLinks.map((link) => (
                      <SortableNavRow
                        key={link.id}
                        link={link}
                        onUpdate={updateNavLink}
                        onRemove={removeNavLink}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </section>
            </div>
          ) : (
            /* Footer editor */
            <div className="p-4 space-y-5">
              {/* Colors */}
              <section>
                <p className="text-[10px] tracking-widest uppercase text-gray-500 mb-3 font-medium">Colors</p>
                <div className="space-y-3">
                  {[
                    { label: "Background", key: "bgColor"    as const },
                    { label: "Text",       key: "textColor"  as const },
                    { label: "Muted",      key: "mutedColor" as const },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className={labelCls}>{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">{config.footer[key]}</span>
                        <ColorPicker
                          label={label}
                          value={config.footer[key]}
                          onChange={(h) => updateFooter({ [key]: h ?? config.footer[key] })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Sections */}
              <section>
                <p className="text-[10px] tracking-widest uppercase text-gray-500 mb-3 font-medium">Sections to Show</p>
                <div className="space-y-2">
                  {[
                    { label: "Hours",       key: "showHours"       as const },
                    { label: "Contact",     key: "showContact"     as const },
                    { label: "Social Links",key: "showSocialLinks" as const },
                  ].map(({ label, key }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-gray-500">
                      <input type="checkbox" checked={config.footer[key]} onChange={(e) => updateFooter({ [key]: e.target.checked })} className="accent-[#C97D5A]" />
                      {label}
                    </label>
                  ))}
                </div>
              </section>

              {/* Copyright */}
              <section>
                <span className={labelCls}>Copyright Text</span>
                <input className={inputCls} value={config.footer.copyrightText ?? ""} onChange={(e) => updateFooter({ copyrightText: e.target.value })} />
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Preview Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">
        <div className="flex items-center px-4 py-2 bg-white border-b border-gray-200 shrink-0">
          <p className="text-[10px] tracking-widest uppercase text-gray-400">
            Live Preview — {tab === "header" ? "Header & Navigation" : "Footer"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white shadow-xl overflow-hidden rounded-sm">
            {/* Header preview */}
            <HeaderPreview config={config.header} />
            {/* Page content placeholder */}
            {tab === "header" && (
              <div style={{ background: "#1A1F17", padding: "48px 64px", textAlign: "center" }}>
                <p style={{ color: "#5a6a4a", fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  — page content —
                </p>
              </div>
            )}
            {/* Footer preview */}
            {tab === "footer" && <FooterPreview config={config.footer} />}
            {tab === "header" && <FooterPreview config={config.footer} />}
          </div>
        </div>
      </div>
    </div>
  );
}
