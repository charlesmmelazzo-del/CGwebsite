"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Calendar, Loader2, Save, GripVertical, FileText, Type } from "lucide-react";
import type { CalendarEvent, HostSection, PageHeaderData } from "@/types";
import { getPageDefault } from "@/lib/pagedefaults";

function newId() { return `e-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const labelCls = "block text-[10px] tracking-widest uppercase text-gray-400 mb-1";
const inputCls = "w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm";
const smallInputCls = "w-full bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1.5 outline-none focus:border-[#C97D5A]/50 rounded-sm";

// ─── PDF picker (upload or paste URL) ────────────────────────────────────────
function PdfPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Only PDF files."); return; }
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/pdfs/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 hover:border-[#C97D5A] hover:text-[#C97D5A] transition-colors rounded-sm disabled:opacity-50"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
        <span className="text-xs text-gray-400">or paste URL below</span>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFile} />
      </div>
      <input
        className={smallInputCls}
        placeholder="https://... or Dropbox/Drive share link"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <p className="text-[10px] text-green-600">PDF set: <a href={value} target="_blank" rel="noopener noreferrer" className="underline truncate max-w-xs inline-block align-bottom">{value}</a></p>
      )}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── Host Section Editor ──────────────────────────────────────────────────────
function HostSectionCard({
  section,
  onUpdate,
  onRemove,
}: {
  section: HostSection;
  onUpdate: (id: string, patch: Partial<HostSection>) => void;
  onRemove: (id: string) => void;
}) {
  function patch(p: Partial<HostSection>) { onUpdate(section.id, p); }

  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300" />
          <span className="text-xs tracking-widest uppercase text-gray-400 flex items-center gap-1">
            {section.type === "pdf" ? <><FileText size={11} /> PDF Section</> : <><Type size={11} /> Text Section</>}
          </span>
        </div>
        <button onClick={() => onRemove(section.id)} className="text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {section.type === "text" && (
          <>
            <div>
              <label className={labelCls}>Section Title <span className="normal-case opacity-60">(optional)</span></label>
              <input className={smallInputCls} value={section.title ?? ""} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Host Your Event at Common Good" />
            </div>
            <div>
              <label className={labelCls}>Body Text</label>
              <textarea
                className={smallInputCls + " resize-y"}
                rows={4}
                value={section.body ?? ""}
                onChange={(e) => patch({ body: e.target.value })}
                placeholder="Describe what you offer..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Button Label <span className="normal-case opacity-60">(optional)</span></label>
                <input className={smallInputCls} value={section.buttonLabel ?? ""} onChange={(e) => patch({ buttonLabel: e.target.value })} placeholder="e.g. Contact Us" />
              </div>
              <div>
                <label className={labelCls}>Button URL</label>
                <input className={smallInputCls} value={section.buttonUrl ?? ""} onChange={(e) => patch({ buttonUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={section.buttonNewTab ?? false} onChange={(e) => patch({ buttonNewTab: e.target.checked })} className="accent-[#C97D5A]" />
              <span className="text-xs text-gray-500">Open button link in new tab</span>
            </label>
          </>
        )}

        {section.type === "pdf" && (
          <>
            <div>
              <label className={labelCls}>Section Heading <span className="normal-case opacity-60">(optional)</span></label>
              <input className={smallInputCls} value={section.pdfTitle ?? ""} onChange={(e) => patch({ pdfTitle: e.target.value })} placeholder="e.g. Events Pricing Guide" />
            </div>
            <div>
              <label className={labelCls}>PDF File</label>
              <PdfPicker value={section.pdfUrl ?? ""} onChange={(url) => patch({ pdfUrl: url })} />
            </div>
            <div>
              <label className={labelCls}>Download Button Label</label>
              <input className={smallInputCls} value={section.pdfDownloadLabel ?? ""} onChange={(e) => patch({ pdfDownloadLabel: e.target.value })} placeholder="Download PDF" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminEventsPage() {
  const [tab, setTab] = useState<"calendar" | "host">("calendar");

  // Calendar tab state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Host tab state
  const [hostSections, setHostSections] = useState<HostSection[]>([
    { id: "h1", order: 0, type: "text", title: "Host Your Event at Common Good", body: "Whether it's an intimate dinner, a corporate gathering, or a celebration of life's biggest moments — Common Good Cocktail House is the perfect backdrop.\n\nWe offer private and semi-private event options with customized cocktail menus, exceptional service, and an ambiance that makes every occasion memorable." },
  ]);
  const [savingHost, setSavingHost] = useState(false);
  const [hostSaved, setHostSaved] = useState(false);
  const [loadingHost, setLoadingHost] = useState(true);

  // Load calendar events
  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEvents(data); })
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, []);

  // Load host tab content from page-headers
  useEffect(() => {
    fetch("/api/admin/page-headers")
      .then((r) => r.json())
      .then((d) => {
        const eventsData = d.pages?.events as PageHeaderData | undefined;
        if (eventsData?.hostSections) setHostSections(eventsData.hostSections);
      })
      .catch(() => {})
      .finally(() => setLoadingHost(false));
  }, []);

  // ── Calendar handlers ──
  function openNew() { setEditing({ title: "", start: "", description: "", location: "" }); }
  function openEdit(event: CalendarEvent) { setEditing({ ...event }); }

  async function saveEvent() {
    if (!editing?.title || !editing?.start) return;
    const event: CalendarEvent = {
      id: editing.id ?? newId(),
      title: editing.title,
      start: editing.start,
      end: editing.end,
      description: editing.description,
      location: editing.location,
      imageUrl: editing.imageUrl,
      visibleFrom: editing.visibleFrom,
      visibleUntil: editing.visibleUntil,
    };
    setSavingEvent(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) throw new Error("Save failed");
      setEvents((prev) => editing.id ? prev.map((e) => e.id === event.id ? event : e) : [...prev, event]);
      setEditing(null);
    } catch {
      alert("Failed to save event. Please try again.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function removeEvent(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert("Failed to delete event. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Host tab handlers ──
  function addHostSection(type: "text" | "pdf") {
    const s: HostSection = { id: newId(), order: hostSections.length, type };
    setHostSections((prev) => [...prev, s]);
  }

  function updateHostSection(id: string, patch: Partial<HostSection>) {
    setHostSections((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  }

  function removeHostSection(id: string) {
    setHostSections((prev) => prev.filter((s) => s.id !== id));
  }

  async function saveHost() {
    setSavingHost(true);
    try {
      // Read current header data first, then merge hostSections in
      const current = getPageDefault("events");
      const res = await fetch("/api/admin/page-headers");
      const saved = res.ok ? (await res.json()).pages?.events ?? {} : {};
      const merged: PageHeaderData = { ...current, ...saved, hostSections };

      const saveRes = await fetch("/api/admin/page-headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: "events", data: merged }),
      });
      if (!saveRes.ok) throw new Error("Save failed");
      setHostSaved(true);
      setTimeout(() => setHostSaved(false), 2000);
    } catch {
      alert("Failed to save. Please try again.");
    } finally {
      setSavingHost(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>Events</h1>
        {tab === "calendar" ? (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 border border-[#C97D5A]/40 text-[#C97D5A] text-xs tracking-widest uppercase hover:bg-[#C97D5A]/10 transition-colors">
            <Plus size={14} /> Add Event
          </button>
        ) : (
          <button onClick={saveHost} disabled={savingHost} className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] disabled:opacity-60 transition-colors">
            <Save size={14} />
            {hostSaved ? "Saved!" : savingHost ? "Saving..." : "Save Host Tab"}
          </button>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(["calendar", "host"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs tracking-widest uppercase transition-colors border-b-2 -mb-px ${
              tab === t ? "border-[#C97D5A] text-[#C97D5A]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "calendar" ? "Calendar Events" : "Host Your Event Tab"}
          </button>
        ))}
      </div>

      {/* ── Calendar tab ── */}
      {tab === "calendar" && (
        <div className="space-y-2 mb-6">
          {loadingEvents && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={18} className="animate-spin mr-2" />
              <span className="text-sm">Loading events...</span>
            </div>
          )}
          {!loadingEvents && events.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">No events yet — click Add Event to create one</p>
          )}
          {!loadingEvents && events.sort((a, b) => a.start.localeCompare(b.start)).map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-4 bg-white border border-gray-200 cursor-pointer hover:border-[#C97D5A]/40 transition-colors rounded-sm"
              onClick={() => openEdit(event)}
            >
              <Calendar size={15} className="text-[#C97D5A] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-800 text-sm tracking-wider">{event.title}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {new Date(event.start + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                </p>
                {event.description && <p className="text-gray-400 text-xs mt-1 truncate">{event.description}</p>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeEvent(event.id); }}
                disabled={deletingId === event.id}
                className="text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
              >
                {deletingId === event.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Host tab editor ── */}
      {tab === "host" && (
        <div className="space-y-4">
          {loadingHost ? (
            <div className="flex justify-center py-12 text-gray-400"><Loader2 size={18} className="animate-spin" /></div>
          ) : (
            <>
              <p className="text-xs text-gray-400">These sections appear on the &quot;Host Your Event&quot; tab of the Events page. Add text blocks, pricing info, or a PDF download.</p>

              {hostSections.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8 border border-dashed border-gray-200 rounded-sm">No sections yet — add one below</p>
              )}

              <div className="space-y-3">
                {hostSections.map((section) => (
                  <HostSectionCard
                    key={section.id}
                    section={section}
                    onUpdate={updateHostSection}
                    onRemove={removeHostSection}
                  />
                ))}
              </div>

              {/* Add section */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => addHostSection("text")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs tracking-wider text-[#C97D5A] border border-[#C97D5A]/30 hover:bg-[#C97D5A]/10 transition-colors uppercase rounded-sm"
                >
                  <Plus size={12} /> Add Text Section
                </button>
                <button
                  onClick={() => addHostSection("pdf")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs tracking-wider text-[#C97D5A] border border-[#C97D5A]/30 hover:bg-[#C97D5A]/10 transition-colors uppercase rounded-sm"
                >
                  <FileText size={12} /> Add PDF Section
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Calendar event edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 shadow-xl w-full max-w-lg p-6 rounded-sm">
            <h2 className="text-lg text-gray-800 mb-4 tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
              {editing.id ? "Edit Event" : "New Event"}
            </h2>
            <div className="space-y-3">
              {([
                ["title", "Event Name *", "text"],
                ["start", "Date *", "date"],
                ["end", "End Date", "date"],
                ["location", "Location", "text"],
                ["imageUrl", "Image URL", "text"],
              ] as [keyof CalendarEvent, string, string][]).map(([field, label, type]) => (
                <div key={field}>
                  <label className={labelCls}>{label}</label>
                  <input
                    type={type}
                    value={(editing[field] as string) ?? ""}
                    onChange={(e) => setEditing((v) => ({ ...v, [field]: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing((v) => ({ ...v, description: e.target.value }))}
                  className={inputCls + " resize-none"}
                />
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Visibility Schedule <span className="normal-case opacity-60">(optional — leave blank to always show)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Show From</label>
                    <input
                      type="date"
                      value={editing.visibleFrom ?? ""}
                      onChange={(e) => setEditing((v) => ({ ...v, visibleFrom: e.target.value || undefined }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Hide After</label>
                    <input
                      type="date"
                      value={editing.visibleUntil ?? ""}
                      onChange={(e) => setEditing((v) => ({ ...v, visibleUntil: e.target.value || undefined }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={saveEvent}
                disabled={savingEvent}
                className="flex-1 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {savingEvent && <Loader2 size={13} className="animate-spin" />}
                {savingEvent ? "Saving..." : (editing.id ? "Update" : "Add") + " Event"}
              </button>
              <button onClick={() => setEditing(null)} disabled={savingEvent} className="px-5 py-2.5 border border-gray-200 text-gray-500 text-xs tracking-widest uppercase hover:border-gray-400 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
