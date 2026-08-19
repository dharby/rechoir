import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/PasswordInput";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72).regex(/[A-Z]/, "Need uppercase").regex(/[0-9]/, "Need number"),
  specialization: z.string().max(50).optional(),
});

export default function AcceptInvite() {
  const { token } = useParams();
  const nav = useNavigate();
  const [team, setTeam] = useState<{ id: string; name: string; access_code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("");

  useEffect(() => {
    (async () => {
      const { data: invite } = await supabase
        .from("invites").select("team_id, used, expires_at, email").eq("token", token!).maybeSingle();
      if (!invite) { toast.error("Invalid invite"); setLoading(false); return; }
      if (invite.used) { toast.error("Invite already used"); setLoading(false); return; }
      if (new Date(invite.expires_at) < new Date()) { toast.error("Invite expired"); setLoading(false); return; }
      if (invite.email) setEmail(invite.email);
      const { data: t } = await supabase.from("teams").select("id, name, access_code").eq("id", invite.team_id).maybeSingle();
      setTeam(t);
      setLoading(false);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, email, password, specialization });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!team) return;
    setSubmitting(true);
    try {
      const { data: auth, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: parsed.data.fullName,
            role: "member",
            team_id: team.id,
            specialization: parsed.data.specialization || null,
          },
        },
      });
      if (error) throw error;
      // Make sure team_id sticks (in case trigger ran before metadata)
      if (auth.user) {
        await supabase.from("profiles").update({ team_id: team.id, role: "member", specialization: specialization || null }).eq("id", auth.user.id);
      }
      await supabase.from("invites").update({ used: true }).eq("token", token!);
      toast.success("Welcome to the choir!");
      nav("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Could not accept invite");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  if (!team) return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="p-8 glass max-w-md text-center">
        <h1 className="text-xl font-bold mb-2">Invite not valid</h1>
        <p className="text-muted-foreground mb-4">Ask your team lead for a fresh invite link.</p>
        <Link to="/"><Button variant="outline">Go home</Button></Link>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 glass shadow-elegant">
        <Link to="/" className="flex items-center gap-2 justify-center mb-4">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-xl">RECHOIR</span>
        </Link>
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-wider text-secondary mb-1">You're invited to join</div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          <div className="text-xs text-muted-foreground mt-1">Choir code: <span className="font-mono tracking-wider">{team.access_code}</span></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Your full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Specialization (optional)</Label><Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Soprano, Tenor, Drums..." /></div>
          <div><Label>Set password</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" disabled={submitting} className="w-full gradient-primary text-primary-foreground shadow-glow h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join choir"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
