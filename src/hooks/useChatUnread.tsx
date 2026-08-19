import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** Returns the number of unread chat messages (sent by others, after last_read_at). */
export function useChatUnreadCount() {
  const { profile, team } = useAuth();
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["chat-unread", profile?.id, team?.id],
    enabled: !!profile?.id && !!team?.id,
    queryFn: async () => {
      const { data: state } = await supabase
        .from("chat_read_state")
        .select("last_read_at")
        .eq("user_id", profile!.id)
        .eq("team_id", team!.id)
        .maybeSingle();
      const since = state?.last_read_at ?? "1970-01-01";
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { head: true, count: "exact" })
        .eq("team_id", team!.id)
        .neq("sender_id", profile!.id)
        .gt("created_at", since);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!team?.id || !profile?.id) return;
    const ch = supabase.channel(`chat-unread:${team.id}:${profile.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `team_id=eq.${team.id}` },
        () => qc.invalidateQueries({ queryKey: ["chat-unread", profile.id, team.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [team?.id, profile?.id, qc]);

  return count;
}

/** Mark the current team chat as fully read for this user. */
export async function markChatRead(userId: string, teamId: string) {
  await supabase.from("chat_read_state").upsert(
    { user_id: userId, team_id: teamId, last_read_at: new Date().toISOString() },
    { onConflict: "user_id,team_id" }
  );
}
