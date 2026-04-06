"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { CalendarEvent } from "@/types";
import { X, Clock, MapPin } from "lucide-react";
import Image from "next/image";

interface Props {
  events: CalendarEvent[];
  textColor: string;
  bgColor: string;
}

export default function EventsCalendar({ events, textColor, bgColor }: Props) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay ?? true,
    extendedProps: e,
  }));

  return (
    <div className="px-4 md:px-8 max-w-4xl mx-auto">
      <style>{`
        .fc { color: ${textColor}; }
        .fc .fc-button { background: transparent; border-color: ${textColor}40; color: ${textColor}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
        .fc .fc-button:hover { background: ${textColor}15; border-color: ${textColor}60; color: ${textColor}; }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active { background: #C97D5A; border-color: #C97D5A; color: white; }
        .fc .fc-col-header-cell { background: ${textColor}10; }
        .fc .fc-col-header-cell-cushion { color: ${textColor}80; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; text-decoration: none; }
        .fc .fc-daygrid-day-number { color: ${textColor}60; text-decoration: none; font-size: 12px; }
        .fc .fc-day-today { background: ${textColor}08 !important; }
        .fc .fc-event { background: #C97D5A; border-color: #C97D5A; cursor: pointer; font-size: 11px; }
        .fc .fc-event:hover { background: #b86d4a; }
        .fc-theme-standard .fc-scrollgrid { border-color: ${textColor}20; }
        .fc-theme-standard td, .fc-theme-standard th { border-color: ${textColor}15; }
        .fc .fc-toolbar-title { font-family: var(--font-display); font-size: 1.5rem; letter-spacing: 0.1em; color: ${textColor}; }
      `}</style>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={fcEvents}
        eventClick={(info) => setSelected(info.event.extendedProps as CalendarEvent)}
        headerToolbar={{
          left: "prev",
          center: "title",
          right: "next today",
        }}
        height="auto"
      />

      {/* Event detail modal */}
      {selected && (
        <div className="iframe-modal-overlay" onClick={() => setSelected(null)}>
          <div
            className="relative max-w-lg w-full mx-4 rounded-sm overflow-hidden"
            style={{ backgroundColor: bgColor }}
            onClick={(e) => e.stopPropagation()}
          >
            {selected.imageUrl && (
              <div className="relative h-48">
                <Image
                  src={selected.imageUrl}
                  alt={selected.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-6" style={{ color: textColor }}>
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 opacity-60 hover:opacity-100"
              >
                <X size={18} />
              </button>
              <h3
                className="text-2xl mb-3 tracking-wider"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selected.title}
              </h3>
              <div className="space-y-1.5 text-sm opacity-70">
                <div className="flex items-center gap-2">
                  <Clock size={13} />
                  <span>{new Date(selected.start).toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric"
                  })}</span>
                </div>
                {selected.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={13} />
                    <span>{selected.location}</span>
                  </div>
                )}
              </div>
              {selected.description && (
                <p className="mt-4 text-sm leading-relaxed opacity-80">{selected.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
