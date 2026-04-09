"use client";

import { useState } from "react";
import Image from "next/image";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import type { CalendarEvent, FormField, PageHeaderData, HostSection } from "@/types";
import { THEMES } from "@/lib/themes";
import type { ThemeName } from "@/lib/themes";
import clsx from "clsx";
import { Download, FileText, MapPin, ChevronDown, CalendarPlus } from "lucide-react";

type TabId = "upcoming" | "host";

const DEFAULT_HOST_SECTIONS: HostSection[] = [
  {
    id: "h1",
    order: 0,
    type: "text",
    title: "Host Your Event at Common Good",
    body: "Whether it's an intimate dinner, a corporate gathering, or a celebration of life's biggest moments — Common Good Cocktail House is the perfect backdrop.\n\nWe offer private and semi-private event options with customized cocktail menus, exceptional service, and an ambiance that makes every occasion memorable.",
  },
];

const HOST_FORM_FIELDS: FormField[] = [
  { id: "name",    label: "Your Name",               type: "text",     required: true },
  { id: "email",   label: "Email Address",            type: "email",    required: true },
  { id: "phone",   label: "Phone Number",             type: "phone",    required: false },
  { id: "date",    label: "Event Date",               type: "text",     required: false },
  { id: "guests",  label: "Estimated Guest Count",    type: "text",     required: false },
  { id: "details", label: "Tell Us About Your Event", type: "textarea", required: false },
];

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: d.getDate().toString(),
    year: d.getFullYear().toString(),
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

function buildICS(event: CalendarEvent): string {
  const pad = (s: string) => s.replace(/-/g, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, "\\$&").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Common Good Cocktail House//Events//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${pad(event.start)}`,
    ...(event.end ? [`DTEND;VALUE=DATE:${pad(event.end)}`] : []),
    `SUMMARY:${esc(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${esc(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${esc(event.location)}`] : []),
    `UID:${event.id}@commongoodcocktailhouse.com`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

function EventCard({ event, theme }: { event: CalendarEvent; theme: { text: string; muted: string } }) {
  const [expanded, setExpanded] = useState(false);
  const start = formatEventDate(event.start);
  const isMultiDay = !!(event.end && event.end !== event.start);
  const end = isMultiDay ? formatEventDate(event.end!) : null;
  const hasLink = !!event.linkUrl;
  const linkLabel = event.linkLabel?.trim() || "More Info";
  const icsHref = buildICS(event);

  return (
    <div style={{ borderBottom: `1px solid ${theme.muted}20` }}>
      {/* ── Main row (always visible) ── */}
      <div
        className="flex gap-4 md:gap-6 px-4 md:px-8 py-6 cursor-pointer select-none"
        onClick={() => setExpanded((x) => !x)}
        role="button"
        aria-expanded={expanded}
      >
        {/* Date column */}
        <div className="shrink-0 text-center w-14">
          <p className="text-[10px] tracking-widest uppercase" style={{ color: "#C97D5A" }}>{start.month}</p>
          <p className="text-3xl leading-none my-0.5" style={{ fontFamily: "var(--font-display)", color: theme.text }}>{start.day}</p>
          <p className="text-[9px] tracking-wider opacity-40" style={{ color: theme.text }}>{start.year}</p>
          {isMultiDay && end && (
            <>
              <div className="w-3 h-px mx-auto my-1.5" style={{ backgroundColor: theme.muted, opacity: 0.3 }} />
              <p className="text-[10px] tracking-widest uppercase" style={{ color: "#C97D5A" }}>{end.month}</p>
              <p className="text-xl leading-none" style={{ fontFamily: "var(--font-display)", color: theme.text }}>{end.day}</p>
            </>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] tracking-widest uppercase opacity-40 mb-1.5" style={{ color: theme.text }}>{start.weekday}</p>
          <h3
            className="text-xl tracking-wide leading-snug mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text }}
          >
            {event.title}
          </h3>
          {event.location && (
            <p className="flex items-center gap-1.5 text-xs opacity-60 mb-2" style={{ color: theme.text }}>
              <MapPin size={11} className="shrink-0" />
              {event.location}
            </p>
          )}
          {event.description && (
            <p
              className={clsx("text-sm leading-relaxed opacity-70", !expanded && "line-clamp-2")}
              style={{ color: theme.text }}
            >
              {event.description}
            </p>
          )}
        </div>

        {/* Thumbnail (collapsed only) + expand chevron */}
        <div className="shrink-0 flex flex-col items-end gap-3">
          {!expanded && event.imageUrl && (
            <div className="hidden sm:block">
              <Image
                src={event.imageUrl}
                alt={event.title}
                width={80}
                height={80}
                unoptimized
                className="object-cover rounded-sm opacity-70"
                style={{ width: 80, height: 80 }}
              />
            </div>
          )}
          <ChevronDown
            size={16}
            className="opacity-40 transition-transform duration-200 mt-auto"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              color: theme.text,
            }}
          />
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="px-4 md:px-8 pb-6 animate-fade-in">
          {/* Full image */}
          {event.imageUrl && (
            <div className="mb-5">
              <Image
                src={event.imageUrl}
                alt={event.title}
                width={680}
                height={340}
                unoptimized
                className="w-full max-h-64 object-cover rounded-sm opacity-90"
              />
            </div>
          )}

          {/* Action row: Add to Calendar + CTA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
            <a
              href={icsHref}
              download={`${event.title.replace(/\s+/g, "-")}.ics`}
              className="inline-flex items-center gap-2 text-xs tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: theme.muted }}
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarPlus size={13} />
              Add to Calendar
            </a>

            {hasLink && (
              <a
                href={event.linkUrl!}
                target={event.linkNewTab !== false ? "_blank" : undefined}
                rel={event.linkNewTab !== false ? "noopener noreferrer" : undefined}
                className="sm:ml-auto inline-block w-full sm:w-auto text-center px-5 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {linkLabel}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HostTextSection({ section, theme }: { section: HostSection; theme: { text: string; muted: string } }) {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      {section.title && (
        <h3
          className="text-2xl md:text-3xl tracking-wider mb-4"
          style={{ fontFamily: "var(--font-display)", color: theme.text }}
        >
          {section.title}
        </h3>
      )}
      {section.body && (
        <div className="space-y-4">
          {section.body.split("\n\n").map((para, i) => (
            <p key={i} className="leading-relaxed opacity-80" style={{ color: theme.text }}>
              {para}
            </p>
          ))}
        </div>
      )}
      {section.buttonLabel && section.buttonUrl && (
        <a
          href={section.buttonUrl}
          target={section.buttonNewTab ? "_blank" : undefined}
          rel={section.buttonNewTab ? "noopener noreferrer" : undefined}
          className="inline-block mt-6 px-6 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
        >
          {section.buttonLabel}
        </a>
      )}
    </div>
  );
}

function HostPdfSection({ section, theme }: { section: HostSection; theme: { text: string; muted: string } }) {
  if (!section.pdfUrl) return null;
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      {section.pdfTitle && (
        <h3
          className="text-2xl tracking-wider mb-4 flex items-center gap-3"
          style={{ fontFamily: "var(--font-display)", color: theme.text }}
        >
          <FileText size={20} className="opacity-60" />
          {section.pdfTitle}
        </h3>
      )}
      <div className="rounded-sm overflow-hidden border mb-4" style={{ borderColor: `${theme.muted}40` }}>
        <iframe
          src={section.pdfUrl}
          className="w-full"
          style={{ height: "500px" }}
          title={section.pdfTitle ?? "PDF Document"}
        />
      </div>
      <a
        href={section.pdfUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#C97D5A] text-white text-xs tracking-widest uppercase hover:bg-[#b86d4a] transition-colors"
      >
        <Download size={13} />
        {section.pdfDownloadLabel || "Download PDF"}
      </a>
    </div>
  );
}

export default function EventsPageClient({
  initialEvents,
  header,
  hasFutureEvents,
}: {
  initialEvents: CalendarEvent[];
  header: PageHeaderData;
  hasFutureEvents: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(hasFutureEvents ? "upcoming" : "host");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const themeName: ThemeName = header.theme ?? "green";
  const theme = THEMES[themeName];

  const hostSections = header.hostSections?.length ? header.hostSections : DEFAULT_HOST_SECTIONS;

  const upcomingLabel = header.tabs?.find((t) => t.id === "upcoming")?.label ?? "Upcoming Events";
  const hostLabel = header.tabs?.find((t) => t.id === "host")?.label ?? "Host Your Event";

  const visibleTabs: { id: TabId; label: string }[] = [
    ...(hasFutureEvents ? [{ id: "upcoming" as TabId, label: upcomingLabel }] : []),
    { id: "host" as TabId, label: hostLabel },
  ];
  const showTabBar = visibleTabs.length > 1;

  async function handleHostSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: "host-event-inquiry",
          formName: "Host Your Event Inquiry",
          data: formValues,
        }),
      });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageThemeWrapper fixedTheme={themeName} showIllustration bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          {header.title && (
            <h1
              className="tracking-widest uppercase mb-2"
              style={{
                fontFamily: "var(--font-display)",
                color: theme.text,
                fontSize: `clamp(1.75rem, 7vw, ${header.titleSize}px)`,
              }}
            >
              {header.title}
            </h1>
          )}
          {header.subtitle && (
            <p className="mt-2 opacity-70" style={{ fontSize: `${header.subtitleSize ?? 14}px` }}>
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tab bar — only when 2+ tabs */}
        {showTabBar && (
          <div className="tab-bar-scroll flex justify-center gap-0 mb-10 px-4">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "px-3 md:px-5 py-2 md:py-2.5 text-xs tracking-widest uppercase whitespace-nowrap transition-all duration-200",
                  activeTab === tab.id
                    ? "border-b-2 border-[#C97D5A] text-[#C97D5A]"
                    : "opacity-60 hover:opacity-90"
                )}
                style={{ color: activeTab === tab.id ? "#C97D5A" : theme.text }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Upcoming Events list */}
        {activeTab === "upcoming" && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <div style={{ borderTop: `1px solid ${theme.muted}20` }}>
              {initialEvents.map((event) => (
                <EventCard key={event.id} event={event} theme={theme} />
              ))}
            </div>
          </div>
        )}

        {/* Host Your Event */}
        {activeTab === "host" && (
          <div className="animate-fade-in divide-y" style={{ borderColor: `${theme.muted}20` }}>
            {hostSections.sort((a, b) => a.order - b.order).map((section) =>
              section.type === "pdf"
                ? <HostPdfSection key={section.id} section={section} theme={theme} />
                : <HostTextSection key={section.id} section={section} theme={theme} />
            )}

            {/* Inquiry Form */}
            <div className="max-w-lg mx-auto px-4 md:px-6 pb-16 pt-8">
              <h3
                className="text-2xl text-center mb-6 tracking-wider"
                style={{ fontFamily: "var(--font-display)", color: theme.text }}
              >
                Send Us a Message
              </h3>
              {submitted ? (
                <div className="text-center py-8">
                  <p className="text-lg tracking-wider">Thank you!</p>
                  <p className="text-sm mt-2 opacity-60">We&apos;ll be in touch about your event soon.</p>
                </div>
              ) : (
                <form onSubmit={handleHostSubmit} className="space-y-4">
                  {HOST_FORM_FIELDS.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs tracking-wider mb-1 uppercase" style={{ color: theme.muted }}>
                        {field.label}{field.required && " *"}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          required={field.required}
                          rows={4}
                          value={formValues[field.id] ?? ""}
                          onChange={(e) => setFormValues((v) => ({ ...v, [field.id]: e.target.value }))}
                          className="w-full bg-transparent border-b py-1.5 text-sm resize-none outline-none transition-colors"
                          style={{ borderColor: `${theme.muted}50`, color: theme.text }}
                        />
                      ) : (
                        <input
                          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
                          required={field.required}
                          value={formValues[field.id] ?? ""}
                          onChange={(e) => setFormValues((v) => ({ ...v, [field.id]: e.target.value }))}
                          className="w-full bg-transparent border-b py-1.5 text-sm outline-none transition-colors"
                          style={{ borderColor: `${theme.muted}50`, color: theme.text }}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-6 w-full py-3 bg-[#C97D5A] text-white text-sm tracking-widest uppercase hover:bg-[#b86d4a] transition-colors disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send Inquiry"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </PageThemeWrapper>
  );
}
