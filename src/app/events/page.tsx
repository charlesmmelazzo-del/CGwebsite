import { getEventsData } from "@/lib/eventsdata";
import { getPageHeader } from "@/lib/pageheaders";
import EventsPageClient from "./EventsPageClient";

export default async function EventsPage() {
  const [events, header] = await Promise.all([
    getEventsData(),
    getPageHeader("events"),
  ]);
  return <EventsPageClient initialEvents={events} header={header} />;
}
