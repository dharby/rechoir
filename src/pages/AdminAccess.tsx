import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, avatarGradient } from "@/lib/utils-rechoir";
import { ShieldCheck, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const PAGES: { key: string; label: string }[] = [
  { key: "chat", label: "Team chat" },
  { key: "broadcast", label: "Broadcasts" },
  { key: "attendance", label: "Attendance" },
  { key: "songs", label: "Songs" },
  { key: "rehearsals", label: "Rehearsals" },
  { key: "payments", label: "Payments" },
  { key: "checklists", label: "Checklists" },
  { key: "prayer-chains", label: "Prayer chains" },
  { key: "uniforms", label: "Uniforms" },
  { key: "members", label: "Members" },
];

export default function AdminAccess() {
  const { team, profile: me } = useAuth();
  const qc = useQueryClient();
  const isLead = me?.role === "team_lead";
  const [draft, setDraft] = useState<Record<string, { is_admin: boolean; admin_pages: string[] }>>({});

  const { data: members = [] } = useQuery({
    queryKey: ["admin-members", team?.id],
    enabled: !!team?.id,
    queryFn: async () =>
      (await supabase.from("profiles").select("*")
        .eq("team_id", team!.id).is("deleted_at", null).order("full_name")).data ?? [],
  });

  useEffect(() => {
    const d: any = {};
    (members as any[]).forEach((m) => {
      d[m.id] = { is_admin: !!m.is_admin, admin_pages: [...(m.admin_pages ?? [])] };
    });
    setDraft(d);
  }, [members]);

  if (!isLead) return <div className="text-center py-16 text-muted-foreground">Team leads only.</div>;

  const save = async (m: any) => {
    const d = draft[m.id];
    if (!d) return;
    const { error } = await supabase.from("profiles")
      .update({ is_admin: d.is_admin, admin_pages: d.is_admin ? d.admin_pages : [] } as any)
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-members"] });
    toast.success(`Access updated for ${m.full_name || m.email}`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">Admin access</h1>
          <p className="text-muted-foreground">Grant members admin control over specific pages</p>
        </div>
      </div>

      <div className="space-y-3">
        {(members as any[])
          .filter((m) => m.role !== "team_lead")
          .map((m) => {
            const d = draft[m.id] ?? { is_admin: false, admin_pages: [] };
            return (
              <Card key={m.id} className="p-5 glass">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback style={{ background: avatarGradient(m.id), color: "white" }}>
                      {initials(m.full_name || m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{m.full_name || m.email}</div>
                    <div className="text-xs text-muted-foreground">{m.specialization || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Admin</label>
                    <Switch checked={d.is_admin}
                      onCheckedChange={(v) => setDraft({ ...draft, [m.id]: { ...d, is_admin: v } })} />
                  </div>
                </div>
                {d.is_admin && (
                  <div className="grid sm:grid-cols-2 gap-2 border-t border-border pt-3">
                    {PAGES.map((p) => {
                      const on = d.admin_pages.includes(p.key);
                      return (
                        <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={on} onCheckedChange={(v) => {
                            const next = v
                              ? Array.from(new Set([...d.admin_pages, p.key]))
                              : d.admin_pages.filter((x) => x !== p.key);
                            setDraft({ ...draft, [m.id]: { ...d, admin_pages: next } });
                          }} />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 text-right">
                  <Button size="sm" onClick={() => save(m)} className="gradient-primary text-primary-foreground">
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </Card>
            );
          })}
        {members.length === 0 && (
          <Card className="glass p-8 text-center text-muted-foreground">No members yet.</Card>
        )}
      </div>
    </div>
  );
}
