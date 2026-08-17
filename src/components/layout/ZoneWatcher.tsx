"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Keeps `<body data-zone>` in step with the current route.
 *
 * The root layout is a server component that stays mounted across client-side
 * navigations, so it can't re-decide whether to show the site header and footer
 * when a guest clicks from the footer into the Pop Up Zone — or back out of it.
 * The server sets data-zone correctly for the first paint; this keeps it right
 * for every soft navigation afterwards, with the actual hiding done in CSS.
 */
export default function ZoneWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    const inPopupZone = pathname?.startsWith("/popup") ?? false;
    if (inPopupZone) document.body.dataset.zone = "popup";
    else delete document.body.dataset.zone;
  }, [pathname]);

  return null;
}
