"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import SliderInput from "@/components/ui/SliderInput";
import ImagePicker from "@/components/ui/ImagePicker";
import ColorPicker from "@/components/ui/ColorPicker";
import ThemeEditor from "@/components/ui/ThemeEditor";
import type { PageHeaderData, PageHeaderTab } from "@/types";
import { getPageDefault } from "@/lib/pagedefaults";

export type StylePageId = "home" | "menu" | "coffee" | "events" | "reserve" | "club" | "shop" | "about";

// Which controls each page's public template actually uses.
const CONFIG: Record<StylePageId, {
  label: string;
  title: boolean;       // header title text + size
  subtitle: boolean;    // tagline under the title
  tabLabels: boolean;   // rename the in-page tabs
  theme: boolean;       // 3-colour palette (background / text / accent)
  home?: boolean;       // home page: background colour + photo strength instead of a palette
  note?: string;
}> = {
  home:    { label: "Home",    title: false, subtitle: false, tabLabels: false, theme: false, home: true },
  menu:    { label: "Menu",    title: true,  subtitle: true,  tabLabels: false, theme: true },
  coffee:  { label: "Coffee",  title: true,  subtitle: true,  tabLabels: false, theme: true },
  events:  { label: "Events",  title: true,  subtitle: false, tabLabels: true,  theme: true },
  reserve: { label: "Reserve", title: false, subtitle: false, tabLabels: false, theme: true,
             note: "The Reserve page's heading text is edited on the Content tab." },
  club:    { label: "Club",    title: true,  subtitle: false, tabLabels: false, theme: true },
  shop:    { label: "Shop",    title: true,  subtitle: false, tabLabels: false, theme: true },
  about:   { label: "About",   title: true,  subtitle: false, tabLabels: false, theme: true },
};

const HOME_DEFAULT_BG = "#1A1F17";
const HOME_DEFAULT_OPACITY = 35;

const labelCls = "block text-[10px] tracking-widest uppercase text-gray-500 mb-1 font-medium";
const inputCls = "w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C97D5A]";
const cardCls = "bg-white rounded border border-gray-200 p-5 space-y-4";

/**
 * Header, background and colour settings for ONE page. Lives in the
 * "Header & Style" tab of that page's admin panel.
 */
export default function PageStyleEditor({ pageId }: { pageId: StylePageId }) {
  const cfg = CONFIG[pageId];
  const [current, setCurrent] = useState<PageHeaderData>(() => getPageDefault(pageId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/page-headers");
        const { pages } = res.ok ? await res.json() as { pages: Record<string, PageHeaderData> } : { pages: {} as Record<string, PageHeaderData> };
        let next: PageHeaderData = { ...getPageDefault(pageId), ...(pages[pageId] ?? {}) };
        // Home's background photo used to be stored with the carousel; show it
        // here until the first save from this tab.
        if (cfg.home && next.bgImageUrl === undefined) {
          const home = await fetch("/api/admin/home").then((r) => r.json()).catch(() => ({}));
          next = { ...next, bgImageUrl: typeof home.bgUrl === "string" ? home.bgUrl : "" };
        }
        if (!cancelled) setCurrent(next);
      } catch {
        if (!cancelled) setError("Couldn't load the saved settings. What you see are the defaults.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageId, cfg.home]);

  function update(patch: Partial<PageHeaderData>) {
    setCurrent((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  }

  function updateTab(tabId: string, label: string) {
    update({ tabs: (current.tabs ?? []).map((t) => (t.id === tabId ? { ...t, label } : t)) });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      // Other tabs store their own fields on the same record (e.g. the Events
      // "Host Your Event" sections) — re-read so we never overwrite them.
      const latestRes = await fetch("/api/admin/page-headers");
      const latest: Partial<PageHeaderData> = latestRes.ok ? (await latestRes.json()).pages?.[pageId] ?? {} : {};
      const data: PageHeaderData = { ...current, hostSections: latest.hostSections ?? current.hostSections };
      if (cfg.home) data.bgImageUrl = data.bgImageUrl ?? "";

      const res = await fetch("/api/admin/page-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, data }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setDirty(false);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
            {cfg.title ? "Header & Style" : "Background & Style"}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            How the {cfg.label} page looks{cfg.title ? " — its heading, background and colours" : " — its background and colours"}.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] disabled:opacity-50 transition-colors rounded"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-sm">{error}</div>}
      {cfg.note && <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded p-3">{cfg.note}</p>}

      {cfg.title && (
        <section className={cardCls}>
          <p className={labelCls + " text-gray-700"}>Page Title</p>
          <div>
            <label className={labelCls} htmlFor="ps-title">Title Text</label>
            <input id="ps-title" className={inputCls} value={current.title} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <SliderInput label="Title Size" value={current.titleSize} min={24} max={120} step={2} onChange={(v) => update({ titleSize: v })} />
          <p className="text-[10px] text-gray-400 italic">
            Preview:{" "}
            <span style={{ fontSize: Math.round(current.titleSize * 0.35) + "px", fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {current.title || "—"}
            </span>
          </p>
        </section>
      )}

      {cfg.subtitle && (
        <section className={cardCls}>
          <p className={labelCls + " text-gray-700"}>Subtitle / Tagline</p>
          <div>
            <label className={labelCls} htmlFor="ps-sub">
              Subtitle Text <span className="normal-case text-gray-400">(leave blank to hide)</span>
            </label>
            <input id="ps-sub" className={inputCls} value={current.subtitle ?? ""} onChange={(e) => update({ subtitle: e.target.value })} />
          </div>
          <SliderInput label="Subtitle Size" value={current.subtitleSize ?? 13} min={10} max={24} onChange={(v) => update({ subtitleSize: v })} />
        </section>
      )}

      {cfg.tabLabels && (current.tabs?.length ?? 0) > 0 && (
        <section className={cardCls}>
          <p className={labelCls + " text-gray-700"}>Tab Labels</p>
          <div className="space-y-3">
            {(current.tabs as PageHeaderTab[]).map((tab) => (
              <div key={tab.id}>
                <label className={labelCls} htmlFor={`ps-tab-${tab.id}`}>
                  Tab: <span className="text-gray-400 normal-case">{tab.id}</span>
                </label>
                <input id={`ps-tab-${tab.id}`} className={inputCls} value={tab.label} onChange={(e) => updateTab(tab.id, e.target.value)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={cardCls}>
        <p className={labelCls + " text-gray-700"}>Background Image</p>
        <p className="text-xs text-gray-400">
          Choose from the content library, upload, or paste a URL. Leave blank to use the page colour.
        </p>
        <ImagePicker label="Choose from library" value={current.bgImageUrl ?? ""} onChange={(url) => update({ bgImageUrl: url })} />
        <div>
          <label className={labelCls} htmlFor="ps-bg">Or paste an image URL</label>
          <input id="ps-bg" className={inputCls} placeholder="https://..." value={current.bgImageUrl ?? ""} onChange={(e) => update({ bgImageUrl: e.target.value })} />
        </div>
        {cfg.home && (
          <SliderInput
            label="Photo strength (lower = darker, text easier to read)"
            value={current.bgImageOpacity ?? HOME_DEFAULT_OPACITY}
            min={0} max={100} step={5} unit="%"
            onChange={(v) => update({ bgImageOpacity: v })}
          />
        )}
      </section>

      {cfg.home && (
        <section className={cardCls}>
          <p className={labelCls + " text-gray-700"}>Background Colour</p>
          <p className="text-xs text-gray-400">Shown behind the photo, and on its own when there is no photo.</p>
          <div className="flex items-center gap-3">
            <ColorPicker size="md" value={current.customBg ?? HOME_DEFAULT_BG} onChange={(hex) => update({ customBg: hex })} />
            {current.customBg && current.customBg !== HOME_DEFAULT_BG && (
              <button type="button" onClick={() => update({ customBg: undefined })} className="text-xs text-gray-400 hover:text-[#C97D5A] underline">
                Reset to default
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">Slide text colours, fonts and sizes are set on each slide in the Slides &amp; Content tab.</p>
        </section>
      )}

      {cfg.theme && (
        <section className={cardCls}>
          <p className={labelCls + " text-gray-700"}>Page Colours</p>
          <p className="text-xs text-gray-400">
            Pick a preset to start, then customise each colour with the colour wheel or enter a hex value.
          </p>
          <ThemeEditor
            theme={current.theme}
            customBg={current.customBg}
            customText={current.customText}
            customMuted={current.customMuted}
            onChange={(updates) => update(updates)}
          />
        </section>
      )}
    </div>
  );
}
