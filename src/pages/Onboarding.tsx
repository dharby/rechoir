import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// /onboarding catches an authenticated user with no team_id (shouldn't normally happen
// since both registration paths assign a team, but safe fallback).
export default function Onboarding() {
  const { profile, session, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) nav("/login");
    else if (profile?.team_id) nav("/dashboard");
  }, [profile, session, loading, nav]);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4 text-center">
      <div>
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Setting things up</h1>
        <p className="text-muted-foreground">Hang tight while we connect you to your choir...</p>
      </div>
    </div>
  );
}
