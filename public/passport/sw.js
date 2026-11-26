// Passport's background helper. Registered only from Passport pages, with scope "/passport" (the
// Service-Worker-Allowed header in next.config.mjs allows that scope), so it never controls the rest of the site.
// It has no fetch handler: no caching and no offline pages, so it never changes how any page loads.
//
// File 13: phone notifications. The Bible sends a short push (a title, one line and a /passport address; never what
// anyone wrote, a price or anyone's surname). This shows it, and a tap opens that place in Passport.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ICON = "/passport/icons/icon-192.png";
/** Only a Passport address on this site; anything else opens Passport's Home. */
function safeUrl(u) {
  return typeof u === "string" && /^\/passport(\/[A-Za-z0-9/_?=&.-]*)?$/.test(u) && !u.includes("..") && !u.includes("//") ? u : "/passport";
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" && data.title ? data.title.slice(0, 80) : "Common Good Passport";
  const body = typeof data.body === "string" ? data.body.slice(0, 160) : "";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: ICON,
    badge: ICON,
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { url: safeUrl(data.url) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // An open Passport window goes to the place; otherwise a new one opens there.
    for (const c of all) {
      try {
        if (new URL(c.url).pathname.startsWith("/passport") && "navigate" in c) {
          await c.focus();
          await c.navigate(url);
          return;
        }
      } catch { /* not controlled by this helper: open a new window below */ }
    }
    return self.clients.openWindow(url);
  })());
});
