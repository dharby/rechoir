import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCanManage } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { Users, MoreVertical, Trash2, RotateCcw, Ban, ShieldCheck, GraduationCap, User as UserIcon, PauseCircle, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { format, isAfter } from "date-fns";
import { Link } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Tab = "active" | "inactive" | "suspended" | "probation" | "trash";

const isSuspended = (m: any) =>
  !!m.suspended_until && isAfter(new Date(m.suspended_until), new Date());

export default function Members() {
  const { team, profile } = useAuth();
  const qc = useQueryClient();
  const isLead = useCanManage("members");
  const [tab, setTab] = useState<Tab>("active");

  const [suspendFor, setSuspendFor] = useState<any>(null);
  const [suspendForm, setSuspendForm] = useState({ days: "7", reason: "" });

  const { data: members = [] } = useQuery({
    queryKey: ["members-all", team?.id],
    enabled: !!team?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("team_id", team!.id).order("full_name");
      return data ?? [];
    },
  });

  const buckets = useMemo(() => {
    const all = members as any[];
    return {
      active: all.filter((m) => !m.deleted_at && m.is_active),
      inactive: all.filter((m) => !m.deleted_at && !m.is_active),
      suspended: all.filter((m) => !m.deleted_at && isSuspended(m)),
      probation: all.filter((m) => !m.deleted_at && m.probation_started_at),
      trash: all.filter((m) => !!m.deleted_at),
    };
  }, [members]);

  const softDelete = async (m: any) => {
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString(), deleted_by: profile?.id, is_active: false } as any)
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success(`${m.full_name || m.email} moved to Trash`);
  };

  const restore = async (m: any) => {
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: null, deleted_by: null, is_active: true } as any)
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success(`${m.full_name || m.email} restored`);
  };

  const applySuspension = async () => {
    if (!suspendFor) return;
    const days = Math.max(1, parseInt(suspendForm.days || "0", 10));
    const until = new Date(); until.setDate(until.getDate() + days);
    const { error } = await supabase.from("profiles").update({
      suspended_until: until.toISOString(), suspension_reason: suspendForm.reason || null,
    } as any).eq("id", suspendFor.id);
    if (error) return toast.error(error.message);
    setSuspendFor(null);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success(`Suspended until ${format(until, "MMM dd")}`);
  };

  const toggleActive = async (m: any) => {
    const next = !m.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: next } as any).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success(next ? "Member activated" : "Member deactivated — their dashboard is now disabled");
  };

  const lift = async (m: any) => {
    await supabase.from("profiles").update({ suspended_until: null, suspension_reason: null } as any).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success("Suspension lifted");
  };

  const moveToProbation = async (m: any) => {
    const defaultTargets = [
      { key: "training", label: "Trainings" },
      { key: "punctuality", label: "Punctuality" },
      { key: "learning", label: "Willingness to learn" },
      { key: "team_player", label: "Team player" },
    ];
    const { error } = await supabase.from("profiles").update({
      probation_started_at: new Date().toISOString(),
      probation_targets: (m.probation_targets ?? defaultTargets) as any,
    } as any).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success("Moved to Probation");
  };

  const removeFromProbation = async (m: any) => {
    await supabase.from("profiles").update({ probation_started_at: null } as any).eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["members-all"] });
    toast.success("Probation ended");
  };

  const list =
    tab === "active" ? buckets.active
      : tab === "inactive" ? buckets.inactive
      : tab === "suspended" ? buckets.suspended
      : tab === "probation" ? buckets.probation
      : buckets.trash;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Team members</h1>
            <p className="text-muted-foreground">{buckets.active.length} active • {buckets.inactive.length} inactive • {buckets.suspended.length} suspended • {buckets.probation.length} on probation • {buckets.trash.length} in trash</p>
          </div>
        </div>
        {isLead && (
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/probation"><GraduationCap className="h-4 w-4 mr-1" /> Probation</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/admin-access"><ShieldCheck className="h-4 w-4 mr-1" /> Admin access</Link></Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="active">Active ({buckets.active.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({buckets.inactive.length})</TabsTrigger>
          <TabsTrigger value="suspended">Suspended ({buckets.suspended.length})</TabsTrigger>
          <TabsTrigger value="probation">Probation ({buckets.probation.length})</TabsTrigger>
          <TabsTrigger value="trash">Trash ({buckets.trash.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-12">
                {tab === "trash" ? "No deleted members." : "No members in this list."}
              </p>
            )}
            {list.map((m: any) => {
              const suspended = isSuspended(m);
              const onProbation = !!m.probation_started_at;
              const canSeeSuspensionTag = isLead || m.id === profile?.id;
              const inTrash = !!m.deleted_at;
              return (
                <Card key={m.id} className={`p-5 glass flex items-start gap-3 transition-smooth hover:shadow-elegant ${inTrash ? "opacity-60" : ""}`}>
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>
                      {initials(m.full_name || m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{m.full_name || m.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.specialization || "—"}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1 text-secondary font-bold">
                      {(m.role ?? "member").replace("_", " ")}
                      {m.is_admin && " • admin"}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suspended && canSeeSuspensionTag && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/40">
                          <PauseCircle className="h-3 w-3" /> Suspended · until {format(new Date(m.suspended_until), "MMM d")}
                        </span>
                      )}
                      {onProbation && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/40">
                          <GraduationCap className="h-3 w-3" /> Probation
                        </span>
                      )}
                      {!m.is_active && !inTrash && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          <PowerOff className="h-3 w-3" /> Inactive
                        </span>
                      )}
                      {inTrash && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          <Trash2 className="h-3 w-3" /> Deleted {format(new Date(m.deleted_at), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>

                  {isLead && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!inTrash && (
                          <>
                            <DropdownMenuItem asChild>
                              <Link to={`/members/${m.id}`}><UserIcon className="h-4 w-4 mr-2" /> View profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {suspended ? (
                              <DropdownMenuItem onClick={() => lift(m)}>
                                <ShieldCheck className="h-4 w-4 mr-2" /> Lift suspension
                              </DropdownMenuItem>
                            ) : (
                              m.id !== profile?.id && m.role !== "team_lead" && (
                                <DropdownMenuItem onClick={() => setSuspendFor(m)}>
                                  <Ban className="h-4 w-4 mr-2" /> Suspend…
                                </DropdownMenuItem>
                              )
                            )}
                            {m.id !== profile?.id && m.role !== "team_lead" && (
                              <DropdownMenuItem onClick={() => toggleActive(m)}>
                                {m.is_active
                                  ? <><PowerOff className="h-4 w-4 mr-2" /> Deactivate member</>
                                  : <><Power className="h-4 w-4 mr-2" /> Activate member</>}
                              </DropdownMenuItem>
                            )}
                            {onProbation ? (
                              <DropdownMenuItem onClick={() => removeFromProbation(m)}>
                                <GraduationCap className="h-4 w-4 mr-2" /> End probation
                              </DropdownMenuItem>
                            ) : (
                              m.role !== "team_lead" && (
                                <DropdownMenuItem onClick={() => moveToProbation(m)}>
                                  <GraduationCap className="h-4 w-4 mr-2" /> Move to probation
                                </DropdownMenuItem>
                              )
                            )}
                            {m.id !== profile?.id && m.role !== "team_lead" && (
                              <>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete {m.full_name || m.email}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        They'll be moved to Trash. You can restore them any time from the Trash tab.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => softDelete(m)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </>
                        )}
                        {inTrash && (
                          <DropdownMenuItem onClick={() => restore(m)}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Restore
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Suspend dialog */}
      <Dialog open={!!suspendFor} onOpenChange={(o) => !o && setSuspendFor(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>Suspend {suspendFor?.full_name || suspendFor?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Adds a suspension tag visible only to this member and team leads. Member activities are not blocked.
            </p>
            <div>
              <Label>Duration (days)</Label>
              <Input type="number" min={1} value={suspendForm.days} onChange={(e) => setSuspendForm({ ...suspendForm, days: e.target.value })} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea rows={3} value={suspendForm.reason} onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })} placeholder="Repeated absences…" />
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={applySuspension}>
              Apply suspension
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
