import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { GraduationCap, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

type Target = { key: string; label: string };

const DEFAULTS: Target[] = [
  { key: "training", label: "Trainings" },
  { key: "punctuality", label: "Punctuality" },
  { key: "learning", label: "Willingness to learn" },
  { key: "team_player", label: "Team player" },
];

export default function Probation() {
  const { team, profile: me } = useAuth();
  const qc = useQueryClient();
  const isLead = me?.role === "team_lead";
  const [scoreFor, setScoreFor] = useState<{ member: any; target: Target } | null>(null);
  const [scoreForm, setScoreForm] = useState({ score: "70", note: "" });

  const { data: members = [] } = useQuery({
    queryKey: ["probation-members", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("profiles").select("*")
        .eq("team_id", team!.id).is("deleted_at", null)
        .not("probation_started_at", "is", null)).data ?? [],
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["probation-scores", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("probation_scores").select("*").eq("team_id", team!.id)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const latestFor = (memberId: string, key: string) =>
    (scores as any[]).find((s) => s.member_id === memberId && s.target_key === key);

  const avgFor = (memberId: string, targets: Target[]) => {
    const vals = targets.map((t) => latestFor(memberId, t.key)?.score).filter((v) => v !== undefined);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  };

  const saveScore = async () => {
    if (!scoreFor || !team || !me) return;
    const s = Math.max(0, Math.min(100, parseInt(scoreForm.score || "0", 10)));
    const { error } = await supabase.from("probation_scores").insert({
      member_id: scoreFor.member.id, team_id: team.id,
      target_key: scoreFor.target.key, score: s, note: scoreForm.note || null,
      recorded_by: me.id,
    } as any);
    if (error) return toast.error(error.message);
    setScoreFor(null); setScoreForm({ score: "70", note: "" });
    qc.invalidateQueries({ queryKey: ["probation-scores"] });
    toast.success("Score recorded");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">Probation</h1>
            <p className="text-muted-foreground">Track member progress against targets</p>
          </div>
        </div>
        {isLead && (
          <Button asChild variant="outline" size="sm"><Link to="/invite">Invite to team</Link></Button>
        )}
      </div>

      {members.length === 0 && (
        <Card className="glass p-8 text-center text-muted-foreground">
          No members on probation. Move a member to probation from the <Link to="/members" className="underline text-primary">Members page</Link>.
        </Card>
      )}

      <div className="space-y-4">
        {(members as any[]).map((m) => {
          const targets: Target[] = (m.probation_targets as Target[]) ?? DEFAULTS;
          const overall = avgFor(m.id, targets);
          return (
            <Card key={m.id} className="p-5 glass">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>
                    {initials(m.full_name || m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link to={`/members/${m.id}`} className="font-semibold hover:underline">{m.full_name || m.email}</Link>
                  <div className="text-xs text-muted-foreground">
                    On probation since {format(new Date(m.probation_started_at), "MMM d, yyyy")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-gradient-gold">{overall}<span className="text-sm text-muted-foreground">/100</span></div>
                  <div className="text-[10px] uppercase text-muted-foreground">Overall</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {targets.map((t) => {
                  const latest = latestFor(m.id, t.key);
                  const v = latest?.score ?? 0;
                  return (
                    <div key={t.key} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="font-medium">{t.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">{v}/100</div>
                      </div>
                      <div className="h-2 mt-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full gradient-primary" style={{ width: `${v}%` }} />
                      </div>
                      {latest?.note && <div className="text-xs text-muted-foreground mt-1 italic truncate">"{latest.note}"</div>}
                      {isLead && (
                        <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs"
                          onClick={() => { setScoreFor({ member: m, target: t }); setScoreForm({ score: String(v || 70), note: "" }); }}>
                          Update score
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!scoreFor} onOpenChange={(o) => !o && setScoreFor(null)}>
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>{scoreFor?.target.label} — {scoreFor?.member.full_name || scoreFor?.member.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Score (0–100)</Label>
              <Input type="number" min={0} max={100} value={scoreForm.score}
                onChange={(e) => setScoreForm({ ...scoreForm, score: e.target.value })} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea rows={3} value={scoreForm.note}
                onChange={(e) => setScoreForm({ ...scoreForm, note: e.target.value })}
                placeholder="Attended every session this week…" />
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={saveScore}>
              <Save className="h-4 w-4 mr-1" /> Save score
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
