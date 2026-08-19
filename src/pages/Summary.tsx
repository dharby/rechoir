import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart3, Users, ClipboardCheck, CreditCard, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { format, subDays } from "date-fns";

const NGN = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function Summary() {
  const { team } = useAuth();

  const { data } = useQuery({
    queryKey: ["summary", team?.id],
    enabled: !!team?.id,
    queryFn: async () => {
      const since = subDays(new Date(), 90).toISOString().slice(0, 10);

      const [membersRes, rehRes, payRes, recsRes] = await Promise.all([
        supabase.from("profiles").select("id, is_active").eq("team_id", team!.id),
        supabase.from("rehearsals").select("id, date, title").eq("team_id", team!.id).gte("date", since).order("date"),
        supabase.from("due_payments").select("id, title, amount").eq("team_id", team!.id),
        supabase.from("payment_records").select("payment_id, amount_paid, is_paid, verified_at"),
      ]);

      const rehearsalIds = (rehRes.data ?? []).map((r: any) => r.id);
      const attRes = rehearsalIds.length > 0
        ? await supabase.from("attendance").select("rehearsal_id, status, member_id").in("rehearsal_id", rehearsalIds)
        : { data: [] as any[] };

      return {
        members: membersRes.data ?? [],
        rehearsals: rehRes.data ?? [],
        attendance: attRes.data ?? [],
        payments: payRes.data ?? [],
        records: recsRes.data ?? [],
      };
    },
  });

  if (!data) {
    return (
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-3xl font-extrabold flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" /> Summary</h1>
        <Card className="p-12 glass text-center text-muted-foreground">Loading insights…</Card>
      </div>
    );
  }

  const activeMembers = data.members.filter((m: any) => m.is_active).length;
  const inactiveMembers = data.members.length - activeMembers;

  // Attendance trend (last 12 rehearsals)
  const trend = data.rehearsals.slice(-12).map((r: any) => {
    const recs = data.attendance.filter((a: any) => a.rehearsal_id === r.id);
    const present = recs.filter((a: any) => a.status === "present" || a.status === "late").length;
    const total = recs.length;
    return {
      name: format(new Date(r.date), "MMM dd"),
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      present,
      total,
    };
  });

  // Status pie (overall last 90 days)
  const statusBreakdown = ["present", "late", "absent", "excused"].map((s) => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: data.attendance.filter((a: any) => a.status === s).length,
  }));
  const PIE_COLORS = ["hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

  // Payment completion
  const paymentRows = data.payments.map((p: any) => {
    const recs = data.records.filter((r: any) => r.payment_id === p.id && r.verified_at);
    const collected = recs.reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);
    const expected = Number(p.amount) * activeMembers;
    return {
      name: p.title.length > 14 ? p.title.slice(0, 14) + "…" : p.title,
      Collected: collected,
      Expected: expected,
    };
  });
  const totalCollected = paymentRows.reduce((s, r) => s + r.Collected, 0);
  const totalExpected = paymentRows.reduce((s, r) => s + r.Expected, 0);
  const overallPaymentRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const overallAttRate = data.attendance.length > 0
    ? Math.round((data.attendance.filter((a: any) => a.status === "present" || a.status === "late").length / data.attendance.length) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">Summary</h1>
          <p className="text-muted-foreground">Insights from the last 90 days</p>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Users} label="Active members" value={activeMembers} hint={`${inactiveMembers} inactive`} />
        <KPI icon={ClipboardCheck} label="Attendance rate" value={`${overallAttRate}%`} hint={`${data.attendance.length} marks`} />
        <KPI icon={CreditCard} label="Collection rate" value={`${overallPaymentRate}%`} hint={`${NGN(totalCollected)} of ${NGN(totalExpected)}`} accent />
        <KPI icon={TrendingUp} label="Rehearsals" value={data.rehearsals.length} hint="last 90 days" />
      </div>

      {/* Attendance trend */}
      <Card className="p-5 glass">
        <h2 className="font-bold mb-3">Attendance trend</h2>
        {trend.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rehearsals tracked yet.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Status breakdown */}
        <Card className="p-5 glass">
          <h2 className="font-bold mb-3">Status breakdown</h2>
          {data.attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" outerRadius={80} label>
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Payment completion */}
        <Card className="p-5 glass">
          <h2 className="font-bold mb-3">Payment completion</h2>
          {paymentRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments tracked yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Expected" fill="hsl(var(--muted-foreground))" radius={[4,4,0,0]} />
                  <Bar dataKey="Collected" fill="hsl(var(--secondary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint, accent }: any) {
  return (
    <Card className={`p-4 glass ${accent ? "border-l-4 border-l-secondary" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`text-2xl font-extrabold mt-1 ${accent ? "text-gradient-gold" : ""}`}>{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}
