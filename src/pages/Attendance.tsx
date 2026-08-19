import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCanManage } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClipboardCheck, Users, MessageSquare, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { AttendanceTotals, AttendanceFilterChips, type RosterStatus } from "@/components/AttendanceFilterBar";

type Status = "present" | "late" | "absent" | "excused";

const STATUS_META: Record<Status, { label: string; ring: string }> = {
  present: { label: "Present",         ring: "bg-accent text-accent-foreground border-transparent" },
  late:    { label: "Late",             ring: "bg-warning text-secondary-foreground border-transparent" },
  absent:  { label: "Absent",          ring: "bg-destructive text-destructive-foreground border-transparent" },
  excused: { label: "Excused",         ring: "bg-muted-foreground text-background border-transparent" },
};
const STATUSES: Status[] = ["present", "late", "absent", "excused"];

function lateCutoff(rehearsal: any): number | null {
  if (!rehearsal) return null;
  if (rehearsal.late_after) return new Date(rehearsal.late_after).getTime();
  // No default grace period — leads must configure "late after" explicitly.
  return null;
}

export default function Attendance() {
  const { team, profile } = useAuth();
  const isLead = useCanManage("attendance");
  const qc = useQueryClient();
  const [selectedRehearsal, setSelectedRehearsal] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<RosterStatus | "all">("all");
  const [editingLateAfter, setEditingLateAfter] = useState("");

  const { data: rehearsals } = useQuery({
    queryKey: ["rehearsals-att", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("rehearsals").select("*").eq("team_id", team!.id).order("date", { ascending: false })).data ?? [],
  });

  const { data: members } = useQuery({
    queryKey: ["members-active", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("team_id", team!.id).eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: records } = useQuery({
    queryKey: ["attendance", selectedRehearsal],
    enabled: !!selectedRehearsal,
    queryFn: async () =>
      (await supabase.from("attendance").select("*").eq("rehearsal_id", selectedRehearsal!)).data ?? [],
  });

  const currentRehearsal: any = rehearsals?.find((r: any) => r.id === selectedRehearsal);

  const mark = async (memberId: string, status: Status) => {
    if (!selectedRehearsal || !profile) return;
    const remark = remarks[memberId] ?? records?.find((r: any) => r.member_id === memberId)?.remark ?? "";
    const { error } = await supabase.from("attendance").upsert(
      {
        rehearsal_id: selectedRehearsal,
        member_id: memberId,
        status,
        arrival_time: status === "present" || status === "late" ? new Date().toISOString() : null,
        remark: (status === "absent" || status === "excused") ? (remark || null) : null,
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
        overridden: !!records?.find((r: any) => r.member_id === memberId),
        source: "lead",
      } as any,
      { onConflict: "rehearsal_id,member_id" }
    );
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["attendance", selectedRehearsal] });
  };

  const verify = async (rec: any) => {
    if (!profile) return;
    await supabase.from("attendance").update({
      verified_by: profile.id, verified_at: new Date().toISOString(),
    }).eq("id", rec.id);
    qc.invalidateQueries({ queryKey: ["attendance", selectedRehearsal] });
    toast.success("Verified");
  };

  const clearMark = async (memberId: string) => {
    if (!selectedRehearsal) return;
    const rec = records?.find((r: any) => r.member_id === memberId);
    if (!rec) return;
    const { error } = await supabase.from("attendance").delete().eq("id", rec.id);
    if (error) toast.error(error.message);
    else { qc.invalidateQueries({ queryKey: ["attendance", selectedRehearsal] }); toast.success("Cleared"); }
  };

  const updateRemark = async (memberId: string, remark: string) => {
    setRemarks((r) => ({ ...r, [memberId]: remark }));
    const rec = records?.find((r: any) => r.member_id === memberId);
    if (!rec || (rec.status !== "absent" && rec.status !== "excused")) return;
    await supabase.from("attendance").update({ remark }).eq("id", rec.id);
    qc.invalidateQueries({ queryKey: ["attendance", selectedRehearsal] });
  };

  const saveLateAfter = async () => {
    if (!currentRehearsal) return;
    if (!editingLateAfter) {
      await supabase.from("rehearsals").update({ late_after: null }).eq("id", currentRehearsal.id);
    } else {
      const dt = new Date(`${currentRehearsal.date}T${editingLateAfter}`);
      await supabase.from("rehearsals").update({ late_after: dt.toISOString() }).eq("id", currentRehearsal.id);
    }
    qc.invalidateQueries({ queryKey: ["rehearsals-att"] });
    toast.success("Late cutoff updated");
  };

  // roster: every team member with status
  const roster = useMemo(() => {
    return (members ?? []).map((m: any) => {
      const rec: any = records?.find((r: any) => r.member_id === m.id);
      const status: RosterStatus = (rec?.status as RosterStatus) ?? "absent";
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
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">Rehearsal attendance</h1>
          <p className="text-muted-foreground">Members sign themselves in. Team lead can override.</p>
        </div>
      </div>

      <Card className="p-4 glass">
        <div className="flex flex-wrap gap-2">
          {rehearsals?.map((r: any) => (
            <button
              key={r.id}
              onClick={() => { setSelectedRehearsal(r.id); setRemarks({}); setEditingLateAfter(r.late_after ? format(new Date(r.late_after), "HH:mm") : ""); }}
              className={`px-3 py-2 rounded-lg text-sm border transition-smooth text-left ${
                selectedRehearsal === r.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
              }`}
            >
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(r.date), "MMM dd, yyyy")}</div>
            </button>
          ))}
          {rehearsals?.length === 0 && <p className="text-sm text-muted-foreground">Schedule a rehearsal first.</p>}
        </div>
      </Card>

      {selectedRehearsal && (
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
                let status: Status = "present";
                const cutoff = lateCutoff(currentRehearsal);
                if (cutoff && Date.now() > cutoff) status = "late";
                const { error } = await supabase.from("attendance").insert({
                  rehearsal_id: selectedRehearsal, member_id: profile.id, status,
                  arrival_time: new Date().toISOString(), source: "self",
                } as any);
                if (error) {
                  if ((error as any).code === "23505") toast.error("You've already signed in for this rehearsal.");
                  else toast.error(error.message);
                } else { toast.success(`Signed in (${STATUS_META[status].label})`); qc.invalidateQueries({ queryKey: ["attendance", selectedRehearsal] }); }
              };
              return (
                <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">My sign-in</div>
                    <div className="text-xs text-muted-foreground">
                      {myRec
                        ? `Signed in ${STATUS_META[myRec.status as Status]?.label.toLowerCase()} at ${myRec.arrival_time ? format(new Date(myRec.arrival_time), "p") : "—"}`
                        : "Tap to register. One sign-in per rehearsal."}
                    </div>
                  </div>
                  <Button onClick={doSelfSignIn} disabled={!!myRec} className="gradient-primary text-primary-foreground shadow-glow">
                    {myRec ? "Signed in ✓" : "Sign in"}
                  </Button>
                </div>
              );
            })()}

            <div className="space-y-3">
              {filtered.map(({ member: m, rec, status: s }) => {
                const remarkVal = remarks[m.id] ?? rec?.remark ?? "";
                return (
                  <div key={m.id} className="flex flex-wrap items-start gap-3 p-3 rounded-lg border border-border/60 bg-card/50">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>
                          {initials(m.full_name || m.email)}
                        </AvatarFallback>
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
                        const active = s === st && !!rec;
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
                    {(s === "absent" || s === "excused") && rec && (
                      <div className="w-full flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input placeholder={s === "excused" ? "Excuse remark (e.g. sick, family)" : "Reason / remark (optional)"} value={remarkVal} disabled={!isLead}
                          onChange={(e) => setRemarks((r) => ({ ...r, [m.id]: e.target.value }))}
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

      {!selectedRehearsal && (
        <Card className="p-12 glass text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Pick a rehearsal above.</p>
        </Card>
      )}
    </div>
  );
}
