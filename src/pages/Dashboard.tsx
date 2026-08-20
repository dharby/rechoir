import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Music2, CalendarDays, HeartHandshake, CreditCard, Copy, Shirt, ListChecks, MessageSquare, BarChart3, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format, startOfWeek, addDays, parseISO } from "date-fns";

function StatCard({ icon: Icon, label, value, accent = "primary" }: any) {
  const accentBg = accent === "gold" ? "bg-secondary/20" : "bg-primary/10";
  const accentText = accent === "gold" ? "text-secondary" : "text-primary";
  const accentBorder = accent === "gold" ? "border-secondary/20" : "border-primary/20";
  return (
    <Card className="p-5 transition-colors hover:shadow-card-elevated hover:bg-accent/5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-3xl font-extrabold mt-2">{value ?? "—"}</div>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accentBg}`}>
          <Icon className={`h-5 w-5 ${accentText}`} />
        </div>
      </div>
    </Card>
  );
}

const QUICK = [
  { to: "/songs", label: "Songs / Repertoire", icon: Music2 },
  { to: "/rehearsals", label: "Upcoming Events", icon: CalendarDays },
  { to: "/prayer-chains", label: "Active Prayer Chain", icon: HeartHandshake },
  { to: "/payments", label: "Payments / Dues", icon: CreditCard },
  { to: "/uniforms", label: "Uniform / Resources", icon: Shirt },
  { to: "/checklists", label: "Weekly Checklist", icon: ListChecks },
  { to: "/sign-in", label: "Sign-in Attendance", icon: ClipboardCheck },
  { to: "/chat", label: "Choir Chat", icon: MessageSquare },
  { to: "/summary", label: "Summary & Insights", icon: BarChart3 },
];

function attendanceRemark(rate: number, total: number): { text: string; tone: string } {
  if (total === 0) return { text: "No attendance records yet — every event is a fresh start!", tone: "text-muted-foreground" };
  if (rate >= 90) return { text: "Outstanding! You're setting the standard. Keep it up 🎉", tone: "text-primary" };
  if (rate >= 75) return { text: "Great consistency. A little more and you're at the top!", tone: "text-primary" };
  if (rate >= 50) return { text: "You're showing up — let's push for more consistency this month 💪", tone: "text-warning" };
  return { text: "We miss you at sign-ins. Small steps this week will lift you back up 🙏", tone: "text-muted-foreground" };
}

export default function Dashboard() {
  const { profile, team } = useAuth();
  const teamId = profile?.team_id;
  const isLead = profile?.role === "team_lead";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", teamId],
    enabled: !!teamId,
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const ws = startOfWeek(new Date(), { weekStartsOn: 0 });
      const wsKey = format(ws, "yyyy-MM-dd");
      const weEnd = format(addDays(ws, 6), "yyyy-MM-dd");
      const [members, songs, upcoming, prayers, payments, leadByDate, leadByWeek] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("team_id", teamId!).eq("is_active", true),
        supabase.from("songs").select("id", { count: "exact", head: true }).eq("team_id", teamId!),
        supabase.from("service_events").select("id", { count: "exact", head: true }).eq("team_id", teamId!).gte("date", today),
        supabase.from("prayer_chains").select("id", { count: "exact", head: true }).eq("team_id", teamId!).eq("answered", false),
        supabase.from("due_payments").select("id", { count: "exact", head: true }).eq("team_id", teamId!),
        supabase.from("prayer_leader_schedule").select("id", { count: "exact", head: true }).eq("team_id", teamId!).gte("scheduled_date", wsKey).lte("scheduled_date", weEnd),
        supabase.from("prayer_leader_schedule").select("id", { count: "exact", head: true }).eq("team_id", teamId!).eq("week_start_date", wsKey),
      ]);
      return {
        members: members.count ?? 0,
        songs: songs.count ?? 0,
        upcomingEvents: upcoming.count ?? 0,
        activePrayers: (prayers.count ?? 0) + (leadByDate.count ?? 0) + (leadByWeek.count ?? 0),
        payments: payments.count ?? 0,
      };
    },
  });

  // Personal sign-in attendance (services + rehearsals + special events)
  const { data: myAtt } = useQuery({
    queryKey: ["my-signin-attendance", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("service_attendance").select("status").eq("member_id", profile!.id)).data ?? [],
  });
  const myStats = (() => {
    const total = myAtt?.length ?? 0;
    const present = myAtt?.filter((r: any) => r.status === "on_time" || r.status === "late" || r.status === "very_late").length ?? 0;
    const rate = total > 0 ? (present / total) * 100 : 0;
    return { total, present, rate };
  })();
  const remark = attendanceRemark(myStats.rate, myStats.total);

  // Prayer leader for the week
  const { data: weekLeaders } = useQuery({
    queryKey: ["dashboard-prayer-leaders", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const ws = startOfWeek(new Date(), { weekStartsOn: 0 });
      const wsKey = format(ws, "yyyy-MM-dd");
      const weEnd = format(addDays(ws, 6), "yyyy-MM-dd");
      const [byDateRes, byWeekRes, memsRes] = await Promise.all([
        supabase.from("prayer_leader_schedule").select("*").eq("team_id", teamId!).gte("scheduled_date", wsKey).lte("scheduled_date", weEnd),
        supabase.from("prayer_leader_schedule").select("*").eq("team_id", teamId!).eq("week_start_date", wsKey),
        supabase.from("profiles").select("id, full_name, email").eq("team_id", teamId!),
      ]);
      const seen = new Set<string>();
      const merged = [...(byDateRes.data ?? []), ...(byWeekRes.data ?? [])].filter((l: any) => {
        if (seen.has(l.id)) return false; seen.add(l.id); return true;
      });
      const memberMap = Object.fromEntries((memsRes.data ?? []).map((m: any) => [m.id, m]));
      return merged
        .sort((a: any, b: any) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""))
        .map((l: any) => ({ ...l, member: memberMap[l.member_id] }));
    },
  });
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayDow = new Date().getDay();
  const todayLeader = (weekLeaders ?? []).find((l: any) =>
    l.scheduled_date ? l.scheduled_date === todayKey : l.day_of_week === todayDow
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header section */}
      <div className="grid max-w-7xl mx-auto grid-cols-1 gap-6 md:grid-cols-2">
        {/* Welcome card */}
        <Card className="p-6 glass border-border/30 shadow-card-elevated">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-sidebar-foreground/60">Welcome back</div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-sidebar-foreground">{profile?.full_name?.split(" ")[0] || "friend"}</h1>
              <p className="mt-1 text-sm text-sidebar-foreground/60">Make today count.</p>
            </div>
            {isLead && team && (
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(team.access_code); toast.success("Copied!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        {/* Quick stats */}
        <Card className="p-6 glass border-border/30 shadow-card-elevated">
          <h2 className="text-sm uppercase tracking-wider text-sidebar-foreground/60 mb-4">Quick stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Members" value={stats?.members} />
            <StatCard icon={Music2} label="Songs" value={stats?.songs} />
            <StatCard icon={CalendarDays} label="Upcoming" value={stats?.upcomingEvents} />
            <StatCard icon={HeartHandshake} label="Prayers" value={stats?.activePrayers} />
          </div>
        </Card>
      </div>

      {/* Personal attendance */}
      <Card className="p-5 glass border-border/30 shadow-card-elevated mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-sidebar-foreground/60">Your sign-in attendance</div>
            <div className="text-2xl font-extrabold">{myStats.total > 0 ? `${myStats.rate.toFixed(0)}%` : "—"}</div>
            <span className="text-sm text-sidebar-foreground/60 ml-2">{myStats.present}/{myStats.total} events attended</span>
          </div>
          <div className="h-2 flex-1 min-w-[160px] bg-muted rounded-full overflow-hidden max-w-xs">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${myStats.rate}%` }} />
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-sidebar-foreground/70">{remark.text}</p>
      </Card>

      {/* Prayer leader */}
      <Card className="p-5 glass border-border/30 shadow-card-elevated">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-4 w-4 text-secondary" />
            <h3 className="font-bold">Prayer leader for the week</h3>
          </div>
          <Link to="/prayer-chains" className="text-xs text-secondary hover:underline">View calendar →</Link>
        </div>
        {todayLeader && (
          <div className="text-sm">
            <span className="text-sidebar-foreground/60">Today: </span>
            <span className="font-semibold text-sidebar-foreground">{todayLeader.member?.full_name || todayLeader.member?.email || "—"}</span>
            {todayLeader.focus && <span className="ml-2 text-secondary">• 🎯 {todayLeader.focus}</span>}
          </div>
        )}
        {(weekLeaders ?? []).length === 0 ? (
          <p className="text-sm text-sidebar-foreground/50 italic">No prayer leaders assigned this week yet.</p>
        ) : (
          <div className="text-xs text-sidebar-foreground/60">
            {(weekLeaders ?? []).map((l: any) => {
              const label = l.scheduled_date
                ? format(parseISO(l.scheduled_date), "MMM dd")
                : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][l.day_of_week ?? 0];
              return (
                <span key={l.id} className="mr-2 mb-1 inline-block rounded border border-secondary/20 text-secondary/70 px-1.5 py-0.5">{label} • {l.member?.full_name || l.member?.email || "—"}</span>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick access */}
      <Card className="p-5 glass border-border/30 shadow-card-elevated">
        <h2 className="text-sm uppercase tracking-wider text-sidebar-foreground/60 mb-3">Quick access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="group">
              <Card className="p-3.5 glass transition-colors hover:shadow-card-elevated h-full flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                  <q.icon className={`h-4 w-4 text-primary`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{q.label}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-sidebar-foreground/40 group-hover:text-primary transition-colors" />
              </Card>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}