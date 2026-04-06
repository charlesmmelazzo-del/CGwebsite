"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Calendar } from "lucide-react";
import type { CalendarEvent } from "@/types";

function newId() { return `e-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

const SAMPLE: CalendarEvent[] = [
  { id: "1", title: "Cocktail Tasting Night", start: "2026-04-13", description: "Spring menu preview." },
  { id: "2", title: "Live Music", start: "2026-04-20", description: "Acoustic evening." },
];

export default function AdminEventsPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(SAMPLE);
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);
  const [saved, setSaved] = useState(false);

  function openNew() {
    setEditing({ title: "", start: "", description: "", location: "" });
  }

  function openEdit(event: CalendarEvent) {
    setEditing({ ...event });
  }

  function saveEvent() {
    if (!editing?.title || !editing?.start) return;
    const isNew = !editing.id;
    const event: CalendarEvent = {
      id: editing.id ?? newId(),
      title: editing.title,
      start: editing.start,
      end: editing.end,
      description: editing.description,
      location: editing.location,
      imageUrl: editing.imageUrl,
    };
    if (isNew) {
      setEvents((prev) => [...prev, event]);
    } else {
      setEvents((prev) => prev.map((e) => e.id === event.id ? event : e));
    }
    setEditing(null);
  }

  function removeEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
          Events
        </h1>
        <div className="flex gap-2">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 border border-[#C97D5A]/40 text-[#C97D5A] text-xs tracking-widest uppercase hover:bg-[#C97D5A]/10 transition-colors"
          >
            <Plus size={14} /> Add Event
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
          >
            <Save size={14} />
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2 mb-6">
        {events.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No events yet</p>
        )}
        {events.sort((a, b) => a.start.localeCompare(b.start)).map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-3 p-4 bg-white border border-gray-200 cursor-pointer hover:border-[#C97D5A]/40 transition-colors rounded-sm"
            onClick={() => openEdit(event)}
          >
            <Calendar size={15} className="text-[#C97D5A] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 text-sm tracking-wider">{event.title}</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {new Date(event.start).toLocaleDateString("en-US", {
                  weekday: "short", month: "long", day: "numeric", year: "numeric",
                })}
              </p>
              {event.description && (
                <p className="text-gray-400 text-xs mt-1 truncate">{event.description}</p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeEvent(event.id); }}
              className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Edit modal */}
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
                  <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editing[field] as string) ?? ""}
                    onChange={(e) => setEditing((v) => ({ ...v, [field]: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none focus:border-[#C97D5A]/50 rounded-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing((v) => ({ ...v, description: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-2 outline-none resize-none focus:border-[#C97D5A]/50 rounded-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={saveEvent}
                className="flex-1 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
              >
                {editing.id ? "Update" : "Add"} Event
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 border border-gray-200 text-gray-500 text-xs tracking-widest uppercase hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
