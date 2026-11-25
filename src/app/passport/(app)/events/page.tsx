import { tabPage } from "@/lib/passport/tabPage";

export const dynamic = "force-dynamic";

/** File 06: the Events tab. The app frame draws it (it stays open in the background); this address only checks sign-in. */
export default function EventsRoute() {
  return tabPage();
}
