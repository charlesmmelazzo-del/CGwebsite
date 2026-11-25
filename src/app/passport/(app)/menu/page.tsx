import { tabPage } from "@/lib/passport/tabPage";

export const dynamic = "force-dynamic";

/** File 06: the Menu tab. The app frame draws it (it stays open in the background); this address only checks sign-in. */
export default function MenuRoute() {
  return tabPage();
}
