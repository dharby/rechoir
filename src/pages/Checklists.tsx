import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCanManage } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Plus, Trash2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { notifyTeam, notifyUsers } from "@/lib/notifications";
import { sendUserPush } from "@/lib/notify";
import { PriorityBadge, PrioritySelect } from "@/components/PriorityBadge";

type Member = { id: string; full_name: string | null; email: string };

export default function Checklists() {
  const { team, profile } = useAuth();
  const isLead = useCanManage("checklists");
  const qc = useQueryClient();

  const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [openList, setOpenList] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);

  // List creation form
  const [listForm, setListForm] = useState({ title: "", priority: 2, statusOptions: ["Not started", "In progress", "Done"] as string[] });

  const [aiBusy, setAiBusy] = useState(false);
  const [suggestedEntries, setSuggestedEntries] = useState<string[]>([]);

  // Item form (multi-member)
  const [itemForm, setItemForm] = useState({ description: "", memberIds: [] as string[] });

  const { data: checklists } = useQuery({
    queryKey: ["checklists", team?.id, weekStart],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("weekly_checklists").select("*").eq("team_id", team!.id).eq("week_start_date", weekStart)).data ?? [],
  });
  const checklistIds = (checklists ?? []).map((c: any) => c.id);

  const { data: items } = useQuery({
    queryKey: ["checklist-items", checklistIds],
    enabled: checklistIds.length > 0,
    queryFn: async () =>
      (await supabase.from("checklist_items").select("*").in("checklist_id", checklistIds)).data ?? [],
  });

  const itemIds = (items ?? []).map((i: any) => i.id);
  const { data: assignees = [] } = useQuery({
    queryKey: ["checklist-item-assignees", itemIds],
    enabled: itemIds.length > 0,
    queryFn: async () =>
      (await supabase.from("checklist_item_assignees").select("*").in("item_id", itemIds)).data ?? [],
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members-active", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      ((await supabase.from("profiles").select("id, full_name, email").eq("team_id", team!.id).eq("is_active", true)).data ?? []) as Member[],
  });
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

  const aiSuggest = async () => {
    if (!listForm.title) { toast.error("Enter a topic first"); return; }
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-checklist-entries", { body: { topic: listForm.title } });
      if (error) throw error;
      if (data?.entries?.length) setSuggestedEntries(data.entries);
      if (data?.statusOptions?.length) setListForm((f) => ({ ...f, statusOptions: data.statusOptions }));
      toast.success("AI suggestions ready — edit as you like");
    } catch (e: any) {
      toast.error(e?.message || "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  const createList = async () => {
    if (!team || !listForm.title) { toast.error("Title required"); return; }
    const { data: cl, error } = await supabase.from("weekly_checklists").insert({
      team_id: team.id, title: listForm.title, week_start_date: weekStart,
      status_options: listForm.statusOptions,
      priority: listForm.priority,
    } as any).select().single();
    if (error || !cl) { toast.error(error?.message || "Failed"); return; }
    // Insert any AI-suggested entries
    if (suggestedEntries.length) {
      await supabase.from("checklist_items").insert(
        suggestedEntries.map((d) => ({ checklist_id: cl.id, description: d, member_id: profile!.id })) as any
      );
    }
    setOpenList(false);
    setListForm({ title: "", priority: 2, statusOptions: ["Not started", "In progress", "Done"] });

    setSuggestedEntries([]);
    qc.invalidateQueries({ queryKey: ["checklists"] });
    qc.invalidateQueries({ queryKey: ["checklist-items"] });
    toast.success("Checklist created");
    notifyTeam({
      teamId: team.id, excludeUserId: profile?.id,
      title: "✅ New weekly checklist",
      body: `${listForm.title} — week of ${format(new Date(weekStart), "MMM d")}`,
      link: "/checklists", category: "announcement", tag: "checklist",
    });
  };

  const addItem = async (checklistId: string) => {
    if (!itemForm.description) { toast.error("Description required"); return; }
    const memberIds = itemForm.memberIds.length ? itemForm.memberIds : members.map((m) => m.id);
    // Single item, multi-assignee
    const { data: item, error } = await supabase.from("checklist_items").insert({
      checklist_id: checklistId, description: itemForm.description, member_id: profile!.id,
    } as any).select().single();
    if (error || !item) { toast.error(error?.message || "Failed"); return; }
    await supabase.from("checklist_item_assignees").insert(
      memberIds.map((uid) => ({ item_id: item.id, user_id: uid })) as any
    );
    setOpenItem(null);
    setItemForm({ description: "", memberIds: [] });
    qc.invalidateQueries({ queryKey: ["checklist-items"] });
    qc.invalidateQueries({ queryKey: ["checklist-item-assignees"] });
    toast.success("Task added");
    const targets = memberIds.filter((id) => id !== profile?.id);
    if (targets.length) {
      notifyUsers({
        userIds: targets, title: "📝 New checklist task",
        body: itemForm.description, link: "/checklists", category: "reminder",
      });
      sendUserPush({ userIds: targets, title: "📝 New checklist task", body: itemForm.description, url: "/checklists", tag: `checklist-item:${item.id}` });
    }
  };

  const setMyStatus = async (itemId: string, status: string) => {
    if (!profile) return;
    const existing = assignees.find((a: any) => a.item_id === itemId && a.user_id === profile.id);
    if (existing) {
      await supabase.from("checklist_item_assignees").update({ status }).eq("id", existing.id);
    } else {
      await supabase.from("checklist_item_assignees").insert({ item_id: itemId, user_id: profile.id, status });
    }
    qc.invalidateQueries({ queryKey: ["checklist-item-assignees"] });
  };

  const deleteList = async (id: string) => {
    if (!confirm("Delete this checklist and all its items?")) return;
    await supabase.from("checklist_items").delete().eq("checklist_id", id);
    await supabase.from("weekly_checklists").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["checklists"] });
    qc.invalidateQueries({ queryKey: ["checklist-items"] });
    toast.success("Deleted");
  };

  const deleteItem = async (id: string) => {
    await supabase.from("checklist_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["checklist-items"] });
  };

  const toggleAssignee = (id: string) =>
    setItemForm((f) => ({ ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter((x) => x !== id) : [...f.memberIds, id] }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ListChecks className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Weekly checklists</h1>
            <p className="text-muted-foreground">Multi-member tasks with custom statuses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="w-[160px]" />
          {isLead && (
            <Dialog open={openList} onOpenChange={setOpenList}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />New list</Button>
              </DialogTrigger>
              <DialogContent className="glass max-w-lg">
                <DialogHeader><DialogTitle>New checklist for week of {format(new Date(weekStart), "MMM dd")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Topic / title</Label>
                    <div className="flex gap-2">
                      <Input value={listForm.title} onChange={(e) => setListForm({ ...listForm, title: e.target.value })} placeholder="Song readiness, Dues, Uniform check…" />
                      <Button variant="outline" onClick={aiSuggest} disabled={aiBusy}>
                        <Sparkles className="h-4 w-4 mr-1" /> {aiBusy ? "..." : "AI"}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Status options (members will pick one)</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {listForm.statusOptions.map((opt, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-card text-xs">
                          <input className="bg-transparent border-none outline-none w-[100px]"
                            value={opt}
                            onChange={(e) => setListForm({ ...listForm, statusOptions: listForm.statusOptions.map((o, j) => j === i ? e.target.value : o) })} />
                          <button onClick={() => setListForm({ ...listForm, statusOptions: listForm.statusOptions.filter((_, j) => j !== i) })}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => setListForm({ ...listForm, statusOptions: [...listForm.statusOptions, "New"] })}>+ add</Button>
                    </div>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <PrioritySelect value={listForm.priority} onChange={(v) => setListForm({ ...listForm, priority: v })} />
                  </div>

                  {suggestedEntries.length > 0 && (
                    <div>
                      <Label>Suggested entries (edit / remove before creating)</Label>
                      <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                        {suggestedEntries.map((e, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input value={e} onChange={(ev) => setSuggestedEntries(suggestedEntries.map((x, j) => j === i ? ev.target.value : x))} />
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setSuggestedEntries(suggestedEntries.filter((_, j) => j !== i))}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button onClick={createList} className="w-full gradient-primary text-primary-foreground">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {checklists?.length === 0 && (
        <Card className="p-12 glass text-center text-muted-foreground">No checklists for this week yet.</Card>
      )}

      <div className="space-y-4">
        {checklists?.map((c: any) => {
          const cItems = (items ?? []).filter((i: any) => i.checklist_id === c.id);
          const statusOptions: string[] = Array.isArray(c.status_options) ? c.status_options : ["Not started", "In progress", "Done"];
          const doneOption = statusOptions[statusOptions.length - 1];

          // Visible items: leads see all; members see ones assigned to them
          const visible = cItems.filter((i: any) =>
            isLead || assignees.some((a: any) => a.item_id === i.id && a.user_id === profile?.id)
          );

          const totalAssigneeRows = assignees.filter((a: any) => cItems.some((i: any) => i.id === a.item_id)).length;
          const doneRows = assignees.filter((a: any) => cItems.some((i: any) => i.id === a.item_id) && a.status === doneOption).length;
          const pct = totalAssigneeRows > 0 ? Math.round((doneRows / totalAssigneeRows) * 100) : 0;

          return (
            <Card key={c.id} className="p-5 glass space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-lg">{c.title}</h3><PriorityBadge level={(c as any).priority} /></div>

                  <div className="text-xs text-muted-foreground flex flex-wrap gap-1 mt-1">
                    Statuses:
                    {statusOptions.map((o) => <span key={o} className="px-1.5 py-0.5 rounded bg-muted">{o}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">{doneRows}/{totalAssigneeRows} {doneOption.toLowerCase()}</div>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                  {isLead && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setOpenItem(c.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Add task
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteList(c.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {visible.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No tasks {isLead ? "yet" : "assigned to you"}.</p>
                )}
                {visible.map((i: any) => {
                  const taskAssignees = assignees.filter((a: any) => a.item_id === i.id);
                  const myA = taskAssignees.find((a: any) => a.user_id === profile?.id);
                  return (
                    <div key={i.id} className="p-3 rounded-lg border border-border/60 bg-card/40 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm flex-1">{i.description}</div>
                        {isLead && (
                          <Button size="icon" variant="ghost" onClick={() => deleteItem(i.id)} className="text-destructive h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {myA !== undefined || (taskAssignees.some((a: any) => a.user_id === profile?.id)) ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">My status:</span>
                          {statusOptions.map((opt) => (
                            <button key={opt} onClick={() => setMyStatus(i.id, opt)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-smooth ${myA?.status === opt ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border hover:bg-muted"}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {isLead && taskAssignees.length > 0 && (
                        <div className="pt-2 border-t border-border/40">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Per-member status</div>
                          <div className="flex flex-wrap gap-1.5">
                            {taskAssignees.map((a: any) => {
                              const m = memberMap[a.user_id];
                              return (
                                <div key={a.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-card/60 text-xs">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback style={{ background: avatarGradient(a.user_id), color: "white" }} className="text-[9px]">
                                      {initials(m?.full_name || m?.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate max-w-[100px]">{m?.full_name || m?.email || "—"}</span>
                                  <span className="text-muted-foreground">{a.status ?? "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add task dialog */}
      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Add task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Task description</Label>
              <Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Bring music sheets" />
            </div>
            <div>
              <Label>Assigned to {itemForm.memberIds.length ? `(${itemForm.memberIds.length})` : "(everyone)"}</Label>
              <div className="space-y-1 max-h-60 overflow-y-auto mt-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={itemForm.memberIds.includes(m.id)} onCheckedChange={() => toggleAssignee(m.id)} />
                    <span className="text-sm">{m.full_name || m.email}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave empty to assign to everyone.</p>
            </div>
            <Button onClick={() => openItem && addItem(openItem)} className="w-full gradient-primary text-primary-foreground">Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
