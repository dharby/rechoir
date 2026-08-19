import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { ArrowLeft, Mail, Phone, Music, Calendar, CheckSquare, HeartHandshake, CreditCard, Sparkles, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useState } from "react";

function Stat({ icon: Icon, label, value, sub }: any) {
  return (
    <Card className="p-4 glass">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

const STATUS_LABEL: Record<string, string> = {
  on_time: "Present", late: "Late", very_late: "Late", absent: "Absent", excused: "Excused",
};
const STATUS_TONE: Record<string, string> = {
  on_time: "bg-accent/20 text-accent border-accent/40",
  late: "bg-warning/20 text-warning border-warning/40",
  very_late: "bg-warning/20 text-warning border-warning/40",
  absent: "bg-destructive/20 text-destructive border-destructive/40",
  excused: "bg-muted text-muted-foreground border-border",
};

export default function MemberDetail() {
  const { id } = useParams();
  const { profile: me } = useAuth();
  const isLead = me?.role === "team_lead";
  const [drill, setDrill] = useState<{ label: string; rows: any[] } | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", id!).maybeSingle()).data,
  });

  const { data: svcAtt = [] } = useQuery({
    queryKey: ["m-svc", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("service_attendance").select("*, event:service_events(id, title, date, kind)").eq("member_id", id!)).data ?? [],
  });

  const { data: songs = [] } = useQuery({
    queryKey: ["m-songs", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("song_assignments").select("*").eq("member_id", id!)).data ?? [],
  });

  const { data: prayerLeads = [] } = useQuery({
    queryKey: ["m-prayer", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("prayer_leader_schedule").select("*").eq("member_id", id!)).data ?? [],
  });

  const { data: pays = [] } = useQuery({
    queryKey: ["m-pay", id],
    enabled: !!id,
    queryFn: async () =>
      (await supabase.from("payment_records").select("*").eq("member_id", id!).eq("is_paid", true)).data ?? [],
  });

  const { data: taskAssignments = [] } = useQuery({
    queryKey: ["m-task", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("checklist_item_assignees").select("*").eq("user_id", id!)).data ?? [],
  });

  if (!profile) return <div className="text-center py-16 text-muted-foreground">Loading…</div>;
  if (!isLead && me?.id !== profile.id) {
    return <div className="text-center py-16 text-muted-foreground">You can only view your own profile.</div>;
  }

  const breakdown = { present: 0, late: 0, absent: 0, excused: 0 };
  svcAtt.forEach((a: any) => {
    const k = a.status === "on_time" ? "present" : a.status === "very_late" ? "late" : a.status;
    if (k in breakdown) (breakdown as any)[k]++;
  });
  const rate = svcAtt.length ? Math.round(((breakdown.present + breakdown.late) / svcAtt.length) * 100) : 0;
  const totalPaid = pays.reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);
  const leadSongs = songs.filter((s: any) => s.is_lead).length;
  const doneTasks = taskAssignments.filter((t: any) => t.completed_at).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button asChild variant="ghost" size="sm"><Link to="/members"><ArrowLeft className="h-4 w-4 mr-1" /> Back to members</Link></Button>

      <Card className="p-6 glass flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarFallback style={{ background: avatarGradient(profile.id), color: "white" }} className="text-xl">
            {initials(profile.full_name || profile.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{profile.full_name || profile.email}</h1>
          <div className="text-sm text-muted-foreground capitalize">{profile.role?.replace("_", " ")}{profile.is_admin && " • admin"}</div>
          <div className="mt-2 space-y-0.5 text-sm">
            {profile.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {profile.email}</div>}
            {profile.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {profile.phone}</div>}
            {profile.specialization && <div className="flex items-center gap-2"><Music className="h-3.5 w-3.5 text-muted-foreground" /> {profile.specialization}</div>}
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat icon={Calendar} label="Sign-in attendance" value={`${rate}%`} sub={`${breakdown.present + breakdown.late}/${svcAtt.length} events (services + rehearsals)`} />
        <Stat icon={CheckSquare} label="Tasks completed" value={doneTasks} sub={`${taskAssignments.length} assigned`} />
        <Stat icon={Music} label="Songs assigned" value={songs.length} sub={`${leadSongs} as lead`} />
        <Stat icon={HeartHandshake} label="Prayer leads" value={prayerLeads.length} sub="scheduled" />
        <Stat icon={CreditCard} label="Total paid" value={`₦${totalPaid.toLocaleString()}`} sub={`${pays.length} payments`} />
      </div>

      <BreakdownCard title="Sign-in attendance breakdown" b={breakdown} total={svcAtt.length} />

      <TrendChart svc={svcAtt} onDrill={setDrill} allowAllTime={isLead} />

      {profile.probation_started_at && (
        <Card className="p-4 glass border-l-4 border-l-warning">
          <div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-warning" /> On probation since {format(new Date(profile.probation_started_at), "MMM dd, yyyy")}</div>
          <Link to="/probation" className="text-sm text-primary underline">Track probation progress →</Link>
        </Card>
      )}

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader><DialogTitle>Sign-in details • {drill?.label}</DialogTitle></DialogHeader>
          {drill && drill.rows.length === 0 && <p className="text-sm text-muted-foreground">No records in this period.</p>}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {drill?.rows.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card/50">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.event?.title || "Event"}</div>
                  <div className="text-xs text-muted-foreground capitalize">{r.event?.kind || "—"} • {r.event?.date ? format(new Date(r.event.date), "EEE MMM dd, yyyy") : ""}</div>
                </div>
                <Badge variant="outline" className={STATUS_TONE[r.status] || ""}>{STATUS_LABEL[r.status] || r.status}</Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BreakdownCard({ title, b, total }: { title: string; b: { present: number; late: number; absent: number; excused: number }; total: number }) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const rows: Array<[string, number, string]> = [
    ["Present", b.present, "bg-accent"],
    ["Late", b.late, "bg-warning"],
    ["Absent", b.absent, "bg-destructive"],
    ["Excused", b.excused, "bg-muted-foreground"],
  ];
  return (
    <Card className="p-5 glass">
      <div className="font-semibold mb-3">{title}</div>
      {total === 0 && <div className="text-xs text-muted-foreground">No records yet.</div>}
      {rows.map(([label, n, color]) => (
        <div key={label} className="mb-2">
          <div className="flex justify-between text-xs mb-1"><span>{label}</span><span className="text-muted-foreground">{n} • {pct(n)}%</span></div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={`${color} h-full transition-all`} style={{ width: `${pct(n)}%` }} /></div>
        </div>
      ))}
    </Card>
  );
}

function TrendChart({ svc, onDrill, allowAllTime }: { svc: any[]; onDrill: (d: { label: string; rows: any[] }) => void; allowAllTime?: boolean }) {
  const [range, setRange] = useState<"12w" | "all">("12w");
  const now = new Date();

  const dates = svc.map((r) => (r.event?.date ? new Date(r.event.date) : null)).filter(Boolean) as Date[];
  const earliest = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : now;
  const weekCount =
    range === "all" && allowAllTime
      ? Math.max(12, Math.min(260, Math.ceil((now.getTime() - earliest.getTime()) / (7 * 864e5)) + 1))
      : 12;

  const weeks: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const end = subDays(now, i * 7);
    const start = subDays(end, 6);
    weeks.push({ key: format(end, "yyyy-MM-dd"), label: format(end, "MMM d"), start, end });
  }
  const rowsInBucket = (start: Date, end: Date) =>
    svc.filter((r) => {
      const d = r.event?.date ? new Date(r.event.date) : null;
      return d && d >= start && d <= end;
    });
  const rate = (rows: any[]) => {
    if (!rows.length) return null;
    const present = rows.filter((r) => r.status === "on_time" || r.status === "late" || r.status === "very_late").length;
    return Math.round((present / rows.length) * 100);
  };
  const data = weeks.map((w) => {
    const rows = rowsInBucket(w.start, w.end);
    return {
      week: w.label,
      "Sign-in": rate(rows),
      _rows: rows,
    };
  });
  const hasAny = data.some((d) => d["Sign-in"] !== null);


  return (
    <Card className="p-5 glass">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <div className="font-semibold">Sign-in attendance trend ({range === "all" && allowAllTime ? "all time" : "12 weeks"})</div>
        {allowAllTime && (
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant={range === "12w" ? "default" : "outline"} onClick={() => setRange("12w")}>12 weeks</Button>
            <Button size="sm" variant={range === "all" ? "default" : "outline"} onClick={() => setRange("all")}>All time</Button>
          </div>
        )}
        <span className={`text-xs text-muted-foreground ${allowAllTime ? "" : "ml-auto"}`}>Click a point to drill down</span>
      </div>

      {!hasAny ? (
        <div className="text-xs text-muted-foreground">Not enough attendance data yet.</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              onClick={(state: any) => {
                const p = state?.activePayload?.[0]?.payload;
                if (p) onDrill({ label: `Week of ${p.week}`, rows: p._rows });
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => (v == null ? "—" : `${v}%`)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Sign-in" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
