import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function HeaderBell({ className }: { className?: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["unread-notif", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", profile!.id)
        .eq("is_read", false)
        .is("dismissed_at", null);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase.channel(`unread:${profile.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        () => qc.invalidateQueries({ queryKey: ["unread-notif", profile.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id, qc]);

  return (
    <Link
      to="/notifications"
      className={cn("relative inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-muted/60 transition-smooth", className)}
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
    >
      <Bell className="h-5 w-5 text-foreground" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
