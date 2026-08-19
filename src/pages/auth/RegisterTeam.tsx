import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/PasswordInput";
import { Crown, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { generateAccessCode } from "@/lib/utils-rechoir";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  choirName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Min 8 characters").max(72)
    .regex(/[A-Z]/, "Need an uppercase letter")
    .regex(/[0-9]/, "Need a number"),
});

export default function RegisterTeam() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [choirName, setChoirName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, choirName, email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: parsed.data.fullName,
            role: "team_lead",
          },
        },
      });
      if (authErr) throw authErr;
      const userId = auth.user?.id;
      if (!userId) throw new Error("No user created");

      // Try to make a unique team code (retry up to a few times)
      let access_code = "";
      let teamCreated: any = null;
      for (let i = 0; i < 5; i++) {
        access_code = generateAccessCode(8);
        const { data: t, error: tErr } = await supabase.from("teams")
          .insert({ name: parsed.data.choirName, access_code, team_lead_id: userId })
          .select().single();
        if (!tErr) { teamCreated = t; break; }
        if (!tErr || (tErr as any).code !== "23505") throw tErr;
      }
      if (!teamCreated) throw new Error("Could not create team");

      await supabase.from("profiles").update({ team_id: teamCreated.id, role: "team_lead" }).eq("id", userId);

      setCode(access_code);
      toast.success("Choir created!");
    } catch (err: any) {
      toast.error(err.message || "Could not create choir");
    } finally {
      setLoading(false);
    }
  };

  if (code) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 glass shadow-elegant text-center">
          <div className="h-14 w-14 mx-auto rounded-2xl gradient-gold flex items-center justify-center shadow-gold mb-4">
            <Crown className="h-7 w-7 text-secondary-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your choir is live!</h1>
          <p className="text-muted-foreground mb-6">Share this access code with your members. They'll need it to sign in alongside their email.</p>
          <div className="rounded-xl border-2 border-dashed border-secondary/50 bg-card p-6 mb-6">
            <div className="text-xs text-muted-foreground mb-1">Choir Access Code</div>
            <div className="text-4xl font-extrabold text-gradient-gold tracking-[0.3em] font-mono">{code}</div>
          </div>
          <Button variant="outline" className="mb-3" onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}>
            <Copy className="h-4 w-4 mr-2" /> Copy code
          </Button>
          <Button onClick={() => nav("/dashboard")} className="w-full gradient-primary text-primary-foreground shadow-glow">
            Go to dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 glass shadow-elegant">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-xl">RECHOIR</span>
        </Link>
        <h1 className="text-2xl font-bold text-center mb-1">Start your choir</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">You'll become the team lead</p>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Your full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Choir name</Label><Input value={choirName} onChange={(e) => setChoirName(e.target.value)} placeholder="St. Mary's Choir" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" /></div>
          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground shadow-glow h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create choir"}
          </Button>
        </form>
        <div className="text-sm text-center mt-6">
          <span className="text-muted-foreground">Already have an account? </span>
          <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
