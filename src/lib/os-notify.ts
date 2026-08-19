// Unified OS notification helper.
// Uses the ServiceWorker's showNotification() so foreground events surface
// as REAL system notifications (with stacking/tag), matching how Web Push
// renders them when the tab is closed. Falls back to window.Notification
// in environments where the SW isn't registered (e.g. Lovable preview).

const ICON = "/rechoir-icon.png";

export type OsNotifyOpts = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  // When true, replaces an existing notification with the same tag.
  renotify?: boolean;
};

export function osPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function showOsNotification(opts: OsNotifyOpts): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;

  const payload = {
    body: opts.body || "",
    icon: ICON,
    badge: ICON,
    tag: opts.tag || "rechoir",
    renotify: opts.renotify ?? true,
    data: { url: opts.url || "/dashboard", tag: opts.tag || "rechoir" },
    vibrate: [80, 40, 80],
  } as any;

  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(opts.title, payload);
      return true;
    }
  } catch {}

  try {
    const n = new Notification(opts.title, payload);
    n.onclick = () => {
      try { window.focus(); } catch {}
      if (opts.url) window.location.href = opts.url;
    };
    return true;
  } catch {
    return false;
  }
}
