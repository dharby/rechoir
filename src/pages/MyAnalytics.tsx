import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Music2, ClipboardCheck, ListChecks, CreditCard, Sparkles, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { format, subDays } from "date-fns";

type Range = 30 | 90 | 365;

export default function MyAnalytics() {
  const { profile, team } = useAuth();
  const [range, setRange] = useState<Range>(90);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - range);
    return d.toISOString().slice(0, 10);
  }, [range]);

  // Unified sign-in attendance (services + rehearsals + special events, all live in service_attendance)
  const { data: serviceRows = [] } = useQuery({
    queryKey: ["my-service-att", profile?.id, since],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_attendance")
        .select("status, event:service_events(date, kind, title)")
        .eq("member_id", profile!.id);
      return (data ?? []).filter((r: any) => !r.event?.date || r.event.date >= since);
    },
  });

  // Checklist items
  const { data: checklistItems = [] } = useQuery({
    queryKey: ["my-checklist", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("checklist_items").select("id, is_completed").eq("member_id", profile!.id)).data ?? [],
  });

  // Songs
  const { data: songAssignments = [] } = useQuery({
    queryKey: ["my-songs", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("song_assignments").select("status, is_lead").eq("member_id", profile!.id)).data ?? [],
  });

  // Prayer assignments
  const { data: prayerAssignments = [] } = useQuery({
    queryKey: ["my-prayer", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("prayer_chain_assignments").select("id").eq("member_id", profile!.id)).data ?? [],
  });

  // Dues
  const { data: paymentRows = [] } = useQuery({
    queryKey: ["my-payments", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("payment_records").select("status, amount_paid").eq("member_id", profile!.id)).data ?? [],
  });

  const stats = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0 };
    serviceRows.forEach((r: any) => {
      const s = r.status === "on_time" ? "present" : r.status === "very_late" ? "late" : r.status;
      if (s in c) (c as any)[s] += 1;
    });
    const total = c.present + c.late + c.absent + c.excused;
    const attended = c.present + c.late;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const done = checklistItems.filter((i: any) => i.is_completed).length;
    const taskRate = checklistItems.length > 0 ? Math.round((done / checklistItems.length) * 100) : 0;
    const leadCount = songAssignments.filter((a: any) => a.is_lead).length;
    const paidTotal = paymentRows.reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);
    return { c, total, rate, taskRate, done, leadCount, paidTotal };
  }, [serviceRows, checklistItems, songAssignments, paymentRows]);

  const chartData = [
    { name: "Present", value: stats.c.present, fill: "hsl(var(--accent))" },
    { name: "Late",    value: stats.c.late,    fill: "hsl(var(--warning))" },
    { name: "Absent",  value: stats.c.absent,  fill: "hsl(var(--destructive))" },
    { name: "Excused", value: stats.c.excused, fill: "hsl(var(--muted-foreground))" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-extrabold">My analytics</h1>
            <p className="text-muted-foreground">How you've been showing up</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[30, 90, 365].map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r as Range)}>
              {r === 365 ? "1y" : `${r}d`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ClipboardCheck} label="Attendance rate" value={`${stats.rate}%`} hint={`${stats.c.present + stats.c.late} of ${stats.total}`} />
        <StatCard icon={ListChecks} label="Tasks done" value={`${stats.taskRate}%`} hint={`${stats.done}/${checklistItems.length}`} />
        <StatCard icon={Music2} label="Songs" value={`${songAssignments.length}`} hint={`${stats.leadCount} as lead`} />
        <StatCard icon={Sparkles} label="Prayer leads" value={`${prayerAssignments.length}`} />
      </div>

      <Card className="p-5 glass">
        <div className="text-sm font-semibold mb-3">Attendance breakdown</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <TrendCard serviceRows={serviceRows} range={range} />



      <Card className="p-5 glass">
        <div className="flex items-center gap-2 mb-3"><CreditCard className="h-4 w-4 text-primary" /><div className="font-semibold">Dues</div></div>
        <div className="text-2xl font-extrabold">{stats.paidTotal.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">Total paid across {paymentRows.length} record(s)</div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 glass">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-extrabold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function TrendCard({ serviceRows, range }: { serviceRows: any[]; range: number }) {
  // Bucket: for 30d -> daily; 90d -> weekly (13); 365 -> monthly (12)
  const now = new Date();
  const buckets: { label: string; start: Date; end: Date }[] = [];
  if (range === 30) {
    for (let i = 29; i >= 0; i--) {
      const d = subDays(now, i);
      buckets.push({ label: format(d, "MMM d"), start: new Date(d.setHours(0,0,0,0)), end: new Date(new Date(d).setHours(23,59,59,999)) });
    }
  } else if (range === 90) {
    for (let i = 12; i >= 0; i--) {
      const end = subDays(now, i * 7);
      const start = subDays(end, 6);
      buckets.push({ label: format(end, "MMM d"), start, end });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const end = subDays(now, i * 30);
      const start = subDays(end, 29);
      buckets.push({ label: format(end, "MMM"), start, end });
    }
  }
  const rate = (rows: any[], start: Date, end: Date) => {
    const inRange = rows.filter((r: any) => {
      const d = r.event?.date ? new Date(r.event.date) : null;
      return d && d >= start && d <= end;
    });
    if (!inRange.length) return null;
    const present = inRange.filter((r: any) => r.status === "on_time" || r.status === "late" || r.status === "very_late").length;
    return Math.round((present / inRange.length) * 100);
  };
  const data = buckets.map((b) => ({
    label: b.label,
    "Sign-in": rate(serviceRows, b.start, b.end),
  }));
  const hasAny = data.some((d) => d["Sign-in"] !== null);

  return (
    <Card className="p-5 glass">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Sign-in attendance trend</div>
      </div>
      {!hasAny ? (
        <div className="text-xs text-muted-foreground">Not enough attendance data in this range.</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => (v == null ? "—" : `${v}%`)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Sign-in" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
