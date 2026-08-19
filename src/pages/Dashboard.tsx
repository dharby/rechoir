import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Music2, CalendarDays, HeartHandshake, CreditCard, Crown, Copy,
  Shirt, ListChecks, MessageSquare, ClipboardCheck, BarChart3, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { format, startOfWeek, addDays, parseISO } from "date-fns";

function StatCard({ icon: Icon, label, value, accent = "primary" }: any) {
  return (
    <Card className="p-5 glass transition-smooth hover:shadow-elegant hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-3xl font-extrabold mt-2">{value ?? "—"}</div>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent === "gold" ? "gradient-gold shadow-gold" : "gradient-primary shadow-glow"}`}>
          <Icon className={`h-5 w-5 ${accent === "gold" ? "text-secondary-foreground" : "text-primary-foreground"}`} />
        </div>
      </div>
    </Card>
  );
}

const QUICK = [
  { to: "/songs",          label: "Songs / Repertoire",  icon: Music2,         tone: "primary" as const },
  { to: "/rehearsals",     label: "Upcoming Events",     icon: CalendarDays,   tone: "primary" as const },
  { to: "/prayer-chains",  label: "Active Prayer Chain", icon: HeartHandshake, tone: "gold"    as const },
  { to: "/payments",       label: "Payments / Dues",     icon: CreditCard,     tone: "gold"    as const },
  { to: "/uniforms",       label: "Uniform / Resources", icon: Shirt,          tone: "primary" as const },
  { to: "/checklists",     label: "Weekly Checklist",    icon: ListChecks,     tone: "primary" as const },
  { to: "/sign-in",        label: "Sign-in Attendance",  icon: ClipboardCheck, tone: "gold"    as const },
  { to: "/chat",           label: "Choir Chat",          icon: MessageSquare,  tone: "primary" as const },
  { to: "/summary",        label: "Summary & Insights",  icon: BarChart3,      tone: "gold"    as const },
];

function attendanceRemark(rate: number, total: number): { text: string; tone: string } {
  if (total === 0) return { text: "No attendance records yet — every event is a fresh start!", tone: "text-muted-foreground" };
  if (rate >= 90) return { text: "Outstanding! You're setting the standard. Keep it up 🎉", tone: "text-accent" };
  if (rate >= 75) return { text: "Great consistency. A little more and you're at the top!", tone: "text-primary" };
  if (rate >= 50) return { text: "You're showing up — let's push for more consistency this month 💪", tone: "text-warning" };
  return { text: "We miss you at sign-ins. Small steps this week will lift you back up 🙏", tone: "text-destructive" };
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
    <div className="space-y-6 max-w-7xl">
      {/* 3D animated hero */}
      <div className="relative perspective-1000 overflow-hidden rounded-2xl border border-border gradient-primary shadow-elegant">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-secondary/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-12 w-72 h-72 rounded-full bg-primary-glow/40 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute inset-0 opacity-30 mix-blend-overlay [background:radial-gradient(circle_at_20%_20%,#fff3,transparent_40%),radial-gradient(circle_at_80%_60%,#fff2,transparent_45%)]" />
        <div className="relative tilt-card p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4 text-primary-foreground">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] opacity-80">Welcome back, {profile?.full_name?.split(" ")[0] || "friend"}</div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-2 drop-shadow-md">{team?.name}</h1>
            <p className="opacity-80 mt-1 text-sm md:text-base">Make today's rehearsal sing. ✨</p>
          </div>
          {isLead && team && (
            <Card className="p-4 glass flex items-center gap-3 self-start md:self-auto animate-tilt">
              <div className="h-10 w-10 rounded-lg gradient-gold flex items-center justify-center shadow-gold">
                <Crown className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Choir Code</div>
                <div className="font-mono font-bold tracking-widest text-lg text-gradient-gold">{team.access_code}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(team.access_code); toast.success("Copied!"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Members" value={stats?.members} />
        <StatCard icon={Music2} label="Songs" value={stats?.songs} accent="gold" />
        <StatCard icon={CalendarDays} label="Upcoming Events" value={stats?.upcomingEvents} />
        <StatCard icon={HeartHandshake} label="Active Prayers" value={stats?.activePrayers} accent="gold" />
        <StatCard icon={CreditCard} label="Payment Drives" value={stats?.payments} />
      </div>

      {/* Personal sign-in attendance card */}
      <Card className="p-5 glass">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Your sign-in attendance</div>
            <div className="text-2xl font-extrabold mt-1">
              {myStats.total > 0 ? `${myStats.rate.toFixed(0)}%` : "—"}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {myStats.present}/{myStats.total} events attended
              </span>
            </div>
          </div>
          <div className="h-2 flex-1 min-w-[160px] bg-muted rounded-full overflow-hidden max-w-xs">
            <div className="h-full gradient-primary transition-all" style={{ width: `${myStats.rate}%` }} />
          </div>
        </div>
        <p className={`mt-3 text-sm font-medium ${remark.tone}`}>{remark.text}</p>
      </Card>

      {/* Prayer leader for the week */}
      <Card className="p-5 glass border-l-4 border-l-secondary">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-secondary" />
            <h3 className="font-bold">Prayer leader for the week</h3>
          </div>
          <Link to="/prayer-chains" className="text-xs text-secondary hover:underline">View calendar →</Link>
        </div>
        {todayLeader && (
          <div className="text-sm mb-2">
            <span className="text-muted-foreground">Today: </span>
            <span className="font-semibold">{todayLeader.member?.full_name || todayLeader.member?.email || "—"}</span>
            {todayLeader.focus && <span className="ml-2 text-secondary">• 🎯 {todayLeader.focus}</span>}
          </div>
        )}
        {(weekLeaders ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No prayer leaders assigned this week yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weekLeaders!.map((l: any) => {
              const label = l.scheduled_date
                ? format(parseISO(l.scheduled_date), "EEE MMM dd")
                : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][l.day_of_week ?? 0];
              return (
                <span key={l.id} className="text-xs px-2.5 py-1 rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                  {label} • {l.member?.full_name || l.member?.email || "—"}
                  {l.focus ? ` • 🎯 ${l.focus}` : ""}
                </span>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick access */}
      <div>
        <h2 className="text-lg font-bold mb-3">Quick access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="group">
              <Card className="p-4 glass transition-smooth hover:shadow-elegant hover:-translate-y-0.5 h-full flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${q.tone === "gold" ? "gradient-gold shadow-gold" : "gradient-primary shadow-glow"}`}>
                  <q.icon className={`h-5 w-5 ${q.tone === "gold" ? "text-secondary-foreground" : "text-primary-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{q.label}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-smooth" />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
