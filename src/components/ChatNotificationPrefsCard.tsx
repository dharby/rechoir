import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircleOff, Clock, Users } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import {
  groupChatMuted,
  setGroupChatMuted,
  dmMuted,
  setDmMuted,
  getQuietHours,
  setQuietHours,
  useChatPrefs,
} from "@/lib/chat-prefs";

/** Per-group & per-DM mute toggles + quiet hours. */
export function ChatNotificationPrefsCard() {
  useChatPrefs(); // re-render on changes (multi-tab safe)
  const { team, profile } = useAuth();
  const isLead = profile?.role === "team_lead";

  const q = getQuietHours();
  const [quietOn, setQuietOn] = useState(q.enabled);
  const [quietStart, setQuietStart] = useState(q.start);
  const [quietEnd, setQuietEnd] = useState(q.end);

  // Sync local state when prefs change in another tab
  useEffect(() => {
    const refreshed = getQuietHours();
    setQuietOn(refreshed.enabled);
    setQuietStart(refreshed.start);
    setQuietEnd(refreshed.end);
  }, []);

  const [peers, setPeers] = useState<any[]>([]);
  useEffect(() => {
    if (!team?.id || !profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url")
        .eq("team_id", team.id)
        .order("full_name");
      const all = (data ?? []).filter((p: any) => p.id !== profile.id);
      // Members can only DM the team lead. Leads see everyone.
      setPeers(isLead ? all : all.filter((p: any) => p.role === "team_lead"));
    })();
  }, [team?.id, profile?.id, isLead]);

  return (
    <Card className="p-6 glass space-y-5">
      <div>
        <h2 className="font-bold flex items-center gap-2">
          <MessageCircleOff className="h-4 w-4" /> Chat reminders
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Mute specific conversations without losing your other alerts. Quiet hours silence in-app
          banners and chimes — use your phone's Do Not Disturb to also silence the system push.
        </p>
      </div>

      {/* Quiet hours */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Quiet hours
            </div>
            <div className="text-xs text-muted-foreground">
              Silence chat banners between these times
            </div>
          </div>
          <Switch
            checked={quietOn}
            onCheckedChange={(v) => { setQuietOn(v); setQuietHours({ enabled: v }); }}
          />
        </div>
        {quietOn && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="time"
                value={quietStart}
                onChange={(e) => { setQuietStart(e.target.value); setQuietHours({ start: e.target.value }); }}
              />
            </div>
            <div>
              <Label className="text-xs">Until</Label>
              <Input
                type="time"
                value={quietEnd}
                onChange={(e) => { setQuietEnd(e.target.value); setQuietHours({ end: e.target.value }); }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Group chat */}
      <div className="border-t border-border pt-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Team group chat
          </div>
          <div className="text-xs text-muted-foreground">Mute mention banners from the team room</div>
        </div>
        <Switch
          checked={!groupChatMuted()}
          onCheckedChange={(v) => setGroupChatMuted(!v)}
        />
      </div>

      {/* DMs */}
      <div className="border-t border-border pt-4 space-y-2">
        <div className="text-sm font-semibold">Direct messages</div>
        {peers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No conversations yet.</p>
        ) : (
          <div className="space-y-1">
            {peers.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar user={p} className="h-7 w-7" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{p.full_name || p.email}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {p.role?.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={!dmMuted(p.id)}
                  onCheckedChange={(v) => setDmMuted(p.id, !v)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
