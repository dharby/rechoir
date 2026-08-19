import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Plus, Trash2, Lock, Edit3, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { initials, avatarGradient } from "@/lib/utils-rechoir";

export default function PrayerRequests() {
  const { team, profile } = useAuth();
  const isLead = profile?.role === "team_lead";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", body: "", is_anonymous: false });
  const [noteFor, setNoteFor] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["prayer-requests", team?.id, profile?.id, isLead],
    enabled: !!team?.id && !!profile?.id,
    queryFn: async () => {
      // RLS handles scoping: members see their own; leads see whole team.
      const { data } = await supabase.from("prayer_requests")
        .select("*")
        .eq("team_id", team!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members", team?.id],
    enabled: !!team?.id && isLead,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, email").eq("team_id", team!.id)).data ?? [],
  });
  const memberMap = Object.fromEntries((members ?? []).map((m: any) => [m.id, m]));

  const submit = async () => {
    if (!team || !profile) return;
    if (!form.title.trim()) { toast.error("Title required"); return; }
    if (editing) {
      const { error } = await supabase.from("prayer_requests").update({
        title: form.title, body: form.body, is_anonymous: form.is_anonymous,
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("prayer_requests").insert({
        team_id: team.id, member_id: profile.id,
        title: form.title, body: form.body, is_anonymous: form.is_anonymous,
      } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Prayer request submitted privately to your team lead 🙏");
    }
    setOpen(false); setEditing(null); setForm({ title: "", body: "", is_anonymous: false });
    qc.invalidateQueries({ queryKey: ["prayer-requests"] });
  };

  const startEdit = (r: any) => {
    setEditing(r);
    setForm({ title: r.title, body: r.body || "", is_anonymous: r.is_anonymous });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this prayer request?")) return;
    const { error } = await supabase.from("prayer_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["prayer-requests"] });
    toast.success("Deleted");
  };

  const setStatus = async (id: string, status: "open" | "answered" | "praying") => {
    const { error } = await supabase.from("prayer_requests").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["prayer-requests"] });
  };

  const saveNote = async () => {
    if (!noteFor) return;
    const { error } = await supabase.from("prayer_requests").update({ lead_note: noteText }).eq("id", noteFor.id);
    if (error) { toast.error(error.message); return; }
    setNoteFor(null); setNoteText("");
    qc.invalidateQueries({ queryKey: ["prayer-requests"] });
    toast.success("Note saved");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-secondary" />
          <div>
            <h1 className="text-3xl font-extrabold">Prayer requests</h1>
            <p className="text-muted-foreground flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Private to you and your team lead</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ title: "", body: "", is_anonymous: false }); } }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />New request</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>{editing ? "Edit prayer request" : "Submit a prayer request"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Healing for my mum" /></div>
              <div><Label>Details (optional)</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_anonymous} onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} />
                Submit anonymously (your team lead won't see your name)
              </label>
              <Button onClick={submit} className="w-full gradient-primary text-primary-foreground">{editing ? "Save changes" : "Submit"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {requests?.length === 0 && (
          <Card className="p-12 glass text-center text-muted-foreground">
            {isLead ? "No prayer requests have been submitted yet." : "You haven't submitted any prayer requests yet."}
          </Card>
        )}
        {requests?.map((r: any) => {
          const mine = r.member_id === profile?.id;
          const m = memberMap[r.member_id];
          const showName = isLead && !r.is_anonymous;
          return (
            <Card key={r.id} className="p-5 glass">
              <div className="flex items-start gap-3">
                {showName ? (
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ background: avatarGradient(r.member_id), color: "white" }}>
                      {initials(m?.full_name || m?.email)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><Lock className="h-4 w-4 text-muted-foreground" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold">{r.title}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${
                        r.status === "answered" ? "bg-accent/20 text-accent" :
                        r.status === "praying" ? "bg-secondary/20 text-secondary" :
                        "bg-muted text-muted-foreground"
                      }`}>{r.status}</span>
                      {(mine || isLead) && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {showName ? (m?.full_name || m?.email) : "Anonymous"} • {format(new Date(r.created_at), "MMM dd, yyyy HH:mm")}
                  </div>
                  {r.body && <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/90">{r.body}</p>}
                  {r.lead_note && (
                    <div className="mt-3 p-3 rounded-lg bg-secondary/10 border border-secondary/30 text-sm">
                      <div className="text-[10px] uppercase tracking-wider text-secondary font-bold mb-1">From your team lead</div>
                      {r.lead_note}
                    </div>
                  )}
                  {isLead && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(["open", "praying", "answered"] as const).map((s) => (
                        <Button key={s} size="sm" variant={r.status === s ? "default" : "outline"} onClick={() => setStatus(r.id, s)}>
                          {s === "answered" && <Check className="h-3 w-3 mr-1" />}
                          {s}
                        </Button>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => { setNoteFor(r); setNoteText(r.lead_note || ""); }}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" /> {r.lead_note ? "Edit note" : "Add note"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Lead note dialog */}
      <Dialog open={!!noteFor} onOpenChange={(o) => { if (!o) { setNoteFor(null); setNoteText(""); } }}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Note for member</DialogTitle></DialogHeader>
          <Textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="A word of encouragement, an update…" />
          <DialogFooter><Button onClick={saveNote} className="gradient-primary text-primary-foreground">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
