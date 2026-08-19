import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCanManage } from "@/hooks/usePermissions";
import { Checkbox } from "@/components/ui/checkbox";
import BulkSelectBar from "@/components/BulkSelectBar";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, MapPin, Clock, Trash2, Edit3, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { notifyTeam } from "@/lib/notifications";
import { PriorityBadge, PrioritySelect } from "@/components/PriorityBadge";
import { Link } from "react-router-dom";

type Kind = "all" | "service" | "rehearsal" | "event";
const KIND_LABEL: Record<Exclude<Kind, "all">, string> = {
  service: "Service",
  rehearsal: "Rehearsal",
  event: "Special event",
};

export default function UpcomingEvents() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const isLead = useCanManage("rehearsals");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState<Kind>("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    title: "", kind: "rehearsal" as Exclude<Kind, "all">, date: "",
    start_time: "", end_time: "", location: "", notes: "", priority: 2,
  });

  const resetForm = () => setForm({ title: "", kind: "rehearsal", date: "", start_time: "", end_time: "", location: "", notes: "", priority: 2 });

  const { data: events } = useQuery({
    queryKey: ["upcoming-events", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("service_events").select("*").eq("team_id", team!.id).order("date", { ascending: false })).data ?? [],
  });

  const visible = useMemo(() => {
    const list = events ?? [];
    const byKind = filter === "all" ? list : list.filter((e: any) => e.kind === filter);
    const q = search.trim().toLowerCase();
    if (!q) return byKind;
    return byKind.filter((e: any) => {
      const d = e.date ? new Date(e.date) : null;
      const haystack = [
        e.title,
        e.location,
        e.date,
        d ? format(d, "MMM dd, yyyy") : "",
        d ? format(d, "EEEE") : "",
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [events, filter, search]);


  const submit = async () => {
    if (!team) return;
    if (!form.title || !form.date) { toast.error("Title and date required"); return; }
    const payload: any = {
      team_id: team.id, title: form.title, kind: form.kind, date: form.date,
      start_time: form.start_time || null, end_time: form.end_time || null,
      location: form.location || null, notes: form.notes || null, priority: form.priority,
    };
    if (editing) {
      const { error } = await supabase.from("service_events").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Event updated");
    } else {
      const { error } = await supabase.from("service_events").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(`${KIND_LABEL[form.kind]} scheduled — a sign-in record was created`);
      notifyTeam({
        teamId: team.id, excludeUserId: profile?.id,
        title: `🗓️ New ${KIND_LABEL[form.kind].toLowerCase()}`,
        body: `${form.title} — ${form.date}${form.start_time ? " at " + form.start_time.slice(0,5) : ""}`,
        link: "/sign-in", category: "announcement", tag: "upcoming-event",
      });
    }
    setOpen(false); setEditing(null); resetForm();
    qc.invalidateQueries({ queryKey: ["upcoming-events"] });
    qc.invalidateQueries({ queryKey: ["service-events"] });
  };

  const startEdit = (e: any) => {
    setEditing(e);
    setForm({
      title: e.title, kind: e.kind, date: e.date,
      start_time: e.start_time?.slice(0, 5) || "",
      end_time: e.end_time?.slice(0, 5) || "",
      location: e.location || "", notes: e.notes || "",
      priority: e.priority ?? 2,
    });
    setOpen(true);
  };

  const remove = async (e: any) => {
    if (!confirm(`Delete "${e.title}"? Its sign-in attendance records will also be removed.`)) return;
    await supabase.from("service_attendance").delete().eq("event_id", e.id);
    const { error } = await supabase.from("service_events").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["upcoming-events"] });
    qc.invalidateQueries({ queryKey: ["service-events"] });
    toast.success("Event deleted");
  };

  const bulk = useBulkSelect((visible as any[]).map((e: any) => e.id));

  const bulkDelete = async () => {
    if (!bulk.selected.length) return;
    await supabase.from("service_attendance").delete().in("event_id", bulk.selected);
    const { error } = await supabase.from("service_events").delete().in("id", bulk.selected);
    if (error) { toast.error(error.message); return; }
    toast.success(`${bulk.selected.length} event(s) deleted`);
    bulk.exit();
    qc.invalidateQueries({ queryKey: ["service-events"] });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Upcoming events</h1>
            <p className="text-muted-foreground">Services, rehearsals and special events. Creating one opens a sign-in record automatically.</p>
          </div>
        </div>
        {isLead && (
          <div className="flex items-center gap-2 flex-wrap">
          <BulkSelectBar selecting={bulk.selecting} onStart={() => bulk.setSelecting(true)} onExit={bulk.exit}
            count={bulk.selected.length} allSelected={bulk.allSelected} onSelectAll={bulk.selectAll}
            onDelete={bulkDelete} noun="event" />
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />New event</Button>
            </DialogTrigger>
            <DialogContent className="glass">
              <DialogHeader><DialogTitle>{editing ? "Edit event" : "Schedule event"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sunday service / Weekly rehearsal…" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.kind} onValueChange={(v: any) => setForm({ ...form, kind: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="rehearsal">Rehearsal</SelectItem>
                        <SelectItem value="event">Special event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div><Label>Notes / agenda</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div><Label>Priority</Label><PrioritySelect value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} /></div>
                <Button onClick={submit} className="w-full gradient-primary text-primary-foreground">{editing ? "Save changes" : "Create"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or date…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "service", "rehearsal", "event"] as Kind[]).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
              {k === "all" ? "All" : KIND_LABEL[k]}
            </Button>
          ))}
        </div>
      </div>


      <div className="grid md:grid-cols-2 gap-4">
        {visible.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">No events scheduled yet.</p>}
        {visible.map((r: any) => (
          <Card key={r.id} className={`p-5 glass transition-smooth hover:shadow-elegant ${bulk.selected.includes(r.id) ? "ring-2 ring-primary" : ""}`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {isLead && bulk.selecting && (
                  <Checkbox checked={bulk.selected.includes(r.id)} onCheckedChange={() => bulk.toggle(r.id)} />
                )}
                <h3 className="font-bold text-lg">{r.title}</h3>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">{KIND_LABEL[r.kind as Exclude<Kind, "all">]}</span>
                <PriorityBadge level={r.priority} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">{format(new Date(r.date), "MMM dd")}</span>
                {isLead && (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}><Edit3 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {r.start_time && <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {r.start_time}{r.end_time ? ` – ${r.end_time}` : ""}</div>}
              {r.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {r.location}</div>}
              {r.notes && <p className="pt-2 text-foreground/80 whitespace-pre-wrap">{r.notes}</p>}
            </div>
            <div className="pt-3">
              <Link to="/sign-in" className="text-xs text-primary underline">Open sign-in →</Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
