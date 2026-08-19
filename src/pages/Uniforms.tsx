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
import { Shirt, Plus, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { notifyTeam } from "@/lib/notifications";
import { renderTemplate } from "@/lib/notif-templates";

const STATUS = { ready: "bg-accent/20 text-accent", pending: "bg-warning/20 text-warning", not_ready: "bg-destructive/20 text-destructive", na: "bg-muted text-muted-foreground" } as const;

export default function Uniforms() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const isLead = useCanManage("uniforms");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", date: "", description: "" });

  const { data: events } = useQuery({
    queryKey: ["uniform-events", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("uniform_events").select("*").eq("team_id", team!.id).order("date")).data ?? [],
  });

  const { data: myReadiness } = useQuery({
    queryKey: ["uniform-readiness-mine", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => (await supabase.from("uniform_readiness").select("*").eq("member_id", profile!.id)).data ?? [],
  });

  const resetForm = () => { setEditing(null); setForm({ name: "", date: "", description: "" }); };

  const submit = async () => {
    if (!team) return;
    if (!form.name || !form.date) { toast.error("Name and date required"); return; }
    const { error } = editing
      ? await supabase.from("uniform_events").update(form).eq("id", editing.id)
      : await supabase.from("uniform_events").insert({ ...form, team_id: team.id });
    if (error) { toast.error(error.message); return; }
    if (!editing) {
      const tpl = await renderTemplate(team.id, "uniforms", { title: form.name, date: form.date });
      notifyTeam({
        teamId: team.id,
        excludeUserId: profile?.id,
        title: tpl.title,
        body: tpl.body,
        link: "/uniforms",
        category: "announcement",
        tag: "uniforms",
      });
    }
    setOpen(false); resetForm();
    qc.invalidateQueries({ queryKey: ["uniform-events"] });
    toast.success(editing ? "Updated!" : "Event added!");
  };

  const startEdit = (e: any) => {
    setEditing(e);
    setForm({ name: e.name || "", date: e.date || "", description: e.description || "" });
    setOpen(true);
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete uniform event "${name}"?`)) return;
    await supabase.from("uniform_readiness").delete().eq("event_id", id);
    const { error } = await supabase.from("uniform_events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["uniform-events"] });
    toast.success("Deleted");
  };

  const setStatus = async (eventId: string, status: keyof typeof STATUS) => {
    if (!profile) return;
    const { error } = await supabase.from("uniform_readiness").upsert({ event_id: eventId, member_id: profile.id, status }, { onConflict: "event_id,member_id" });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["uniform-readiness-mine"] });
  };

  const myStatus = (id: string) => myReadiness?.find((r: any) => r.event_id === id)?.status || "pending";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Shirt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Uniforms</h1>
            <p className="text-muted-foreground">Track readiness for every uniform event</p>
          </div>
        </div>
        {isLead && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />New event</Button></DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>{editing ? "Edit event" : "Uniform event"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button onClick={submit} className="w-full gradient-primary text-primary-foreground">{editing ? "Save changes" : "Add"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {events?.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">No uniform events yet.</p>}
        {events?.map((e: any) => {
          const ms = myStatus(e.id);
          return (
            <Card key={e.id} className="p-5 glass">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold">{e.name}</h3>
                <div className="flex items-center gap-1">
                  <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">{format(new Date(e.date), "MMM dd")}</span>
                  {isLead && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(e)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(e.id, e.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {e.description && <p className="text-sm text-muted-foreground mb-3">{e.description}</p>}
              <div className="border-t border-border pt-3">
                <div className="text-xs text-muted-foreground mb-2">Your status</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["ready", "pending", "not_ready", "na"] as const).map((s) => (
                    <button key={s} onClick={() => setStatus(e.id, s)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-smooth ${ms === s ? STATUS[s] : "bg-card border border-border hover:bg-muted"}`}>
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
