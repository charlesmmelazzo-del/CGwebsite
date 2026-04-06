import { getEventsData } from "@/lib/eventsdata";
import EventsPageClient from "./EventsPageClient";

export default async function EventsPage() {
  const events = await getEventsData();
  return <EventsPageClient initialEvents={events} />;
}
