import type { Metadata } from "next";
import { getEventsData } from "@/lib/eventsdata";
import { getPageHeader } from "@/lib/pageheaders";
import { getEventsPageCompetitions } from "@/lib/compete/data";
import { getSiteSettings } from "@/lib/siteconfig";
import { reserveEnabled } from "@/lib/reserve/enabled";
import { getEventStatuses } from "@/lib/reserve/bible";
import type { EventStatus } from "@/lib/reserve/types";
import EventsPageClient from "./EventsPageClient";

export const metadata: Metadata = {
  title: "Events & Private Bookings",
  description:
    "Upcoming events and private event bookings at Common Good Cocktail House in Glen Ellyn, IL. Host your celebration with us.",
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  const [{ events, hasFutureEvents }, header, competitions, settings] = await Promise.all([
    getEventsData(),
    getPageHeader("events"),
    getEventsPageCompetitions(),
    getSiteSettings(),
  ]);

  // Which events take table reservations (kept in the CG Bible, keyed by the
  // website event id). Recurring occurrences never do. If the Bible can't be
  // reached the page renders exactly as it would without reservations.
  let reservations: Record<string, EventStatus> = {};
  if (reserveEnabled()) {
    try {
      reservations = await getEventStatuses(events.filter((e) => !e.seriesId && e.recurrence !== "weekly").map((e) => e.id));
    } catch {
      reservations = {};
    }
  }

  return (
    <EventsPageClient
      initialEvents={events}
      header={header}
      hasFutureEvents={hasFutureEvents}
      competitions={competitions}
      reservations={reservations}
      phone={settings.phone}
    />
  );
}
