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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Music2, Plus, Youtube, Trash2, Edit3, Star, Mic } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { notifyTeam } from "@/lib/notifications";
import { renderTemplate } from "@/lib/notif-templates";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { Checkbox } from "@/components/ui/checkbox";
import BulkSelectBar from "@/components/BulkSelectBar";
import { useBulkSelect } from "@/hooks/useBulkSelect";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  learning: "bg-warning/20 text-warning",
  ready: "bg-accent/20 text-accent",
  perfect: "gradient-gold text-secondary-foreground",
};

export default function Songs() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const isLead = useCanManage("songs");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [form, setForm] = useState({ title: "", song_key: "", youtube_url: "", practice_notes: "", target_readiness_date: "" });
  const [assignDialog, setAssignDialog] = useState<string | null>(null);

  const { data: songs } = useQuery({
    queryKey: ["songs", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("songs").select("*").eq("team_id", team!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ["all-song-assignments", team?.id],
    enabled: !!team?.id,
    queryFn: async () => {
      const ids = (songs ?? []).map((s: any) => s.id);
      if (!ids.length) return [];
      return (await supabase.from("song_assignments").select("*").in("song_id", ids)).data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-active", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("profiles").select("id, full_name, email").eq("team_id", team!.id).eq("is_active", true)).data ?? [],
  });
  const memberMap: Record<string, any> = Object.fromEntries(members.map((m: any) => [m.id, m]));
  const bulk = useBulkSelect(((songs ?? []) as any[]).map((x: any) => x.id));

  const bulkDelete = async () => {
    if (!bulk.selected.length) return;
    await supabase.from("song_assignments").delete().in("song_id", bulk.selected);
    const { error } = await supabase.from("songs").delete().in("id", bulk.selected);
    if (error) { toast.error(error.message); return; }
    toast.success(`${bulk.selected.length} song(s) deleted`);
    bulk.exit();
    qc.invalidateQueries({ queryKey: ["songs"] });
  };

  const resetForm = () => { setEditing(null); setBulkMode(false); setBulkText(""); setForm({ title: "", song_key: "", youtube_url: "", practice_notes: "", target_readiness_date: "" }); };

  const submit = async () => {
    if (!team) return;
    // Bulk mode: create one song per non-empty line
    if (bulkMode && !editing) {
      const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) { toast.error("Enter at least one song title"); return; }
      const rows = lines.map((title) => ({ team_id: team.id, title }));
      const { error } = await supabase.from("songs").insert(rows as any);
      if (error) { toast.error(error.message); return; }
      const tpl = await renderTemplate(team.id, "songs", { title: `${lines.length} new song${lines.length>1?"s":""}` });
      notifyTeam({ teamId: team.id, excludeUserId: profile?.id, title: tpl.title, body: tpl.body, link: "/songs", category: "announcement", tag: "songs" });
      setOpen(false); resetForm();
      qc.invalidateQueries({ queryKey: ["songs"] });
      toast.success(`${lines.length} song${lines.length>1?"s":""} added!`);
      return;
    }
    if (!form.title) { toast.error("Title required"); return; }
    const payload = { ...form, team_id: team.id, target_readiness_date: form.target_readiness_date || null };
    const { error } = editing
      ? await supabase.from("songs").update(payload).eq("id", editing.id)
      : await supabase.from("songs").insert(payload);
    if (error) { toast.error(error.message); return; }
    if (!editing) {
      const tpl = await renderTemplate(team.id, "songs", { title: form.title });
      notifyTeam({
        teamId: team.id, excludeUserId: profile?.id,
        title: tpl.title, body: tpl.body,
        link: "/songs", category: "announcement", tag: "songs",
      });
    }
    setOpen(false); resetForm();
    qc.invalidateQueries({ queryKey: ["songs"] });
    toast.success(editing ? "Song updated!" : "Song added!");
  };


  const startEdit = (s: any) => {
    setEditing(s);
    setForm({
      title: s.title || "", song_key: s.song_key || "", youtube_url: s.youtube_url || "",
      practice_notes: s.practice_notes || "", target_readiness_date: s.target_readiness_date || "",
    });
    setOpen(true);
  };

  const setMyStatus = async (songId: string, status: string) => {
    if (!profile) return;
    const { error } = await supabase.from("song_assignments").upsert({
      song_id: songId, member_id: profile.id, status: status as any,
    }, { onConflict: "song_id,member_id" });
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["all-song-assignments"] }); toast.success("Updated!"); }
  };

  const toggleLead = async (songId: string, memberId: string, currentlyLead: boolean) => {
    const existing = allAssignments.find((a: any) => a.song_id === songId && a.member_id === memberId);
    if (existing) {
      await supabase.from("song_assignments").update({ is_lead: !currentlyLead }).eq("id", existing.id);
    } else {
      await supabase.from("song_assignments").insert({ song_id: songId, member_id: memberId, status: "not_started", is_lead: !currentlyLead });
    }
    qc.invalidateQueries({ queryKey: ["all-song-assignments"] });
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete song "${title}"?`)) return;
    await supabase.from("song_assignments").delete().eq("song_id", id);
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["songs"] });
    toast.success("Song deleted");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Music2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Songs</h1>
            <p className="text-muted-foreground">Track readiness and assign lead singers</p>
          </div>
        </div>
        {isLead && (
          <div className="flex items-center gap-2 flex-wrap">
          <BulkSelectBar selecting={bulk.selecting} onStart={() => bulk.setSelecting(true)} onExit={bulk.exit}
            count={bulk.selected.length} allSelected={bulk.allSelected} onSelectAll={bulk.selectAll}
            onDelete={bulkDelete} noun="song" />
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Add song</Button>
            </DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>{editing ? "Edit song" : bulkMode ? "Add multiple songs" : "New song"}</DialogTitle></DialogHeader>
              {!editing && (
                <div className="flex gap-1 mb-2">
                  <button type="button" onClick={() => setBulkMode(false)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${!bulkMode ? "gradient-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground"}`}>Single</button>
                  <button type="button" onClick={() => setBulkMode(true)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${bulkMode ? "gradient-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground"}`}>Bulk (song list)</button>
                </div>
              )}
              {bulkMode && !editing ? (
                <div className="space-y-3">
                  <div>
                    <Label>Song list (one per line)</Label>
                    <Textarea rows={10} value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                      placeholder={"Amazing Grace\nHow Great Thou Art\n10,000 Reasons\nWay Maker"}
                      className="font-mono whitespace-pre" />
                    <p className="text-xs text-muted-foreground mt-1">Press Enter after each title. Empty lines are ignored.</p>
                  </div>
                  <Button onClick={submit} className="w-full gradient-primary text-primary-foreground">Add {bulkText.split(/\r?\n/).filter((l) => l.trim()).length || ""} songs</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Key</Label><Input value={form.song_key} onChange={(e) => setForm({ ...form, song_key: e.target.value })} placeholder="C major" /></div>
                    <div><Label>Target date</Label><Input type="date" value={form.target_readiness_date} onChange={(e) => setForm({ ...form, target_readiness_date: e.target.value })} /></div>
                  </div>
                  <div><Label>YouTube link</Label><Input value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} /></div>
                  <div><Label>Practice notes</Label><Textarea rows={4} value={form.practice_notes} onChange={(e) => setForm({ ...form, practice_notes: e.target.value })} /></div>
                  <Button onClick={submit} className="w-full gradient-primary text-primary-foreground">{editing ? "Save changes" : "Add song"}</Button>
                </div>
              )}
            </DialogContent>

          </Dialog>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {songs?.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">No songs yet.</p>}
        {songs?.map((s: any) => {
          const mine: any = allAssignments.find((a: any) => a.song_id === s.id && a.member_id === profile?.id);
          const ms = mine?.status || "not_started";
          const leads = allAssignments.filter((a: any) => a.song_id === s.id && a.is_lead);
          return (
            <Card key={s.id} className={`p-5 glass transition-smooth hover:shadow-elegant ${bulk.selected.includes(s.id) ? "ring-2 ring-primary" : ""}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  {isLead && bulk.selecting && (
                    <Checkbox className="mt-1.5" checked={bulk.selected.includes(s.id)} onCheckedChange={() => bulk.toggle(s.id)} />
                  )}
                  <h3 className="font-bold text-lg">{s.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {s.song_key && <span className="text-xs px-2 py-0.5 rounded bg-secondary/20 text-secondary font-mono">{s.song_key}</span>}
                  {isLead && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAssignDialog(s.id)} title="Assign lead singers">
                        <Mic className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(s)}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(s.id, s.title)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {leads.length > 0 && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Star className="h-3.5 w-3.5 text-secondary" />
                  <span className="text-xs text-muted-foreground">Lead{leads.length > 1 ? "s" : ""}:</span>
                  {leads.map((a: any) => {
                    const m = memberMap[a.member_id];
                    return (
                      <span key={a.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                        <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]" style={{ background: avatarGradient(a.member_id), color: "white" }}>{initials(m?.full_name || m?.email)}</AvatarFallback></Avatar>
                        {m?.full_name || m?.email || "Unknown"}
                      </span>
                    );
                  })}
                </div>
              )}
              {s.target_readiness_date && (
                <div className="text-xs text-muted-foreground mb-2">Target: {format(new Date(s.target_readiness_date), "MMM dd, yyyy")}</div>
              )}
              {s.youtube_url && (
                <a href={s.youtube_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 mb-2">
                  <Youtube className="h-4 w-4" /> Watch reference
                </a>
              )}
              {s.practice_notes && <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap break-words">{s.practice_notes}</p>}
              <div className="border-t border-border pt-3 mt-3">
                <div className="text-xs text-muted-foreground mb-2">Your readiness</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["not_started", "learning", "ready", "perfect"] as const).map((st) => (
                    <button key={st} onClick={() => setMyStatus(s.id, st)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-smooth ${ms === st ? STATUS_COLORS[st] : "bg-card border border-border hover:bg-muted"}`}>
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Lead singer assignment dialog */}
      <Dialog open={!!assignDialog} onOpenChange={(o) => !o && setAssignDialog(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Assign lead singers</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {members.map((m: any) => {
              const a: any = allAssignments.find((x: any) => x.song_id === assignDialog && x.member_id === m.id);
              const isLeadMember = !!a?.is_lead;
              return (
                <button key={m.id} onClick={() => assignDialog && toggleLead(assignDialog, m.id, isLeadMember)}
                  className={`flex items-center gap-3 w-full p-2 rounded-lg border transition-smooth ${isLeadMember ? "border-secondary bg-secondary/10" : "border-border hover:bg-muted"}`}>
                  <Avatar className="h-8 w-8"><AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>{initials(m.full_name || m.email)}</AvatarFallback></Avatar>
                  <span className="flex-1 text-left text-sm">{m.full_name || m.email}</span>
                  {isLeadMember && <Star className="h-4 w-4 text-secondary fill-secondary" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
