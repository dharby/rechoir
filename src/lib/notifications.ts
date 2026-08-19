// Unified notification helper — writes a row to public.notifications
// (in-app feed) and best-effort fires the Web Push fan-out.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTeamPush } from "@/lib/notify";

export type NotifCategory = "broadcast" | "chat" | "reminder" | "announcement" | "general";

const CAT_KEY: Record<NotifCategory, string> = {
  broadcast: "rechoir.notif.broadcasts",
  chat: "rechoir.notif.chat",
  reminder: "rechoir.notif.reminders",
  announcement: "rechoir.notif.announcements",
  general: "rechoir.notif.announcements",
};

const CHANGE_EVT = "rechoir-notif-pref-change";

export function categoryEnabled(cat: NotifCategory): boolean {
  // default ON
  const v = localStorage.getItem(CAT_KEY[cat]);
  return v === null ? true : v === "1";
}

export function setCategoryEnabled(cat: NotifCategory, on: boolean) {
  localStorage.setItem(CAT_KEY[cat], on ? "1" : "0");
  // notify other tabs/windows
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVT, { detail: { cat, on } }));
  } catch {}
}

/** Subscribe to category preference changes across tabs (storage) and same-tab (custom event). */
export function useCategoryPrefs() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) { setVersion((v) => v + 1); return; }
      if (Object.values(CAT_KEY).includes(e.key)) setVersion((v) => v + 1);
    };
    const onLocal = () => setVersion((v) => v + 1);
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVT, onLocal as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVT, onLocal as EventListener);
    };
  }, []);
  return version;
}

/** Write notification rows for many users at once. */
export async function notifyUsers(opts: {
  userIds: string[];
  title: string;
  body?: string;
  link?: string;
  category?: NotifCategory;
  priority?: "normal" | "high";
}) {
  const rows = opts.userIds.map((uid) => ({
    user_id: uid,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
    category: opts.category ?? "general",
    priority: opts.priority ?? "normal",
  }));
  if (!rows.length) return;
  await supabase.from("notifications").insert(rows as any);
}

/** Fan out: persist + push, scoped to one team's members. */
export async function notifyTeam(opts: {
  teamId: string;
  excludeUserId?: string;
  title: string;
  body?: string;
  link?: string;
  category?: NotifCategory;
  priority?: "normal" | "high";
  tag?: string;
}) {
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .eq("team_id", opts.teamId);
  const ids = (members ?? [])
    .map((m: any) => m.id)
    .filter((id) => id && id !== opts.excludeUserId);

  await notifyUsers({
    userIds: ids,
    title: opts.title,
    body: opts.body,
    link: opts.link,
    category: opts.category,
    priority: opts.priority,
  });

  await sendTeamPush({
    teamId: opts.teamId,
    excludeUserId: opts.excludeUserId,
    title: opts.title,
    body: opts.body,
    url: opts.link,
    tag: opts.tag ?? opts.category ?? "rechoir",
  });
}
