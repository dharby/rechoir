/* RECHOIR service worker — Web Push (cross-browser, stacking, badge sync) */
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function setBadge(n) {
  try {
    if (n > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
    else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch {}
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch {
    try { data = { title: "RECHOIR", body: event.data ? event.data.text() : "" }; }
    catch { data = { title: "RECHOIR", body: "" }; }
  }
  const title = data.title || "RECHOIR";
  const tag = data.tag || "rechoir";
  const url = data.url || "/dashboard";

  event.waitUntil((async () => {
    // Stacking: if a notification with the same tag exists, increment counter
    let count = 1;
    try {
      const existing = await self.registration.getNotifications({ tag });
      for (const n of existing) {
        const c = (n.data && n.data.count) || 1;
        count = c + 1;
        n.close();
      }
    } catch {}

    const isStacked = count > 1;
    const displayTitle = isStacked ? `${title} (${count})` : title;
    const displayBody = isStacked
      ? `${count} new updates · ${data.body || ""}`.trim()
      : (data.body || "");

    await self.registration.showNotification(displayTitle, {
      body: displayBody,
      icon: data.icon || "/rechoir-icon.png",
      badge: data.badge || "/rechoir-icon.png",
      data: { url, count, tag },
      tag,
      renotify: true,
      requireInteraction: false,
      vibrate: [80, 40, 80],
    });

    // Update app badge with total unread notifications
    try {
      const all = await self.registration.getNotifications();
      const total = all.reduce((s, n) => s + ((n.data && n.data.count) || 1), 0);
      await setBadge(total);
    } catch {}

    // Notify open clients so the in-app feed refreshes immediately
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "push", tag, url, count }));
    } catch {}
  })());
});

self.addEventListener("notificationclick", (event) => {
  const tag = event.notification.tag;
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil((async () => {
    // Close any other notifications in the same stack
    try {
      const same = await self.registration.getNotifications({ tag });
      same.forEach((n) => n.close());
    } catch {}

    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    let focused = null;
    for (const c of all) {
      try {
        const url = new URL(c.url);
        if (url.origin === self.location.origin) {
          await c.focus();
          // Prefer client-side React Router navigation (postMessage) to keep
          // SPA state. Falls back to a full navigate if the app isn't listening.
          c.postMessage({ type: "navigate", url: target, tag });
          focused = c;
          break;
        }
      } catch {}
    }
    if (!focused) await self.clients.openWindow(target);

    // Tell clients to mark matching notifications as read
    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "mark-read", tag, url: target }));
    } catch {}

    // Recompute badge
    try {
      const remaining = await self.registration.getNotifications();
      const total = remaining.reduce((s, n) => s + ((n.data && n.data.count) || 1), 0);
      await setBadge(total);
    } catch {}
  })());
});

self.addEventListener("notificationclose", (event) => {
  event.waitUntil((async () => {
    try {
      const remaining = await self.registration.getNotifications();
      const total = remaining.reduce((s, n) => s + ((n.data && n.data.count) || 1), 0);
      await setBadge(total);
    } catch {}
  })());
});
