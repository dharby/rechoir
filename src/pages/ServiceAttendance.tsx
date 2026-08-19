import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCanManage } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import BulkSelectBar from "@/components/BulkSelectBar";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Plus, MessageSquare, Trash2, Edit3, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { notifyTeam } from "@/lib/notifications";
import { AttendanceTotals, AttendanceFilterChips, type RosterStatus } from "@/components/AttendanceFilterBar";


type Status = "on_time" | "late" | "absent" | "excused";
const STATUS_META: Record<Status, { label: string; ring: string }> = {
  on_time: { label: "Present",        ring: "bg-accent text-accent-foreground border-transparent" },
  late:    { label: "Late",           ring: "bg-warning text-secondary-foreground border-transparent" },
  absent:  { label: "Absent",         ring: "bg-destructive text-destructive-foreground border-transparent" },
  excused: { label: "Excused",        ring: "bg-muted-foreground text-background border-transparent" },
};
const STATUSES: Status[] = ["on_time", "late", "absent", "excused"];

const toRoster = (s: string | undefined): RosterStatus => {
  if (s === "on_time") return "present";
  if (s === "very_late") return "late";
  if (s === "late" || s === "absent" || s === "excused") return s;
  return "absent";
};

function lateCutoff(ev: any): number | null {
  if (!ev) return null;
  if (ev.late_after) return new Date(ev.late_after).getTime();
  // No default grace period — leads must configure "late after" explicitly.
  return null;
}

export default function ServiceAttendance() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const isLead = useCanManage("attendance");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", kind: "service" as const, date: "", start_time: "", end_time: "", location: "" });
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<RosterStatus | "all">("all");
  const [editingLateAfter, setEditingLateAfter] = useState("");

  const { data: events } = useQuery({
    queryKey: ["service-events", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("service_events").select("*").eq("team_id", team!.id).order("date", { ascending: false })).data ?? [],
  });

  const { data: members } = useQuery({
    queryKey: ["members-active", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("team_id", team!.id).eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: records } = useQuery({
    queryKey: ["service-attendance", selected],
    enabled: !!selected,
    queryFn: async () => (await supabase.from("service_attendance").select("*").eq("event_id", selected!)).data ?? [],
  });

  const currentEvent: any = events?.find((e: any) => e.id === selected);

  const submit = async () => {
    if (!team) return;
    if (!form.title || !form.date) { toast.error("Title and date required"); return; }
    const payload: any = {
      team_id: team.id, ...form,
      start_time: form.start_time || null, end_time: form.end_time || null, location: form.location || null,
    };
    if (editing) {
      const { error } = await supabase.from("service_events").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Event updated");
    } else {
      const { error } = await supabase.from("service_events").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Event created");
      notifyTeam({
        teamId: team.id, excludeUserId: profile?.id,
        title: "🗓️ New service event",
        body: `${form.title} — ${form.date}${form.start_time ? " at " + form.start_time.slice(0,5) : ""}`,
        link: "/sign-in", category: "announcement", tag: "service-event",
      });
    }
    setOpen(false); setEditing(null);
    setForm({ title: "", kind: "service", date: "", start_time: "", end_time: "", location: "" });
    qc.invalidateQueries({ queryKey: ["service-events"] });
  };

  const startEdit = (e: any) => {
    setEditing(e);
    setForm({ title: e.title, kind: e.kind, date: e.date,
      start_time: e.start_time?.slice(0,5) || "", end_time: e.end_time?.slice(0,5) || "", location: e.location || "" });
    setOpen(true);
  };

  const removeEvent = async (e: any) => {
    if (!confirm(`Delete event "${e.title}"?`)) return;
    await supabase.from("service_attendance").delete().eq("event_id", e.id);
    const { error } = await supabase.from("service_events").delete().eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    if (selected === e.id) setSelected(null);
    qc.invalidateQueries({ queryKey: ["service-events"] });
    toast.success("Event deleted");
  };

  const bulk = useBulkSelect(((events ?? []) as any[]).map((e: any) => e.id));

  const bulkDelete = async () => {
    if (!bulk.selected.length) return;
    await supabase.from("service_attendance").delete().in("event_id", bulk.selected);
    const { error } = await supabase.from("service_events").delete().in("id", bulk.selected);
    if (error) { toast.error(error.message); return; }
    if (selected && bulk.selected.includes(selected)) setSelected(null);
    toast.success(`${bulk.selected.length} event(s) deleted`);
    bulk.exit();
    qc.invalidateQueries({ queryKey: ["service-events"] });
    qc.invalidateQueries({ queryKey: ["upcoming-events"] });
  };



  const mark = async (memberId: string, status: Status) => {
    if (!selected || !profile) return;
    const remark = remarks[memberId] ?? records?.find((r: any) => r.member_id === memberId)?.remark ?? "";
    const existing = records?.find((r: any) => r.member_id === memberId);
    const { error } = await supabase.from("service_attendance").upsert({
      event_id: selected, member_id: memberId, status,
      arrival_time: status === "on_time" || status === "late" ? new Date().toISOString() : null,
      remark: (status === "absent" || status === "excused") ? (remark || null) : null,
      marked_by: profile.id, marked_at: new Date().toISOString(),
      verified_by: profile.id, verified_at: new Date().toISOString(),
      overridden: !!existing, source: "lead",
    } as any, { onConflict: "event_id,member_id" });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["service-attendance", selected] });
  };

  const verify = async (rec: any) => {
    if (!profile) return;
    await supabase.from("service_attendance").update({
      verified_by: profile.id, verified_at: new Date().toISOString(),
    }).eq("id", rec.id);
    qc.invalidateQueries({ queryKey: ["service-attendance", selected] });
    toast.success("Verified");
  };

  const clearMark = async (memberId: string) => {
    const rec = records?.find((r: any) => r.member_id === memberId);
    if (!rec) return;
    const { error } = await supabase.from("service_attendance").delete().eq("id", rec.id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["service-attendance", selected] }); toast.success("Cleared"); }
  };

  const updateRemark = async (memberId: string, remark: string) => {
    setRemarks((r) => ({ ...r, [memberId]: remark }));
    const rec = records?.find((r: any) => r.member_id === memberId);
    if (!rec || (rec.status !== "absent" && rec.status !== "excused")) return;
    await supabase.from("service_attendance").update({ remark }).eq("id", rec.id);
    qc.invalidateQueries({ queryKey: ["service-attendance", selected] });
  };

  const saveLateAfter = async () => {
    if (!currentEvent) return;
    if (!editingLateAfter) {
      await supabase.from("service_events").update({ late_after: null }).eq("id", currentEvent.id);
    } else {
      const dt = new Date(`${currentEvent.date}T${editingLateAfter}`);
      await supabase.from("service_events").update({ late_after: dt.toISOString() }).eq("id", currentEvent.id);
    }
    qc.invalidateQueries({ queryKey: ["service-events"] });
    toast.success("Late cutoff updated");
  };

  const roster = useMemo(() => {
    return (members ?? []).map((m: any) => {
      const rec: any = records?.find((r: any) => r.member_id === m.id);
      const status: RosterStatus = rec ? toRoster(rec.status) : "absent";
      return { member: m, rec, status };
    });
  }, [members, records]);

  const totals = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0 };
    roster.forEach((r) => (c as any)[r.status] += 1);
    return { total: roster.length, ...c };
  }, [roster]);

  const filtered = filter === "all" ? roster : roster.filter((r) => r.status === filter);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Sign-in attendance</h1>
            <p className="text-muted-foreground">Members sign in, team leads verify and override</p>
          </div>
        </div>
        {isLead && (
          <div className="flex items-center gap-2 flex-wrap">
          <BulkSelectBar selecting={bulk.selecting} onStart={() => bulk.setSelecting(true)} onExit={bulk.exit}
            count={bulk.selected.length} allSelected={bulk.allSelected} onSelectAll={bulk.selectAll}
            onDelete={bulkDelete} noun="event" />
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ title: "", kind: "service", date: "", start_time: "", end_time: "", location: "" }); } }}>
            <DialogTrigger asChild><Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />New event</Button></DialogTrigger>

            <DialogContent className="glass">
              <DialogHeader><DialogTitle>{editing ? "Edit event" : "Schedule event"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sunday service" /></div>
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
                <Button onClick={submit} className="w-full gradient-primary text-primary-foreground">{editing ? "Save changes" : "Create"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}

      </div>

      <Card className="p-4 glass">
        <div className="flex flex-wrap gap-2">
          {events?.map((e: any) => (
            <div key={e.id} className={`flex items-center gap-1 rounded-lg border ${bulk.selected.includes(e.id) ? "ring-2 ring-primary" : ""} ${selected === e.id ? "border-primary bg-primary/10" : "border-border"}`}>
              {isLead && bulk.selecting && (
                <Checkbox className="ml-2" checked={bulk.selected.includes(e.id)} onCheckedChange={() => bulk.toggle(e.id)} />
              )}
              <button onClick={() => { setSelected(e.id); setEditingLateAfter(e.late_after ? format(new Date(e.late_after), "HH:mm") : ""); }} className="px-3 py-2 text-sm text-left">

                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-muted-foreground capitalize">{e.kind} • {format(new Date(e.date), "MMM dd")}</div>
              </button>
              {isLead && (
                <div className="flex items-center pr-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(e)}><Edit3 className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeEvent(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          ))}
          {events?.length === 0 && <p className="text-sm text-muted-foreground">{isLead ? "Create an event to start." : "No events yet."}</p>}
        </div>
      </Card>

      {selected && (
        <>
          <Card className="p-5 glass space-y-3">
            <AttendanceTotals total={totals.total} present={totals.present} late={totals.late} absent={totals.absent} excused={totals.excused} />
            <AttendanceFilterChips value={filter} onChange={setFilter} />
            {isLead && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Late after:</span>
                <Input type="time" value={editingLateAfter} onChange={(e) => setEditingLateAfter(e.target.value)} className="w-[120px] h-8" />
                <Button size="sm" variant="outline" onClick={saveLateAfter}>Save</Button>
                <span className="text-[10px] text-muted-foreground">Leave blank for no auto-late</span>
              </div>
            )}
          </Card>

          <Card className="p-5 glass">
            {!isLead && profile && (() => {
              const myRec: any = records?.find((r: any) => r.member_id === profile.id);
              const doSelfSignIn = async () => {
                let status: Status = "on_time";
                const cutoff = lateCutoff(currentEvent);
                if (cutoff && Date.now() > cutoff) status = "late";
                const { error } = await supabase.from("service_attendance").insert({
                  event_id: selected, member_id: profile.id, status,
                  arrival_time: new Date().toISOString(),
                  marked_by: profile.id, marked_at: new Date().toISOString(),
                  source: "self",
                } as any);
                if (error) {
                  if ((error as any).code === "23505") toast.error("You've already signed in for this event.");
                  else toast.error(error.message);
                } else { toast.success(`Signed in (${STATUS_META[status].label})`); qc.invalidateQueries({ queryKey: ["service-attendance", selected] }); }
              };
              return (
                <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">My sign-in</div>
                    <div className="text-xs text-muted-foreground">
                      {myRec
                        ? `Signed in ${STATUS_META[(myRec.status === "very_late" ? "late" : myRec.status) as Status]?.label.toLowerCase()} at ${myRec.arrival_time ? format(new Date(myRec.arrival_time), "p") : "—"}`
                        : "Tap to register. One sign-in per event."}
                    </div>
                  </div>
                  <Button onClick={doSelfSignIn} disabled={!!myRec} className="gradient-primary text-primary-foreground shadow-glow">
                    {myRec ? "Signed in ✓" : "Sign in"}
                  </Button>
                </div>
              );
            })()}

            <div className="space-y-3">
              {filtered.map(({ member: m, rec, status: r }) => {
                const remarkVal = remarks[m.id] ?? rec?.remark ?? "";
                const rawStatus = rec?.status as Status | undefined;
                return (
                  <div key={m.id} className="flex flex-wrap items-start gap-3 p-3 rounded-lg border border-border/60 bg-card/50">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>{initials(m.full_name || m.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {m.full_name || m.email}
                          {rec?.source === "self" && !rec?.verified_by && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning">Unverified</span>}
                          {rec?.verified_by && <ShieldCheck className="h-3.5 w-3.5 text-accent" />}
                          {rec?.overridden && <span className="text-[10px] text-muted-foreground">(overridden)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rec?.arrival_time ? `Signed in ${format(new Date(rec.arrival_time), "p")}` : "No record"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                      {STATUSES.map((st) => {
                        const meta = STATUS_META[st];
                        const active = rawStatus === st;
                        return (
                          <Button key={st} size="sm" variant={active ? "default" : "outline"}
                            className={active ? meta.ring : ""}
                            disabled={!isLead}
                            onClick={() => mark(m.id, st)}>
                            {meta.label}
                          </Button>
                        );
                      })}
                      {isLead && rec && (
                        <>
                          {!rec.verified_by && <Button size="sm" variant="outline" onClick={() => verify(rec)}>Verify</Button>}
                          <Button size="sm" variant="ghost" onClick={() => clearMark(m.id)}>Clear</Button>
                        </>
                      )}
                    </div>
                    {(rawStatus === "absent" || rawStatus === "excused") && rec && (
                      <div className="w-full flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input placeholder={rawStatus === "excused" ? "Excuse remark (e.g. sick, family)" : "Reason / remark (optional)"} value={remarkVal} disabled={!isLead}
                          onChange={(e) => setRemarks((rr) => ({ ...rr, [m.id]: e.target.value }))}
                          onBlur={(e) => updateRemark(m.id, e.target.value)} className="text-sm" />
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No members match this filter.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
