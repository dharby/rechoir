import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { Shield, GraduationCap, ArrowRight, Users } from "lucide-react";
import { format } from "date-fns";

export default function TeamManagement() {
  const { team, profile: me } = useAuth();
  const isLead = me?.role === "team_lead";

  const { data: members = [] } = useQuery({
    queryKey: ["team-mgmt-members", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("profiles").select("*")
        .eq("team_id", team!.id).is("deleted_at", null).order("full_name")).data ?? [],
  });

  if (!isLead) {
    return <div className="text-center py-16 text-muted-foreground">Team leads only.</div>;
  }

  const admins = (members as any[]).filter((m) => m.is_admin && (m.admin_pages?.length ?? 0) > 0);
  const onProbation = (members as any[]).filter((m) => m.probation_started_at);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">Team management</h1>
          <p className="text-muted-foreground">Members with admin access & members on probation</p>
        </div>
      </div>

      <Card className="p-5 glass">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Admin access</div>
              <div className="text-xs text-muted-foreground">{admins.length} member{admins.length === 1 ? "" : "s"} with elevated access</div>
            </div>
          </div>
          <Button asChild size="sm" className="gradient-primary text-primary-foreground">
            <Link to="/admin-access">Manage <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        {admins.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3">No members have been given admin access yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {admins.map((m) => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <Avatar className="h-10 w-10">
                  <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>
                    {initials(m.full_name || m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link to={`/members/${m.id}`} className="font-semibold text-sm hover:underline block truncate">
                    {m.full_name || m.email}
                  </Link>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(m.admin_pages ?? []).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-[10px] capitalize">{p.replace("-", " ")}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 glass">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Probation</div>
              <div className="text-xs text-muted-foreground">{onProbation.length} member{onProbation.length === 1 ? "" : "s"} currently on probation</div>
            </div>
          </div>
          <Button asChild size="sm" className="gradient-primary text-primary-foreground">
            <Link to="/probation">Manage <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        {onProbation.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3">Nobody is on probation right now.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {onProbation.map((m) => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <Avatar className="h-10 w-10">
                  <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>
                    {initials(m.full_name || m.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link to={`/members/${m.id}`} className="font-semibold text-sm hover:underline block truncate">
                    {m.full_name || m.email}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">
                    Since {format(new Date(m.probation_started_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Badge className="bg-warning/20 text-warning border-warning/30" variant="outline">Probation</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
