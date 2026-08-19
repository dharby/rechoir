// Web Push helpers — service worker registration + VAPID subscription
import { supabase } from "@/integrations/supabase/client";

let cachedVapidKey: string | null = null;
async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;
  const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
  if (error || !data?.publicKey) return "";
  cachedVapidKey = data.publicKey;
  return cachedVapidKey || "";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost = typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
   window.location.hostname.includes("lovableproject.com"));

export function canUseBackgroundPush(): boolean {
  return pushSupported() && !inIframe && !isPreviewHost;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && typeof Notification !== "undefined";
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  if (inIframe || isPreviewHost) {
    // Avoid SW in editor preview (caches break HMR)
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
    } catch {}
    return null;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function subscribeToPush(userId: string, teamId: string | null): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission === "denied") return false;
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
  }
  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
  }
  const json = sub.toJSON() as any;
  const endpoint = sub.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      team_id: teamId,
      endpoint, p256dh, auth,
      user_agent: navigator.userAgent,
    } as any,
    { onConflict: "endpoint" }
  );
  if (error) return false;
  localStorage.setItem("rechoir.notif", "1");
  return true;
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
  } catch {}
  localStorage.removeItem("rechoir.notif");
}

export function pushEnabled(): boolean {
  return localStorage.getItem("rechoir.notif") === "1";
}
