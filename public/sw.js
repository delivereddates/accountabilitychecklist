/* Service worker for Web Push. Deliberately NO fetch handler — it never
 * intercepts or caches app requests; it only displays notifications. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Accountability", {
      body: data.body || "Time to check in on your tasks.",
      tag: data.tag || "accountability", // 11/17/21 replace each other
      renotify: true,
      icon: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const w of wins) {
        if ("focus" in w) return w.focus();
      }
      await self.clients.openWindow(event.notification.data?.url || "/");
    })(),
  );
});
