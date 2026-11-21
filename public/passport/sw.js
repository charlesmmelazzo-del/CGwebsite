// Passport's background helper (file 01). It exists so phones treat Passport as
// an installable app, and does nothing else: no caching, no offline pages and no
// notifications yet (notifications are file 06).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
