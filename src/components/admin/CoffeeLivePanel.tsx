"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import {
  composeTabs, sectionsByTab, priceLine, tabKind, defaultGroupLabel, groupLine, displaySectionsOf, newDisplayId,
  type CoffeeFeed, type CoffeeLiveConfig, type TabInput, type FeedAddonGroup, type DisplaySection,
} from "@/lib/coffee/live";

/**
 * Coffee 01: one coffee tab's live-menu settings (Toast's Coffee Shop menu, via the Bible).
 * Which sections the tab shows, single items picked into it, headings, note lines, hiding, order and the
 * "Show PDF instead" switch. Saved with the rest of the coffee menus (coffee_menus.live).
 */

const input = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
const small = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";

const AUTO_TEXT: Record<ReturnType<typeof tabKind>, string> = {
  food: "Automatic: the Food sections.",
  limited: "Automatic: a section named like “Limited” or “LTD” (pick single items below for lattes that live in another section).",
  coffee: "Automatic: every section no other tab takes.",
};

export default function CoffeeLivePanel({
  tab, tabs, feed, feedSource, onChange,
}: {
  tab: TabInput;
  /** Every shown tab, in order, with its current settings (the defaults depend on the other tabs). */
  tabs: TabInput[];
  feed: CoffeeFeed | null;
  feedSource: string;
  onChange: (live: CoffeeLiveConfig) => void;
}) {
  const cfg: CoffeeLiveConfig = tab.live ?? {};
  const set = (patch: Partial<CoffeeLiveConfig>) => onChange({ ...cfg, ...patch });

  if (!feed) {
    return (
      <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-sm p-3">
        The live menu from Toast isn&apos;t available right now (the Cocktail Bible couldn&apos;t be reached, or Toast&apos;s
        menu file hasn&apos;t arrived). Guests see this tab&apos;s PDF or image until it is.
      </div>
    );
  }

  const shownTabs = tabs.some((t) => t.id === tab.id) ? tabs : [...tabs, tab];
  const { tabs: composed } = composeTabs(shownTabs, feed);
  const me = composed.find((t) => t.id === tab.id);
  const included = sectionsByTab(shownTabs, feed).get(tab.id) ?? new Set<string>();
  const picks = new Set(cfg.items ?? []);
  const pickedElsewhere = new Map<string, string>();
  for (const t of shownTabs) if (t.id !== tab.id) for (const id of t.live?.items ?? []) pickedElsewhere.set(id, t.label);
  const hiddenS = new Set(cfg.hiddenSections ?? []);
  const hiddenI = new Set(cfg.hiddenItems ?? []);
  const chosen = Array.isArray(cfg.sections);
  const hiddenG = new Set((cfg.hiddenGroups ?? []).map((n) => n.toLowerCase()));
  const displays = displaySectionsOf(cfg);
  const placed = new Set(displays.flatMap((d) => d.items));
  const itemName = new Map<string, string>();
  feed.sections.forEach((sec) => sec.items.forEach((it) => itemName.set(it.id, it.name)));
  const setDisplay = (id: string, patch: Partial<DisplaySection>) =>
    set({ displaySections: displays.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  // Every Toast option group this tab can show (one entry per name; the first one seen is the example).
  const groups: FeedAddonGroup[] = [];
  const seenG = new Set<string>();
  for (const sec of feed.sections) {
    if (!included.has(sec.id) && !sec.items.some((it) => picks.has(it.id) || placed.has(it.id))) continue;
    for (const g of [...(sec.addon_groups ?? []), ...sec.items.flatMap((it) => it.addon_groups ?? [])]) {
      if (seenG.has(g.name.toLowerCase())) continue;
      seenG.add(g.name.toLowerCase());
      groups.push(g);
    }
  }

  // The sections this tab has anything from, in the order they show.
  const order = new Map((cfg.order ?? []).map((id, i) => [id, i]));
  const candidates = feed.sections
    .filter((s) => included.has(s.id) || s.items.some((it) => picks.has(it.id)))
    .sort((a, b) => (order.has(a.id) ? order.get(a.id)! : 1e4 + a.ordinal) - (order.has(b.id) ? order.get(b.id)! : 1e4 + b.ordinal));

  const move = (i: number, d: -1 | 1) => {
    const ids = candidates.map((s) => s.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    set({ order: ids });
  };
  const toggle = (list: string[] | undefined, id: string, on: boolean) => {
    const s = new Set(list ?? []);
    if (on) s.add(id); else s.delete(id);
    return Array.from(s);
  };
  const text = (map: Record<string, string> | undefined, id: string, v: string) => {
    const out = { ...(map ?? {}) };
    if (v) out[id] = v; else delete out[id];
    return out;
  };

  const status = me?.showing === "live"
    ? `Guests see the live menu: ${me.itemCount} item${me.itemCount === 1 ? "" : "s"} in ${me.sections.length} section${me.sections.length === 1 ? "" : "s"}.`
    : me?.showing === "pdf" ? "Guests see this tab’s PDF (or image)." : "Guests see “This menu is being updated”: nothing is on this tab yet.";

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-sm p-3 space-y-1">
        <p>{status}</p>
        <p className="text-gray-400">
          From Toast&apos;s “Coffee Shop” menu{feed.menu_read_at ? `, read ${new Date(feed.menu_read_at).toLocaleDateString()}` : ""}
          {feedSource !== "bible" ? " (the last good copy: the Bible couldn’t be reached just now)" : ""}. Change items and prices in Toast; they show here the next morning.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-1" checked={cfg.showPdf === true} onChange={(e) => set({ showPdf: e.target.checked })} />
        <span>
          Show PDF instead
          <span className="block text-xs text-gray-400">
            {cfg.showPdf === undefined ? "Off: the live menu shows as soon as this tab has items (until then, the PDF)." : "Uses the PDF or image below."}
          </span>
        </span>
      </label>

      <div>
        <p className={small}>Sections on this tab</p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-2">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!chosen} onChange={() => { const n = { ...cfg }; delete n.sections; onChange(n); }} /> Automatic
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={chosen} onChange={() => set({ sections: Array.from(included) })} /> Choose
          </label>
        </div>
        {!chosen ? (
          <p className="text-xs text-gray-400">{AUTO_TEXT[tabKind(tab.label)]}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-1">
            {feed.sections.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={(cfg.sections ?? []).includes(s.id)} onChange={(e) => set({ sections: toggle(cfg.sections ?? [], s.id, e.target.checked) })} />
                {s.name} <span className="text-gray-400 text-xs">({s.items.length})</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={small} htmlFor={`pick-${tab.id}`}>Add a single item to this tab</label>
        <select
          id={`pick-${tab.id}`}
          className={input}
          value=""
          onChange={(e) => { if (e.target.value) set({ items: toggle(cfg.items, e.target.value, true) }); }}
        >
          <option value="">Choose an item from any section…</option>
          {feed.sections.map((s) => (
            <optgroup key={s.id} label={s.name}>
              {s.items.filter((it) => !picks.has(it.id)).map((it) => (
                <option key={it.id} value={it.id}>{it.name} ({priceLine(it.prices)})</option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">A picked item shows only on the tab(s) that picked it, so it leaves the tab it would normally be on.</p>
      </div>

      {groups.length > 0 && (
        <div>
          <p className={small}>Options from Toast</p>
          <p className="text-xs text-gray-400 mb-2">
            Toast&apos;s milk, temperature and syrup options show automatically: under a section&apos;s heading when the whole section
            has them, otherwise under the item. They follow Toast every night. Rename how they read, or hide one on this tab.
          </p>
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.name} className={`border border-gray-200 rounded-sm p-2 ${hiddenG.has(g.name.toLowerCase()) ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 flex-1">Toast: {g.name}</span>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={hiddenG.has(g.name.toLowerCase())} onChange={(e) => set({ hiddenGroups: toggle(cfg.hiddenGroups, g.name, e.target.checked) })} /> Hide
                  </label>
                </div>
                <input className={`${input} mt-1 text-xs py-1`} value={cfg.groupLabels?.[g.name] ?? ""} placeholder={defaultGroupLabel(g.name) || "(no label: just the options)"} aria-label={`Name guests see for ${g.name}`}
                  onChange={(e) => set({ groupLabels: text(cfg.groupLabels, g.name, e.target.value) })} />
                <p className="text-xs italic text-gray-400 mt-1">Guests see: {groupLine(g, cfg.groupLabels?.[g.name])}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className={small}>Display sections</p>
        <p className="text-xs text-gray-400 mb-2">
          Split a Toast section on the website only (Toast&apos;s “Tea” as “Tea Lattes”, “Hot Tea”, “Iced Tea”). Items placed here leave their
          Toast section; items not placed stay where they are, so a new Toast item never goes missing.
        </p>
        <ul className="space-y-2">
          {displays.map((d) => (
            <li key={d.id} className="border border-gray-200 rounded-sm p-3">
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                <input className={input} value={d.heading} placeholder="Heading, e.g. Hot Tea" aria-label="Display section heading"
                  onChange={(e) => setDisplay(d.id, { heading: e.target.value })} />
                <input className={input} value={d.note ?? ""} placeholder="Note under the heading (optional)" aria-label="Display section note"
                  onChange={(e) => setDisplay(d.id, { note: e.target.value })} />
              </div>
              <ul className="text-sm text-gray-700 space-y-1 mb-2">
                {d.items.map((id) => (
                  <li key={id} className="flex items-center gap-2">
                    <span className="flex-1">{itemName.get(id) ?? "(no longer on Toast)"}</span>
                    <button type="button" onClick={() => setDisplay(d.id, { items: d.items.filter((x) => x !== id) })} className="text-gray-400 hover:text-gray-700" aria-label="Remove from this section"><X size={12} /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <select className={input} value="" aria-label="Add an item to this display section"
                  onChange={(e) => { if (e.target.value) setDisplay(d.id, { items: [...d.items, e.target.value] }); }}>
                  <option value="">Add an item…</option>
                  {feed.sections.map((s) => (
                    <optgroup key={s.id} label={s.name}>
                      {s.items.filter((it) => !placed.has(it.id)).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button type="button" onClick={() => set({ displaySections: displays.filter((x) => x.id !== d.id) })} className="text-xs text-gray-500 hover:text-red-600 whitespace-nowrap">Delete section</button>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => set({ displaySections: [...displays, { id: newDisplayId(), heading: "", items: [] }] })}
          className="mt-2 text-xs uppercase tracking-wider text-[#C97D5A]">+ Add a display section</button>
      </div>

      {candidates.length === 0 ? (
        <p className="text-xs text-gray-400">Nothing on this tab yet.</p>
      ) : (
        <ol className="space-y-3">
          {candidates.map((s, i) => {
            const items = s.items.filter((it) => (pickedElsewhere.has(it.id) && !picks.has(it.id) ? false : included.has(s.id) || picks.has(it.id)));
            const away = s.items.filter((it) => included.has(s.id) && pickedElsewhere.has(it.id) && !picks.has(it.id));
            return (
              <li key={s.id} className={`border border-gray-200 rounded-sm p-3 ${hiddenS.has(s.id) ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs tracking-widest uppercase text-gray-500 flex-1">{s.name}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label={`Move ${s.name} up`}><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === candidates.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label={`Move ${s.name} down`}><ArrowDown size={14} /></button>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={hiddenS.has(s.id)} onChange={(e) => set({ hiddenSections: toggle(cfg.hiddenSections, s.id, e.target.checked) })} /> Hide
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className={small} htmlFor={`h-${tab.id}-${s.id}`}>Heading</label>
                    <input id={`h-${tab.id}-${s.id}`} className={input} value={cfg.labels?.[s.id] ?? ""} placeholder={s.name}
                      onChange={(e) => set({ labels: text(cfg.labels, s.id, e.target.value) })} />
                  </div>
                  <div>
                    <label className={small} htmlFor={`n-${tab.id}-${s.id}`}>Note under the heading</label>
                    <textarea id={`n-${tab.id}-${s.id}`} rows={2} className={input} value={cfg.notes?.[s.id] ?? ""} placeholder={"e.g. Iced or Hot\n(Whole / Non-Fat / 2% Upon Request)"}
                      onChange={(e) => set({ notes: text(cfg.notes, s.id, e.target.value) })} />
                  </div>
                </div>
                <ul className="divide-y divide-gray-100">
                  {items.map((it) => (
                    <li key={it.id} className={`py-1.5 ${hiddenI.has(it.id) ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="flex-1">{it.name} <span className="text-gray-400 text-xs">{priceLine(it.prices)}</span></span>
                        {picks.has(it.id) && (
                          <button type="button" onClick={() => set({ items: toggle(cfg.items, it.id, false) })} className="flex items-center gap-0.5 text-[10px] uppercase tracking-wider text-[#C97D5A]" aria-label={`Unpick ${it.name}`}>
                            picked <X size={11} />
                          </button>
                        )}
                        <label className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="checkbox" checked={hiddenI.has(it.id)} onChange={(e) => set({ hiddenItems: toggle(cfg.hiddenItems, it.id, e.target.checked) })} /> Hide
                        </label>
                      </div>
                      <input className={`${input} mt-1 text-xs py-1`} value={cfg.itemNotes?.[it.id] ?? ""} placeholder="Note line (optional), e.g. Add any latte flavor +0.50" aria-label={`Note for ${it.name}`}
                        onChange={(e) => set({ itemNotes: text(cfg.itemNotes, it.id, e.target.value) })} />
                    </li>
                  ))}
                </ul>
                {away.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Shown on another tab instead: {away.map((it) => `${it.name} (${pickedElsewhere.get(it.id)})`).join(", ")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
