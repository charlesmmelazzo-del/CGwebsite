"use client";

import { useState } from "react";
import PageThemeWrapper from "@/components/layout/PageThemeWrapper";
import EventsCalendar from "@/components/ui/EventsCalendar";
import ContentSectionBlock from "@/components/ui/ContentSection";
import type { CalendarEvent, ContentSection, FormField, PageHeaderData } from "@/types";
import { THEMES } from "@/lib/themes";
import clsx from "clsx";

type TabId = "upcoming" | "host";

const HOST_SECTIONS: ContentSection[] = [
  {
    id: "h1",
    order: 0,
    title: "Host Your Event at Common Good",
    body: "Whether it's an intimate dinner, a corporate gathering, or a celebration of life's biggest moments — Common Good Cocktail House is the perfect backdrop.\n\nWe offer private and semi-private event options with customized cocktail menus, exceptional service, and an ambiance that makes every occasion memorable.",
  },
];

const HOST_FORM_FIELDS: FormField[] = [
  { id: "name", label: "Your Name", type: "text", required: true },
  { id: "email", label: "Email Address", type: "email", required: true },
  { id: "phone", label: "Phone Number", type: "phone", required: false },
  { id: "date", label: "Event Date", type: "text", required: false },
  { id: "guests", label: "Estimated Guest Count", type: "text", required: false },
  { id: "details", label: "Tell Us About Your Event", type: "textarea", required: false },
];

export default function EventsPageClient({ initialEvents, header }: { initialEvents: CalendarEvent[]; header: PageHeaderData }) {
  const [activeTab, setActiveTab] = useState<TabId>("upcoming");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const theme = THEMES.green;

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
    { id: "host" as TabId,     label: header.tabs?.find((t) => t.id === "host")?.label ?? "Host Your Event" },
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
          <div className="animate-fade-in">
            {HOST_SECTIONS.map((section) => (
              <ContentSectionBlock
                key={section.id}
                section={section}
                textColor={theme.text}
                mutedColor={theme.muted}
              />
            ))}

            {/* Inquiry Form */}
            <div className="max-w-lg mx-auto px-6 pb-16">
              <h3
                className="text-2xl text-center mb-6 tracking-wider"
                style={{ fontFamily: "var(--font-display)", color: theme.text }}
              >
                Send Us a Message
              </h3>

              {submitted ? (
                <div className="text-center py-8">
                  <p className="text-lg tracking-wider">Thank you!</p>
                  <p className="text-sm mt-2 opacity-60">
                    We&apos;ll be in touch about your event soon.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleHostSubmit} className="space-y-4">
                  {HOST_FORM_FIELDS.map((field) => (
                    <div key={field.id}>
                      <label
                        className="block text-xs tracking-wider mb-1 uppercase"
                        style={{ color: theme.muted }}
                      >
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
