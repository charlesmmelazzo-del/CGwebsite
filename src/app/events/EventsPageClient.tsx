"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import EventsCalendar from "@/components/ui/EventsCalendar";
import type { CalendarEvent, FormField, PageHeaderData, HostSection } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";
import { Download, FileText } from "lucide-react";

type TabId = "upcoming" | "host";

// Fallback sections shown when no DB content has been saved yet
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
  { id: "name",    label: "Your Name",              type: "text",     required: true },
  { id: "email",   label: "Email Address",           type: "email",    required: true },
  { id: "phone",   label: "Phone Number",            type: "phone",    required: false },
  { id: "date",    label: "Event Date",              type: "text",     required: false },
  { id: "guests",  label: "Estimated Guest Count",   type: "text",     required: false },
  { id: "details", label: "Tell Us About Your Event",type: "textarea", required: false },
];

// ─── Section renderers ────────────────────────────────────────────────────────
function HostTextSection({ section, theme }: { section: HostSection; theme: { text: string; muted: string } }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
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
    <div className="max-w-2xl mx-auto px-6 py-8">
      {section.pdfTitle && (
        <h3
          className="text-2xl tracking-wider mb-4 flex items-center gap-3"
          style={{ fontFamily: "var(--font-display)", color: theme.text }}
        >
          <FileText size={20} className="opacity-60" />
          {section.pdfTitle}
        </h3>
      )}

      {/* Inline PDF viewer */}
      <div className="rounded-sm overflow-hidden border mb-4" style={{ borderColor: `${theme.muted}40` }}>
        <iframe
          src={section.pdfUrl}
          className="w-full"
          style={{ height: "500px" }}
          title={section.pdfTitle ?? "PDF Document"}
        />
      </div>

      {/* Download button */}
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
}: {
  initialEvents: CalendarEvent[];
  header: PageHeaderData;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("upcoming");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const theme = THEMES.green;

  const hostSections = (header.hostSections && header.hostSections.length > 0)
    ? header.hostSections
    : DEFAULT_HOST_SECTIONS;

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

  const tabs = [
    { id: "upcoming" as TabId, label: header.tabs?.find((t) => t.id === "upcoming")?.label ?? "Upcoming Events" },
    { id: "host"     as TabId, label: header.tabs?.find((t) => t.id === "host")?.label     ?? "Host Your Event" },
  ];

  return (
    <PageThemeWrapper fixedTheme="green" showIllustration bgImageUrl={header.bgImageUrl}>
      <div className="min-h-screen py-16" style={{ color: theme.text }}>
        <header className="text-center mb-8 px-6">
          <h1
            className="tracking-widest uppercase mb-2"
            style={{ fontFamily: "var(--font-display)", color: theme.text, fontSize: `${header.titleSize}px` }}
          >
            {header.title}
          </h1>
          {header.subtitle && (
            <p className="mt-2 opacity-70" style={{ fontSize: `${header.subtitleSize ?? 14}px` }}>
              {header.subtitle}
            </p>
          )}
          <div className="w-16 h-px mx-auto mt-4" style={{ backgroundColor: theme.muted }} />
        </header>

        {/* Tab selector */}
        <div className="flex justify-center gap-1 mb-10 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-5 py-2.5 text-xs tracking-widest uppercase transition-all duration-200",
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

        {/* Upcoming Events */}
        {activeTab === "upcoming" && (
          <div className="animate-fade-in">
            <EventsCalendar
              events={initialEvents}
              textColor={theme.text}
              bgColor={theme.bg}
            />
          </div>
        )}

        {/* Host Your Event */}
        {activeTab === "host" && (
          <div className="animate-fade-in divide-y" style={{ borderColor: `${theme.muted}20` }}>
            {/* Dynamic sections from admin */}
            {hostSections.sort((a, b) => a.order - b.order).map((section) =>
              section.type === "pdf"
                ? <HostPdfSection key={section.id} section={section} theme={theme} />
                : <HostTextSection key={section.id} section={section} theme={theme} />
            )}

            {/* Inquiry Form — always shown */}
            <div className="max-w-lg mx-auto px-6 pb-16 pt-8">
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
