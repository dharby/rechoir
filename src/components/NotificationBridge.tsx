import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { categoryEnabled, notifyUsers, type NotifCategory } from "@/lib/notifications";
import { playPing } from "@/lib/sound";
import { shouldSuppressChatBanner, inQuietHours } from "@/lib/chat-prefs";
import { showOsNotification } from "@/lib/os-notify";
import { sendUserPush } from "@/lib/notify";

const fmtNGN = (n: number) =>
  `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Realtime → OS notification bridge.
 *
 * All in-app notifications fire as REAL operating-system notifications via
 * the registered ServiceWorker (`registration.showNotification`). This means:
 *  - Foreground events look identical to background Web Push deliveries.
 *  - Stacking/replacement is handled by the OS via the `tag` field.
 *  - No in-app floating banners — the OS owns the surface.
 *
 * Suppression rules:
 *  - Skip chat OS-notif when actively on `/chat`.
 *  - Skip DM OS-notif when actively in that DM thread.
 *  - Respect per-category preferences and quiet hours.
 */
export function NotificationBridge() {
  const { team, profile } = useAuth();
  const mountedAt = useRef<number>(Date.now());
  const location = useLocation();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  const locationRef = useRef(location.pathname + location.search);
  useEffect(() => { locationRef.current = location.pathname + location.search; }, [location.pathname, location.search]);

  // Always listen for service-worker `navigate` messages (deep links from OS
  // notification taps), even before team/profile are loaded.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const msg: any = e.data;
      if (!msg) return;
      if (msg.type === "navigate" && typeof msg.url === "string") {
        try {
          const u = new URL(msg.url, window.location.origin);
          navigateRef.current(u.pathname + u.search + u.hash);
        } catch {
          navigateRef.current(msg.url);
        }
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener?.("message", onMsg);
  }, []);

  useEffect(() => {
    if (!team?.id || !profile?.id) return;
    mountedAt.current = Date.now();

    const fire = (
      cat: NotifCategory,
      title: string,
      body: string,
      url?: string,
      tag?: string,
    ) => {
      if (!categoryEnabled(cat)) return;
      if (cat === "chat" && locationRef.current.startsWith("/chat")) return;
      if (inQuietHours()) return;
      playPing();
      showOsNotification({ title, body, url, tag });
    };

    const isFresh = (createdAt?: string) => {
      if (!createdAt) return true;
      return new Date(createdAt).getTime() >= mountedAt.current - 1000;
    };

    const channel = supabase.channel(`notify:${team.id}:${profile.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcasts", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const b: any = payload.new;
          if (b.sender_id === profile.id) return;
          fire("broadcast", `📣 ${b.title}`, b.body?.slice(0, 140) || "", "/broadcast", `broadcast:${b.sender_id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `team_id=eq.${team.id}` },
        async (payload) => {
          const m: any = payload.new;
          if (m.sender_id === profile.id) return;
          const mentions: string[] = m.mentions || [];
          const isMention = mentions.includes("@all") || mentions.includes(profile.id);
          if (!isMention) return;
          if (shouldSuppressChatBanner("group")) return;
          const { data: sender } = await supabase
            .from("profiles").select("full_name, email").eq("id", m.sender_id).maybeSingle();
          const senderName = sender?.full_name || sender?.email || "Someone";
          await notifyUsers({
            userIds: [profile.id],
            title: `💬 ${senderName} mentioned you`,
            body: m.content?.slice(0, 200) || "",
            link: "/chat",
            category: "chat",
          });
          fire("chat", `💬 ${senderName}`, m.content?.slice(0, 140) || "", "/chat", `chat:${m.sender_id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "rehearsals", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const r: any = payload.new;
          if (!isFresh(r.created_at)) return;
          fire("announcement", "📅 New rehearsal", `${r.title} — ${r.date}${r.start_time ? " at " + r.start_time.slice(0,5) : ""}`, "/rehearsals", `rehearsal:${r.id}`);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "rehearsals", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const r: any = payload.new;
          fire("announcement", "📅 Rehearsal updated", `${r.title} — check the new details`, "/rehearsals", `rehearsal:${r.id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "songs", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const s: any = payload.new;
          if (!isFresh(s.created_at)) return;
          fire("announcement", "🎵 New song added", s.title, "/songs", `song:${s.id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "prayer_chains", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const p: any = payload.new;
          if (!isFresh(p.created_at)) return;
          fire("announcement", "🙏 New prayer chain", p.name, "/prayer-chains", `prayer:${p.id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "uniform_events", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const u: any = payload.new;
          if (!isFresh(u.created_at)) return;
          fire("announcement", "👔 Uniform schedule", `${u.name} — ${u.date}`, "/uniforms", `uniform:${u.id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "due_payments", filter: `team_id=eq.${team.id}` },
        (payload) => {
          const p: any = payload.new;
          if (!isFresh(p.created_at)) return;
          fire("reminder", "💸 Dues payment", `${p.title} — ${fmtNGN(Number(p.amount))} due ${p.due_date}`, "/payments", `due:${p.id}`);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_records" },
        (payload) => {
          const r: any = payload.new;
          if (r.member_id !== profile.id) return;
          if (!r.verified_at) return;
          const status = r.is_partial ? "marked as partial" : "verified in full";
          fire("reminder", "✅ Payment " + status, `${fmtNGN(Number(r.amount_paid))} confirmed`, "/payments", `pay:${r.id}`);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${profile.id}` },
        async (payload) => {
          const m: any = payload.new;
          if (m.sender_id === profile.id) return;
          if (locationRef.current.startsWith("/dm") && locationRef.current.includes(m.sender_id)) return;
          const { data: sender } = await supabase
            .from("profiles").select("full_name, email").eq("id", m.sender_id).maybeSingle();
          const senderName = sender?.full_name || sender?.email || "Someone";
          const isMention = (m.mentions || []).includes(profile.id);
          await notifyUsers({
            userIds: [profile.id],
            title: isMention ? `💬 ${senderName} mentioned you` : `💬 ${senderName}`,
            body: m.content?.slice(0, 200) || "",
            link: `/dm?with=${m.sender_id}`,
            category: "chat",
          });
          if (shouldSuppressChatBanner("dm", m.sender_id)) return;
          fire(
            "chat",
            isMention ? `💬 ${senderName} mentioned you` : `💬 ${senderName}`,
            m.content?.slice(0, 140) || "",
            `/dm?with=${m.sender_id}`,
            `dm:${m.sender_id}`,
          );
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n: any = payload.new;
          if (!isFresh(n.created_at)) return;
          if (["broadcast", "chat"].includes(n.category)) return;
          const cat = (n.category || "general") as NotifCategory;
          fire(cat, n.title, n.body || "", n.link || undefined, `n:${n.id}`);
        })
      .subscribe();

    // Hourly payment-reminder scheduler — fires OS reminders + persists rows.
    const checkPaymentReminders = async () => {
      const { data: payments } = await supabase
        .from("due_payments")
        .select("id, title, amount, due_date, reminder_days_before, reminders_enabled")
        .eq("team_id", team.id);
      if (!payments) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayKey = today.toISOString().slice(0, 10);
      for (const p of payments as any[]) {
        if (!p.reminders_enabled) continue;
        const due = new Date(p.due_date); due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
        const triggers: number[] = p.reminder_days_before ?? [];
        if (!triggers.includes(diffDays)) continue;
        const seenKey = `rechoir.remind.${p.id}.${todayKey}.${diffDays}`;
        if (localStorage.getItem(seenKey)) continue;
        localStorage.setItem(seenKey, "1");
        const when = diffDays === 0 ? "due today" : diffDays === 1 ? "due tomorrow" : `due in ${diffDays} days`;
        const title = `💸 ${p.title}`;
        const body = `${fmtNGN(Number(p.amount))} ${when}`;
        await notifyUsers({
          userIds: [profile.id],
          title, body, link: "/payments", category: "reminder",
        });
        // Real OS push so reminder lands even when tab is closed.
        sendUserPush({
          userIds: [profile.id],
          title, body, url: "/payments", tag: `due-remind:${p.id}:${diffDays}`,
        });
        fire("reminder", title, body, "/payments", `due-remind:${p.id}:${diffDays}`);
      }
    };
    checkPaymentReminders();
    const t = setInterval(checkPaymentReminders, 60 * 60 * 1000);

    // SW message handling: keep notif-feed in sync when a push lands or the
    // user clicks an OS notification.
    const onSwMessage = async (e: MessageEvent) => {
      const msg: any = e.data;
      if (!msg || !profile?.id) return;
      if (msg.type === "mark-read" && msg.url) {
        await supabase.from("notifications")
          .update({ is_read: true })
          .eq("user_id", profile.id)
          .eq("link", msg.url)
          .eq("is_read", false);
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", onSwMessage);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(t);
      navigator.serviceWorker?.removeEventListener?.("message", onSwMessage);
    };
  }, [team?.id, profile?.id]);

  return null;
}
