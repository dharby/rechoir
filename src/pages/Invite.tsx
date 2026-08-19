import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Link2, Mail, Loader2, Crown, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function genToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function Invite() {
  const { team } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: invites } = useQuery({
    queryKey: ["invites", team?.id],
    enabled: !!team?.id,
    queryFn: async () => {
      const { data } = await supabase.from("invites").select("*").eq("team_id", team!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = async () => {
    if (!team) return;
    setCreating(true);
    const token = genToken();
    const { error } = await supabase.from("invites").insert({
      team_id: team.id, token, email: email || null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setEmail("");
    qc.invalidateQueries({ queryKey: ["invites"] });
    toast.success("Invite link created!");
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate this invite link? Anyone with the link will no longer be able to use it.")) return;
    const { error } = await supabase.from("invites").update({ used: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invites"] });
    toast.success("Invite deactivated");
  };

  const removeInvite = async (id: string) => {
    if (!confirm("Permanently delete this invite?")) return;
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invites"] });
    toast.success("Invite deleted");
  };

  const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold">Invite members</h1>
        <p className="text-muted-foreground">Generate one-time invite links or share your choir code directly.</p>
      </div>

      {team && (
        <Card className="p-6 glass">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl gradient-gold flex items-center justify-center shadow-gold">
              <Crown className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Choir Access Code</div>
              <div className="text-2xl font-extrabold font-mono tracking-widest text-gradient-gold">{team.access_code}</div>
            </div>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(team.access_code); toast.success("Copied!"); }}>
              <Copy className="h-4 w-4 mr-2" />Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Members sign in at <code className="text-foreground">/login</code> with their email + this code.
          </p>
        </Card>
      )}

      <Card className="p-6 glass">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Link2 className="h-4 w-4" /> Create invite link</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label className="text-xs">Member email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@email.com" />
          </div>
          <div className="flex items-end">
            <Button onClick={create} disabled={creating} className="gradient-primary text-primary-foreground shadow-glow">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate link"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 glass">
        <h2 className="font-bold mb-4 flex items-center gap-2"><Mail className="h-4 w-4" /> Active invites</h2>
        <div className="space-y-2">
          {invites?.length === 0 && <p className="text-sm text-muted-foreground">No invites yet.</p>}
          {invites?.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{inv.email || "Open invite"}</div>
                <div className="text-xs text-muted-foreground truncate">{linkFor(inv.token)}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${inv.used ? "bg-muted text-muted-foreground" : "bg-accent/20 text-accent"}`}>
                {inv.used ? "Inactive" : "Active"}
              </span>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(linkFor(inv.token)); toast.success("Link copied!"); }} title="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
              {!inv.used && (
                <Button size="icon" variant="ghost" onClick={() => deactivate(inv.id)} title="Deactivate">
                  <Power className="h-4 w-4 text-warning" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => removeInvite(inv.id)} title="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
