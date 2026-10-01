import type { Metadata } from "next";
import { getEventsData } from "@/lib/eventsdata";
import { getPageHeader } from "@/lib/pageheaders";
import { getEventsPageCompetitions } from "@/lib/compete/data";
import EventsPageClient from "./EventsPageClient";

export const metadata: Metadata = {
  title: "Events & Private Bookings",
  description:
    "Upcoming events and private event bookings at Common Good Cocktail House in Glen Ellyn, IL. Host your celebration with us.",
  alternates: { canonical: "/events" },
};

export default async function EventsPage() {
  const [{ events, hasFutureEvents }, header, competitions] = await Promise.all([
    getEventsData(),
    getPageHeader("events"),
    getEventsPageCompetitions(),
  ]);
  return (
    <EventsPageClient
      initialEvents={events}
      header={header}
      hasFutureEvents={hasFutureEvents}
      competitions={competitions}
    />
  );
}
