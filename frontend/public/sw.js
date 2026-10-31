// Intentionally does nothing except exist, so browsers treat the app as installable.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
