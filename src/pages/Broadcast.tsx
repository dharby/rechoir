import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCanManage } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Megaphone, Plus, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { notifyTeam } from "@/lib/notifications";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function Broadcast() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const canManage = useCanManage("broadcast");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", body: "", priority: "high" });

  const { data: broadcasts } = useQuery({
    queryKey: ["broadcasts", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("broadcasts").select("*").eq("team_id", team!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!team || !profile) return;
    if (!form.title || !form.body) { toast.error("Title and message required"); return; }
    if (editing) {
      const { error } = await supabase.from("broadcasts").update({ title: form.title, body: form.body, priority: form.priority } as any).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Broadcast updated");
    } else {
      const { error } = await supabase.from("broadcasts").insert({ team_id: team.id, sender_id: profile.id, title: form.title, body: form.body, priority: form.priority } as any);
      if (error) { toast.error(error.message); return; }
      const notifPriority = form.priority === "critical" || form.priority === "high" ? "high" : "normal";
      notifyTeam({
        teamId: team.id,
        excludeUserId: profile.id,
        title: `📣 ${form.title}`,
        body: form.body.slice(0, 200),
        link: "/broadcast",
        category: "broadcast",
        priority: notifPriority,
        tag: "broadcast",
      });
      toast.success("Broadcast sent!");
    }
    setOpen(false); setEditing(null); setForm({ title: "", body: "", priority: "high" });
    qc.invalidateQueries({ queryKey: ["broadcasts"] });
  };

  const startEdit = (b: any) => { setEditing(b); setForm({ title: b.title, body: b.body, priority: b.priority || "high" }); setOpen(true); };

  const remove = async (b: any) => {
    if (!confirm(`Delete broadcast "${b.title}"?`)) return;
    const { error } = await supabase.from("broadcasts").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["broadcasts"] });
    toast.success("Deleted");
  };

  const updatePriority = async (b: any, priority: string) => {
    const { error } = await supabase.from("broadcasts").update({ priority } as any).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["broadcasts"] });
  };

  const priorityStyle = (p: string) => {
    switch (p) {
      case "critical": return "bg-destructive/15 text-destructive border-destructive/40";
      case "high": return "bg-warning/15 text-warning border-warning/40";
      case "low": return "bg-muted text-muted-foreground border-border";
      default: return "bg-primary/10 text-primary border-primary/30";
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-secondary" />
          <div>
            <h1 className="text-3xl font-extrabold">Broadcasts</h1>
            <p className="text-muted-foreground">Send important announcements to the whole choir</p>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ title: "", body: "", priority: "high" }); } }}>
            <DialogTrigger asChild><Button className="gradient-gold text-secondary-foreground shadow-gold"><Plus className="h-4 w-4 mr-2" />New broadcast</Button></DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>{editing ? "Edit broadcast" : "Send broadcast"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Message</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                <div>
                  <Label>Priority</Label>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {PRIORITIES.map((p) => (
                      <button key={p.value} type="button" onClick={() => setForm({ ...form, priority: p.value })}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-smooth ${form.priority === p.value ? priorityStyle(p.value) + " font-bold" : "border-border text-muted-foreground hover:bg-muted"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={submit} className="w-full gradient-gold text-secondary-foreground">{editing ? "Save changes" : "Send"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {broadcasts?.length === 0 && <p className="text-muted-foreground text-center py-12">No broadcasts yet.</p>}
        {broadcasts?.map((b: any) => (
          <Card key={b.id} className="p-5 glass border-l-4 border-l-secondary">
            <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold">{b.title}</h3>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold ${priorityStyle(b.priority || "normal")}`}>
                  {b.priority || "normal"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{format(new Date(b.created_at), "MMM dd, HH:mm")}</span>
                {canManage && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(b)}><Edit3 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{b.body}</p>
            {canManage && (
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority:</span>
                {PRIORITIES.map((p) => (
                  <button key={p.value} onClick={() => updatePriority(b, p.value)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-smooth ${b.priority === p.value ? priorityStyle(p.value) + " font-bold" : "border-border text-muted-foreground hover:bg-muted"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
