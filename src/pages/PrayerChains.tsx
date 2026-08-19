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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { HeartHandshake, Plus, Sparkles, Calendar as CalendarIcon, Clock, UserCog, Trash2, Pencil, Target } from "lucide-react";
import { PriorityBadge, PrioritySelect } from "@/components/PriorityBadge";

import { toast } from "sonner";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { notifyTeam, notifyUsers } from "@/lib/notifications";
import { sendUserPush } from "@/lib/notify";
import { renderTemplate } from "@/lib/notif-templates";

const DAYS = [
  { value: 0, label: "Sunday",    short: "Sun" },
  { value: 1, label: "Monday",    short: "Mon" },
  { value: 2, label: "Tuesday",   short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday",  short: "Thu" },
  { value: 5, label: "Friday",    short: "Fri" },
  { value: 6, label: "Saturday",  short: "Sat" },
];

const RECURRENCE_OPTIONS = [
  { value: "none",   label: "One-off (uses start date)" },
  { value: "daily",  label: "Every day" },
  { value: "weekly", label: "Custom days of week" },
];

export default function PrayerChains() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const isLead = useCanManage("prayer-chains");

  const [open, setOpen] = useState(false);
  const [leaderOpen, setLeaderOpen] = useState(false);
  const [editingChainId, setEditingChainId] = useState<string | null>(null);
  const [editingLeaderId, setEditingLeaderId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const emptyForm = {
    name: "", description: "", type: "scheduled" as "scheduled" | "continuous",
    start_date: "", end_date: "", recurrence: "weekly" as "none" | "daily" | "weekly",
    start_time: "", end_time: "",
    days_of_week: [] as number[],
    priority: 2,
  };
  const [form, setForm] = useState(emptyForm);


  const emptyLeaderForm = {
    member_id: "", day_of_week: 1,
    start_time: "", end_time: "",
    week_start_date: format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd"),
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    focus: "",
    notes: "",
  };
  const [leaderForm, setLeaderForm] = useState(emptyLeaderForm);

  const { data: chains } = useQuery({
    queryKey: ["prayer-chains", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("prayer_chains").select("*").eq("team_id", team!.id).order("start_date", { ascending: false })).data ?? [],
  });

  const { data: members } = useQuery({
    queryKey: ["members", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").eq("team_id", team!.id).eq("is_active", true)).data ?? [],
  });
  const memberMap = Object.fromEntries((members ?? []).map((m: any) => [m.id, m]));

  const { data: leaders } = useQuery({
    queryKey: ["prayer-leaders", team?.id],
    enabled: !!team?.id,
    queryFn: async () => (await supabase.from("prayer_leader_schedule").select("*").eq("team_id", team!.id)).data ?? [],
  });

  const openCreateChain = () => { setEditingChainId(null); setForm(emptyForm); setOpen(true); };
  const openEditChain = (c: any) => {
    setEditingChainId(c.id);
    setForm({
      name: c.name ?? "", description: c.description ?? "",
      type: c.type ?? "scheduled",
      start_date: c.start_date ?? "", end_date: c.end_date ?? "",
      recurrence: c.recurrence ?? "none",
      start_time: c.start_time?.slice(0,5) ?? "", end_time: c.end_time?.slice(0,5) ?? "",
      days_of_week: c.days_of_week ?? [],
      priority: c.priority ?? 2,
    });
    setOpen(true);
  };


  const create = async () => {
    if (!team) return;
    if (!form.name || !form.start_date) { toast.error("Name and start date required"); return; }
    if (form.recurrence === "weekly" && form.days_of_week.length === 0) { toast.error("Pick at least one day"); return; }
    const payload = {
      team_id: team.id,
      name: form.name, description: form.description, type: form.type,
      start_date: form.start_date, end_date: form.end_date || null,
      recurrence: form.recurrence as any,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      days_of_week: form.recurrence === "daily" ? [0,1,2,3,4,5,6] : form.days_of_week,
      priority: form.priority,

    };
    const { error } = editingChainId
      ? await supabase.from("prayer_chains").update(payload as any).eq("id", editingChainId)
      : await supabase.from("prayer_chains").insert(payload as any);
    if (error) { toast.error(error.message); return; }
    if (!editingChainId) {
      const tpl = await renderTemplate(team.id, "prayer", { title: form.name });
      notifyTeam({
        teamId: team.id,
        excludeUserId: profile?.id,
        title: tpl.title,
        body: tpl.body,
        link: "/prayer-chains",
        category: "announcement",
        tag: "prayer",
      });
    }
    setOpen(false);
    setEditingChainId(null);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["prayer-chains"] });
    toast.success(editingChainId ? "Prayer chain updated" : "Prayer chain started!");
  };

  const markAnswered = async (id: string) => {
    await supabase.from("prayer_chains").update({ answered: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["prayer-chains"] });
    toast.success("🙌 Prayer answered!");
  };

  const deleteChain = async (id: string, name: string) => {
    if (!confirm(`Delete prayer chain "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("prayer_chains").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["prayer-chains"] });
    toast.success("Prayer chain deleted");
  };

  const deleteLeader = async (id: string) => {
    if (!confirm("Remove this leader assignment?")) return;
    const { error } = await supabase.from("prayer_leader_schedule").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["prayer-leaders"] });
    toast.success("Removed");
  };

  const openAssignFor = (date: Date) => {
    setEditingLeaderId(null);
    setLeaderForm({
      ...emptyLeaderForm,
      scheduled_date: format(date, "yyyy-MM-dd"),
      week_start_date: format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      day_of_week: date.getDay(),
    });
    setLeaderOpen(true);
  };
  const openEditLeader = (l: any) => {
    setEditingLeaderId(l.id);
    setLeaderForm({
      member_id: l.member_id ?? "",
      day_of_week: l.day_of_week ?? 0,
      start_time: l.start_time?.slice(0,5) ?? "",
      end_time: l.end_time?.slice(0,5) ?? "",
      week_start_date: l.week_start_date ?? format(new Date(), "yyyy-MM-dd"),
      scheduled_date: l.scheduled_date ?? l.week_start_date ?? format(new Date(), "yyyy-MM-dd"),
      focus: l.focus ?? "",
      notes: l.notes ?? "",
    });
    setLeaderOpen(true);
  };

  const assignLeader = async () => {
    if (!team) return;
    if (!leaderForm.member_id) { toast.error("Pick a member"); return; }
    const date = leaderForm.scheduled_date ? parseISO(leaderForm.scheduled_date) : new Date();
    const payload = {
      team_id: team.id,
      member_id: leaderForm.member_id,
      week_start_date: format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd"),
      day_of_week: date.getDay(),
      scheduled_date: leaderForm.scheduled_date,
      start_time: leaderForm.start_time || null,
      end_time: leaderForm.end_time || null,
      focus: leaderForm.focus || null,
      notes: leaderForm.notes || null,
    };
    const { error } = editingLeaderId
      ? await supabase.from("prayer_leader_schedule").update(payload as any).eq("id", editingLeaderId)
      : await supabase.from("prayer_leader_schedule").insert(payload as any);
    if (error) { toast.error(error.message); return; }
    if (!editingLeaderId && leaderForm.member_id) {
      const tpl = await renderTemplate(team.id, "prayer_lead", {
        date: leaderForm.scheduled_date,
        at_time: leaderForm.start_time ? ` at ${leaderForm.start_time}` : "",
        focus: leaderForm.focus ? ` — ${leaderForm.focus}` : "",
      });
      notifyUsers({ userIds: [leaderForm.member_id], title: tpl.title, body: tpl.body, link: "/prayer-chains", category: "reminder" });
      sendUserPush({ userIds: [leaderForm.member_id], title: tpl.title, body: tpl.body, url: "/prayer-chains", tag: "prayer-lead" });
    }
    setLeaderOpen(false);
    setEditingLeaderId(null);
    qc.invalidateQueries({ queryKey: ["prayer-leaders"] });
    toast.success(editingLeaderId ? "Updated" : "Leader assigned");
  };

  // Build this week's calendar (Sun..Sat)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const weekStartKey = format(weekStart, "yyyy-MM-dd");

  // Match a leader entry to a specific date (scheduled_date preferred, legacy fallback)
  const leadersForDate = (d: Date) => {
    const key = format(d, "yyyy-MM-dd");
    const wk = format(startOfWeek(d, { weekStartsOn: 0 }), "yyyy-MM-dd");
    return (leaders ?? []).filter((l: any) =>
      l.scheduled_date
        ? l.scheduled_date === key
        : l.week_start_date === wk && l.day_of_week === d.getDay()
    );
  };

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, dow: d.getDay(), leaders: leadersForDate(d) };
  });

  // Today's leaders (for "Prayer leader for the week" highlight on this page too)
  const todayLeaders = leadersForDate(new Date());

  // Calendar: collect dates that have an assignment for highlighting
  const assignedDates = (leaders ?? [])
    .map((l: any) => l.scheduled_date ? parseISO(l.scheduled_date) : null)
    .filter(Boolean) as Date[];

  // My assignments (any member)
  const myLeaderEntries = (leaders ?? []).filter((l: any) => l.member_id === profile?.id);

  // Leaders for the selected calendar date
  const selectedLeaders = selectedDate ? leadersForDate(selectedDate) : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <HeartHandshake className="h-8 w-8 text-secondary" />
          <div>
            <h1 className="text-3xl font-extrabold">Prayer chains</h1>
            <p className="text-muted-foreground">Schedule, recurrence, year calendar & weekly leaders</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isLead && (
            <Button variant="outline" onClick={() => openAssignFor(selectedDate ?? new Date())}>
              <UserCog className="h-4 w-4 mr-2" />Assign leader
            </Button>
          )}
          {isLead && (
            <Button onClick={openCreateChain} className="gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4 mr-2" />New chain
            </Button>
          )}
        </div>
      </div>

      {/* Assign leader dialog (date + focus) */}
      {isLead && (
        <Dialog open={leaderOpen} onOpenChange={(v) => { setLeaderOpen(v); if (!v) setEditingLeaderId(null); }}>
          <DialogContent className="glass max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingLeaderId ? "Edit prayer leader" : "Assign prayer leader"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={leaderForm.scheduled_date} onChange={(e) => setLeaderForm({ ...leaderForm, scheduled_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start time</Label><Input type="time" value={leaderForm.start_time} onChange={(e) => setLeaderForm({ ...leaderForm, start_time: e.target.value })} /></div>
                <div><Label>End time</Label><Input type="time" value={leaderForm.end_time} onChange={(e) => setLeaderForm({ ...leaderForm, end_time: e.target.value })} /></div>
              </div>
              <div>
                <Label>Member leading</Label>
                <Select value={leaderForm.member_id} onValueChange={(v) => setLeaderForm({ ...leaderForm, member_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a member" /></SelectTrigger>
                  <SelectContent>
                    {members?.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Prayer focus (optional)</Label>
                <Input placeholder="e.g. Healing, Revival, Families…" value={leaderForm.focus} onChange={(e) => setLeaderForm({ ...leaderForm, focus: e.target.value })} />
              </div>
              <div><Label>Notes (optional)</Label><Textarea value={leaderForm.notes} onChange={(e) => setLeaderForm({ ...leaderForm, notes: e.target.value })} /></div>
              <Button onClick={assignLeader} className="w-full gradient-primary text-primary-foreground">{editingLeaderId ? "Save changes" : "Assign"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* New / Edit chain dialog */}
      {isLead && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingChainId(null); }}>
          <DialogContent className="glass max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingChainId ? "Edit prayer chain" : "Start a prayer chain"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="continuous">Continuous (24/7)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Recurrence</Label>
                  <Select value={form.recurrence} onValueChange={(v: any) => setForm({ ...form, recurrence: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.recurrence === "weekly" && (
                <div>
                  <Label>Days</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {DAYS.map((d) => {
                      const on = form.days_of_week.includes(d.value);
                      return (
                        <button key={d.value} type="button"
                          onClick={() => setForm({
                            ...form,
                            days_of_week: on ? form.days_of_week.filter((x) => x !== d.value) : [...form.days_of_week, d.value],
                          })}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-smooth ${on ? "gradient-primary text-primary-foreground border-transparent" : "border-border text-muted-foreground hover:bg-muted"}`}>
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><Label>From time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>To time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div><Label>Priority</Label><PrioritySelect value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} /></div>
              <Button onClick={create} className="w-full gradient-primary text-primary-foreground">{editingChainId ? "Save changes" : "Start"}</Button>

            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Year calendar */}
      <Card className="p-5 glass">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="h-5 w-5 text-secondary" />
          <h2 className="font-bold">Prayer calendar</h2>
          <span className="text-xs text-muted-foreground ml-2">Pick any day to view or assign a leader</span>
        </div>
        <div className="grid md:grid-cols-[auto,1fr] gap-5">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            weekStartsOn={0}
            modifiers={{ assigned: assignedDates }}
            modifiersClassNames={{ assigned: "bg-secondary/25 text-secondary-foreground font-bold rounded-md" }}
            className={cn("p-3 pointer-events-auto rounded-md border border-border")}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Selected day</div>
                <div className="font-bold text-lg">{selectedDate ? format(selectedDate, "EEEE, MMM dd, yyyy") : "—"}</div>
              </div>
              {isLead && selectedDate && (
                <Button size="sm" variant="outline" onClick={() => openAssignFor(selectedDate)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Assign
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {selectedLeaders.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No leader assigned for this day.</p>
              )}
              {selectedLeaders.map((entry: any) => {
                const m = memberMap[entry.member_id];
                return (
                  <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card/40">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ background: avatarGradient(entry.member_id), color: "white" }} className="text-xs">
                        {initials(m?.full_name || m?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m?.full_name || m?.email || "—"}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {(entry.start_time || entry.end_time) && (
                          <span>{entry.start_time?.slice(0,5) ?? ""}{entry.end_time ? `–${entry.end_time.slice(0,5)}` : ""}</span>
                        )}
                        {entry.focus && <span className="inline-flex items-center gap-1 text-secondary"><Target className="h-3 w-3" />{entry.focus}</span>}
                      </div>
                    </div>
                    {isLead && (
                      <>
                        <button onClick={() => openEditLeader(entry)} className="text-muted-foreground hover:text-primary transition-smooth" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteLeader(entry.id)} className="text-muted-foreground hover:text-destructive transition-smooth" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* This week calendar */}
      <Card className="p-5 glass">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="h-5 w-5 text-secondary" />
          <h2 className="font-bold">Prayer leaders — this week ({format(weekStart, "MMM dd")})</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekDays.map(({ date, dow, leaders: dayLeaders }) => (
            <div key={dow} className="rounded-xl border border-border p-3 bg-card/40 min-h-[130px]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{DAYS.find(d => d.value === dow)?.short}</div>
                  <div className="font-bold">{format(date, "MMM dd")}</div>
                </div>
                {isLead && (
                  <button onClick={() => openAssignFor(date)} className="text-muted-foreground hover:text-primary transition-smooth" aria-label="Assign">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {dayLeaders.length === 0 && <div className="text-xs text-muted-foreground italic">Open</div>}
                {dayLeaders.map((entry: any) => {
                  const m = memberMap[entry.member_id];
                  return (
                    <div key={entry.id} className="flex items-center gap-1.5">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback style={{ background: avatarGradient(entry.member_id), color: "white" }} className="text-[10px]">
                          {initials(m?.full_name || m?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{m?.full_name || m?.email || "—"}</div>
                        {(entry.start_time || entry.end_time) && (
                          <div className="text-[10px] text-muted-foreground">{entry.start_time?.slice(0,5)}{entry.end_time ? `–${entry.end_time.slice(0,5)}` : ""}</div>
                        )}
                        {entry.focus && <div className="text-[10px] text-secondary truncate">🎯 {entry.focus}</div>}
                      </div>
                      {isLead && (
                        <>
                          <button onClick={() => openEditLeader(entry)} className="text-muted-foreground hover:text-primary transition-smooth" aria-label="Edit"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => deleteLeader(entry.id)} className="text-muted-foreground hover:text-destructive transition-smooth" aria-label="Remove"><Trash2 className="h-3 w-3" /></button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Today's prayer leader */}
      {todayLeaders.length > 0 && (
        <Card className="p-5 glass border-l-4 border-l-secondary">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Prayer leader today</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {todayLeaders.map((l: any) => {
              const m = memberMap[l.member_id];
              return (
                <span key={l.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                  <Avatar className="h-5 w-5"><AvatarFallback style={{ background: avatarGradient(l.member_id), color: "white" }} className="text-[9px]">{initials(m?.full_name || m?.email)}</AvatarFallback></Avatar>
                  <span className="font-medium">{m?.full_name || m?.email}</span>
                  {l.focus && <span className="opacity-80">• 🎯 {l.focus}</span>}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* My assignments */}
      {myLeaderEntries.length > 0 && (
        <Card className="p-5 glass border-l-4 border-l-primary">
          <h3 className="font-bold mb-2">Your prayer assignments</h3>
          <div className="flex flex-wrap gap-2">
            {myLeaderEntries.map((l: any) => {
              const dateStr = l.scheduled_date
                ? format(parseISO(l.scheduled_date), "EEE, MMM dd")
                : `Week of ${format(new Date(l.week_start_date), "MMM dd")} • ${DAYS.find(d => d.value === l.day_of_week)?.label ?? ""}`;
              return (
                <span key={l.id} className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                  {dateStr}
                  {l.start_time ? ` • ${l.start_time.slice(0,5)}` : ""}
                  {l.end_time ? `–${l.end_time.slice(0,5)}` : ""}
                  {l.focus ? ` • 🎯 ${l.focus}` : ""}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* Chains list */}
      <div className="grid md:grid-cols-2 gap-4">
        {chains?.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">No prayer chains yet.</p>}
        {chains?.map((c: any) => {
          const recurrenceLabel =
            c.recurrence === "daily" ? "Every day"
            : c.recurrence === "weekly"
              ? `Weekly: ${(c.days_of_week ?? []).map((d: number) => DAYS.find(x => x.value === d)?.short).filter(Boolean).join(", ") || "—"}`
              : "One-off";
          return (
            <Card key={c.id} className="p-5 glass transition-smooth hover:shadow-elegant">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-lg">{c.name}</h3><PriorityBadge level={c.priority} /></div>

                {c.answered ? (
                  <span className="gradient-gold text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1 font-bold"><Sparkles className="h-3 w-3" /> Answered</span>
                ) : (
                  <span className="bg-accent/20 text-accent text-xs px-2 py-1 rounded-full flex items-center gap-1 animate-pulse-ring">● Active</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                {c.type === "continuous" ? "Continuous • " : "Scheduled • "}{recurrenceLabel} • {format(new Date(c.start_date), "MMM dd")}{c.end_date ? ` – ${format(new Date(c.end_date), "MMM dd")}` : ""}
              </div>
              {(c.start_time || c.end_time) && (
                <div className="text-xs text-secondary flex items-center gap-1 mb-2"><Clock className="h-3 w-3" /> {c.start_time?.slice(0,5) ?? "—"}{c.end_time ? ` – ${c.end_time.slice(0,5)}` : ""}</div>
              )}
              {c.description && <p className="text-sm text-muted-foreground mb-3">{c.description}</p>}
              {isLead && (
                <div className="flex gap-2 flex-wrap">
                  {!c.answered && (
                    <Button size="sm" variant="outline" onClick={() => markAnswered(c.id)} className="border-secondary text-secondary hover:bg-secondary/10">
                      Mark answered
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEditChain(c)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteChain(c.id, c.name)} className="border-destructive/50 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
