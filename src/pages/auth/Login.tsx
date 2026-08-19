import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  email: z.string().trim().email("Invalid email").max(255),
  code: z.string().trim().length(8, "Choir code is 8 characters").toUpperCase(),
  password: z.string().min(6, "Password too short").max(72),
});

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, code, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      // Verify the choir code matches a real team
      const { data: team } = await supabase
        .from("teams").select("id").eq("access_code", parsed.data.code).maybeSingle();
      if (!team) { toast.error("Choir code not recognised"); setLoading(false); return; }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;

      // Verify the signed-in user belongs to this team
      const { data: prof } = await supabase
        .from("profiles").select("team_id, role").eq("id", data.user!.id).maybeSingle();
      if (!prof || prof.team_id !== team.id) {
        await supabase.auth.signOut();
        toast.error("This account doesn't belong to that choir");
        setLoading(false);
        return;
      }

      toast.success("Welcome back!");
      nav("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 glass shadow-elegant">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-xl">RECHOIR</span>
        </Link>
        <h1 className="text-2xl font-bold text-center mb-1">Welcome back</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Sign in to your choir</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="code">Choir access code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123XY" maxLength={8} className="font-mono tracking-widest" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/reset-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-primary text-primary-foreground shadow-glow h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <div className="text-sm text-center mt-6 space-y-1">
          <div>
            <span className="text-muted-foreground">Starting a new choir? </span>
            <Link to="/register-team" className="text-primary font-medium hover:underline">Create one</Link>
          </div>
          <div>
            <span className="text-muted-foreground">Got an invite link? </span>
            <span className="text-muted-foreground">Open it to join.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
