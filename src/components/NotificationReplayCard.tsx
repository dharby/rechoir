import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { sendUserPush } from "@/lib/notify";

type EventKind =
  | "chat"
  | "reminder"
  | "broadcast"
  | "attendance"
  | "rehearsal"
  | "songs"
  | "prayer"
  | "checklist";

const EVENTS: { kind: EventKind; label: string; title: string; body: string; url: string; tag: string }[] = [
  { kind: "chat",       label: "💬 Chat message",         title: "New message",                   body: "Replay: a teammate just messaged the group chat.", url: "/chat",                tag: "chat-replay" },
  { kind: "reminder",   label: "⏰ Reminder",             title: "Reminder",                      body: "Replay: this is a sample reminder notification.",  url: "/dashboard",           tag: "reminder-replay" },
  { kind: "broadcast",  label: "📣 Broadcast",            title: "Team broadcast",                body: "Replay: announcement from the team lead.",         url: "/broadcast",           tag: "broadcast-replay" },
  { kind: "attendance", label: "✅ Attendance register",  title: "Attendance open",               body: "Replay: an event is open for sign-in.",            url: "/service-attendance",  tag: "attendance-replay" },
  { kind: "rehearsal",  label: "🎼 Rehearsal",            title: "Upcoming rehearsal",            body: "Replay: rehearsal scheduled — tap to view.",       url: "/rehearsals",          tag: "rehearsal-replay" },
  { kind: "songs",      label: "🎵 Songs for the week",   title: "Songs for the week",            body: "Replay: this week's songs were updated.",          url: "/songs",               tag: "songs-replay" },
  { kind: "prayer",     label: "🙏 Prayer lead",          title: "Prayer lead for the week",      body: "Replay: prayer lead assignment.",                  url: "/prayer-chains",       tag: "prayer-replay" },
  { kind: "checklist",  label: "📋 Checklist",            title: "Weekly checklist",              body: "Replay: a checklist item needs attention.",        url: "/checklists",          tag: "checklist-replay" },
];

export function NotificationReplayCard() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (profile?.role !== "team_lead") return null;

  const replay = async (e: typeof EVENTS[number]) => {
    if (!profile) return;
    setBusy(e.kind);
    try {
      await sendUserPush({
        userIds: [profile.id],
        title: `[Replay] ${e.title}`,
        body: e.body,
        url: e.url,
        tag: e.tag,
      });
      toast.success(`Replayed ${e.label}`);
    } catch (err: any) {
      toast.error(err?.message || "Replay failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-6 glass space-y-3 border-primary/30">
      <h2 className="font-bold flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" /> Replay notifications (admin)
      </h2>
      <p className="text-sm text-muted-foreground">
        Send a real push notification to your own device for each event type.
        Use this to confirm delivery without guessing.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {EVENTS.map((e) => (
          <Button
            key={e.kind}
            variant="outline"
            className="justify-start"
            disabled={busy === e.kind}
            onClick={() => replay(e)}
          >
            {busy === e.kind ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {e.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
