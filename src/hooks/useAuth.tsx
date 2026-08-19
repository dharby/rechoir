import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  specialization: string | null;
  role: "team_lead" | "member";
  team_id: string | null;
  is_active: boolean;
  avatar_url?: string | null;
  is_admin?: boolean | null;
  admin_pages?: string[] | null;
  read_receipts?: boolean | null;
  suspended_until?: string | null;

};

export type Team = {
  id: string;
  name: string;
  access_code: string;
  team_lead_id: string;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  team: Team | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile((prof as Profile) ?? null);
    if (prof?.team_id) {
      const { data: t } = await supabase.from("teams").select("*").eq("id", prof.team_id).maybeSingle();
      setTeam((t as Team) ?? null);
    } else {
      setTeam(null);
    }
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setTeam(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Realtime: keep profile fresh so admin_pages / role changes propagate immediately
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    const ch = supabase
      .channel(`profile:${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        () => loadProfile(uid),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.user?.id]);


  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setTeam(null);
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, profile, team, loading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
