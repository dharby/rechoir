import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Bell, BellRing, CheckCheck, Megaphone, MessageSquare, Sparkles, AlarmClock, Inbox, ArrowUpRight, Trash2, X as XIcon } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { categoryEnabled, type NotifCategory } from "@/lib/notifications";

const ALL_CATS: NotifCategory[] = ["broadcast", "chat", "reminder", "announcement", "general"];

type Notif = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  category: string;
  priority: string;
  is_read: boolean;
  created_at: string;
  dismissed_at: string | null;
};

const ICONS: Record<string, any> = {
  broadcast: Megaphone,
  chat: MessageSquare,
  reminder: AlarmClock,
  announcement: Sparkles,
  general: Bell,
};

function NotifRow({ n, onOpen, onMarkRead }: { n: Notif; onOpen: () => void; onMarkRead: () => void }) {
  const Icon = ICONS[n.category] ?? Bell;
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  const onDown = (clientX: number) => { startX.current = clientX; setDx(0); };
  const onMove = (clientX: number) => {
    if (startX.current == null) return;
    setDx(clientX - startX.current);
  };
  const onUp = () => {
    if (Math.abs(dx) > 60 && !n.is_read) {
      // Swipe in either direction marks as read
      onMarkRead();
      // Animate off briefly then snap back
      setDx(dx > 0 ? 200 : -200);
      setTimeout(() => setDx(0), 180);
    } else {
      setDx(0);
    }
    startX.current = null;
  };

  const isHigh = n.priority === "high";

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-between px-6 text-xs font-bold uppercase text-primary-foreground bg-primary/80 pointer-events-none">
        <span className={cn("transition-opacity", dx > 30 ? "opacity-100" : "opacity-0")}>Mark read</span>
        <span className={cn("transition-opacity ml-auto", dx < -30 ? "opacity-100" : "opacity-0")}>Mark read</span>
      </div>
      <Card
        onMouseDown={(e) => onDown(e.clientX)}
        onMouseMove={(e) => startX.current != null && onMove(e.clientX)}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={(e) => onDown(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onUp}
        onClick={onOpen}
        style={{ transform: `translateX(${dx}px)`, transition: startX.current == null ? "transform 200ms ease" : "none" }}
        className={cn(
          "p-4 glass cursor-pointer relative select-none",
          !n.is_read && "border-l-4 border-l-primary",
          isHigh && "border-l-4 border-l-secondary shadow-glow"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
            isHigh ? "bg-secondary/20 text-secondary" : "bg-primary/15 text-primary"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={cn("text-sm leading-tight", n.is_read ? "font-medium" : "font-bold")}>
                {n.title}
              </h3>
              {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" aria-label="unread" />}
            </div>
            {n.body && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="outline" className="text-[10px] capitalize">{n.category}</Badge>
              {isHigh && <Badge className="text-[10px] bg-secondary text-secondary-foreground">Priority</Badge>}
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function Notifications() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [preview, setPreview] = useState<Notif | null>(null);

  const { data: list } = useQuery({
    queryKey: ["notifications", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile!.id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Notif[];
    },
  });

  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase.channel(`notif-list:${profile.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", profile.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id, qc]);

  // Only show categories the user has toggled ON in Settings (per device)
  const enabledCats = useMemo(
    () => new Set(ALL_CATS.filter((c) => categoryEnabled(c))),
    // re-evaluate when filter pill state flips so toggling in another tab can refresh on focus
    [filter]
  );
  const visible = useMemo(
    () => (list ?? []).filter((n) => enabledCats.has((n.category as NotifCategory) ?? "general")),
    [list, enabledCats]
  );
  const pinned = useMemo(() => visible.filter((n) => n.priority === "high" && !n.is_read), [visible]);
  const rest = useMemo(() => visible.filter((n) => !pinned.includes(n)), [visible, pinned]);
  const filtered = filter === "unread" ? rest.filter((n) => !n.is_read) : rest;

  const markRead = async (n: Notif) => {
    if (n.is_read) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
  };
  const dismiss = async (n: Notif) => {
    await supabase.from("notifications").update({ is_read: true, dismissed_at: new Date().toISOString() }).eq("id", n.id);
  };
  const hardDelete = async (n: Notif) => {
    await supabase.from("notifications").delete().eq("id", n.id);
  };
  const open = (n: Notif) => {
    setPreview(n);
    // Auto mark-read on open
    if (!n.is_read) void markRead(n);
  };
  const openLink = async (n: Notif) => {
    await markRead(n);
    setPreview(null);
    if (n.link) navigate(n.link);
  };
  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
  };

  const unread = visible.filter((n) => !n.is_read).length;
  const hiddenByPrefs = (list?.length ?? 0) - visible.length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BellRing className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Notifications</h1>
            <p className="text-muted-foreground">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
          <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>Unread</Button>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {hiddenByPrefs > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          {hiddenByPrefs} hidden by your category preferences.{" "}
          <Link to="/settings" className="text-primary underline">Manage</Link>
        </p>
      )}
      {pinned.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> Priority broadcasts
          </div>
          {pinned.map((n) => (
            <NotifRow key={n.id} n={n} onOpen={() => open(n)} onMarkRead={() => markRead(n)} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && pinned.length === 0 && (
          <Card className="p-12 glass text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nothing here yet</p>
            <p className="text-sm mt-1">Broadcasts, mentions and reminders will show up here.</p>
            <Link to="/settings" className="text-primary text-sm underline mt-3 inline-block">Manage notification preferences</Link>
          </Card>
        )}
        {filtered.map((n) => (
          <NotifRow key={n.id} n={n} onOpen={() => open(n)} onMarkRead={() => markRead(n)} />
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="glass max-w-lg">
          {preview && (() => {
            const Icon = ICONS[preview.category] ?? Bell;
            const isHigh = preview.priority === "high";
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      isHigh ? "bg-secondary/20 text-secondary" : "bg-primary/15 text-primary")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-left break-words">{preview.title}</DialogTitle>
                      <DialogDescription className="text-left text-xs">
                        {format(new Date(preview.created_at), "PPpp")}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex items-center gap-2 -mt-1">
                  <Badge variant="outline" className="text-[10px] capitalize">{preview.category}</Badge>
                  {isHigh && <Badge className="text-[10px] bg-secondary text-secondary-foreground">Priority</Badge>}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(preview.created_at), { addSuffix: true })}
                  </span>
                </div>
                {preview.body && (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto rounded-md bg-muted/40 p-3">
                    {preview.body}
                  </div>
                )}
                <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
                  <Button variant="ghost" size="sm" onClick={() => { dismiss(preview); setPreview(null); }}>
                    <XIcon className="h-4 w-4 mr-1" /> Dismiss
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => { hardDelete(preview); setPreview(null); }}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                    {preview.link && (
                      <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => openLink(preview)}>
                        Open <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
