// Per-chat notification preferences (in-app banner + sound suppression).
// Stored in localStorage so users control their own device without DB writes.
// Push notifications still arrive at the OS level — quiet hours are honoured
// for in-app delivery; OS-level Do Not Disturb governs the system notification.
import { useEffect, useState } from "react";

const MUTE_DM_KEY = "rechoir.notif.mute.dm";       // JSON array of peer ids
const MUTE_GROUP_KEY = "rechoir.notif.mute.group"; // "1" = muted
const QUIET_START_KEY = "rechoir.notif.quiet.start"; // "22:00"
const QUIET_END_KEY = "rechoir.notif.quiet.end";     // "07:00"
const QUIET_ON_KEY = "rechoir.notif.quiet.on";       // "1" / "0"

const CHANGE_EVT = "rechoir-chat-pref-change";

function emitChange() {
  try { window.dispatchEvent(new CustomEvent(CHANGE_EVT)); } catch {}
}

// --- Group chat (single team room) ---
export function groupChatMuted(): boolean {
  return localStorage.getItem(MUTE_GROUP_KEY) === "1";
}
export function setGroupChatMuted(on: boolean) {
  localStorage.setItem(MUTE_GROUP_KEY, on ? "1" : "0");
  emitChange();
}

// --- DM peers ---
function readMutedPeers(): string[] {
  try { return JSON.parse(localStorage.getItem(MUTE_DM_KEY) || "[]"); }
  catch { return []; }
}
export function dmMuted(peerId: string): boolean {
  return readMutedPeers().includes(peerId);
}
export function setDmMuted(peerId: string, on: boolean) {
  const set = new Set(readMutedPeers());
  if (on) set.add(peerId); else set.delete(peerId);
  localStorage.setItem(MUTE_DM_KEY, JSON.stringify(Array.from(set)));
  emitChange();
}
export function getMutedPeers(): string[] {
  return readMutedPeers();
}

// --- Quiet hours ---
export function getQuietHours() {
  return {
    enabled: localStorage.getItem(QUIET_ON_KEY) === "1",
    start: localStorage.getItem(QUIET_START_KEY) || "22:00",
    end: localStorage.getItem(QUIET_END_KEY) || "07:00",
  };
}
export function setQuietHours(opts: { enabled?: boolean; start?: string; end?: string }) {
  if (opts.enabled !== undefined) localStorage.setItem(QUIET_ON_KEY, opts.enabled ? "1" : "0");
  if (opts.start !== undefined) localStorage.setItem(QUIET_START_KEY, opts.start);
  if (opts.end !== undefined) localStorage.setItem(QUIET_END_KEY, opts.end);
  emitChange();
}

/** True if right now falls inside the configured quiet window. */
export function inQuietHours(now = new Date()): boolean {
  const { enabled, start, end } = getQuietHours();
  if (!enabled) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e); // overnight window
}

/** True if the in-app banner/sound should be suppressed for a chat notification. */
export function shouldSuppressChatBanner(kind: "group" | "dm", peerId?: string): boolean {
  if (inQuietHours()) return true;
  if (kind === "group") return groupChatMuted();
  if (kind === "dm" && peerId) return dmMuted(peerId);
  return false;
}

/** React hook — re-renders when any chat preference changes (same-tab or other tab). */
export function useChatPrefs() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const onAny = () => setV((x) => x + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return setV((x) => x + 1);
      if ([MUTE_DM_KEY, MUTE_GROUP_KEY, QUIET_START_KEY, QUIET_END_KEY, QUIET_ON_KEY].includes(e.key)) {
        setV((x) => x + 1);
      }
    };
    window.addEventListener(CHANGE_EVT, onAny);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVT, onAny);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return v;
}
