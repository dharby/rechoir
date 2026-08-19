
-- Enums
CREATE TYPE public.app_role AS ENUM ('team_lead', 'member');
CREATE TYPE public.prayer_type AS ENUM ('continuous', 'scheduled');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'excused');
CREATE TYPE public.song_status AS ENUM ('not_started', 'learning', 'ready', 'perfect');
CREATE TYPE public.uniform_status AS ENUM ('ready', 'pending', 'not_ready', 'na');

-- Teams (choirs)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  team_lead_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  specialization TEXT,
  role public.app_role NOT NULL DEFAULT 'member',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invites
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days')
);

-- Prayer chains
CREATE TABLE public.prayer_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type public.prayer_type NOT NULL DEFAULT 'scheduled',
  start_date DATE NOT NULL,
  end_date DATE,
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.prayer_chain_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL REFERENCES public.prayer_chains(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.due_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.due_payments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  proof_url TEXT,
  UNIQUE(payment_id, member_id)
);

-- Rehearsals
CREATE TABLE public.rehearsals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT,
  agenda TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id UUID NOT NULL REFERENCES public.rehearsals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'absent',
  arrival_time TIMESTAMPTZ,
  UNIQUE(rehearsal_id, member_id)
);

-- Checklists
CREATE TABLE public.weekly_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.weekly_checklists(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Uniforms
CREATE TABLE public.uniform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.uniform_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.uniform_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.uniform_status NOT NULL DEFAULT 'pending',
  UNIQUE(event_id, member_id)
);

-- Songs
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  song_key TEXT,
  youtube_url TEXT,
  practice_notes TEXT,
  target_readiness_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.song_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.song_status NOT NULL DEFAULT 'not_started',
  note TEXT,
  UNIQUE(song_id, member_id)
);

-- Chat
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Broadcasts
CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT team_id FROM public.profiles WHERE id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'team_lead') $$;

-- Auto-create profile on signup using metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, specialization, role, team_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'specialization',
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'member'),
    NULLIF(NEW.raw_user_meta_data->>'team_id','')::UUID
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_chain_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- TEAMS
CREATE POLICY "team members can view their team" ON public.teams FOR SELECT
  USING (id = public.get_user_team_id(auth.uid()));
CREATE POLICY "anyone can lookup team by code for joining" ON public.teams FOR SELECT
  USING (true);
CREATE POLICY "authenticated users can create teams" ON public.teams FOR INSERT
  WITH CHECK (auth.uid() = team_lead_id);
CREATE POLICY "team lead updates team" ON public.teams FOR UPDATE
  USING (auth.uid() = team_lead_id);

-- PROFILES
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "users view team members" ON public.profiles FOR SELECT
  USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "team lead updates team profiles" ON public.profiles FOR UPDATE
  USING (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()));

-- INVITES
CREATE POLICY "team lead manages invites" ON public.invites FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));
CREATE POLICY "anyone can read invite by token" ON public.invites FOR SELECT USING (true);

-- Generic team-scoped policies
CREATE POLICY "team scope select" ON public.prayer_chains FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead manages" ON public.prayer_chains FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE POLICY "team members view assignments" ON public.prayer_chain_assignments FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.prayer_chains pc WHERE pc.id = chain_id AND pc.team_id = public.get_user_team_id(auth.uid())));
CREATE POLICY "team lead manage assignments" ON public.prayer_chain_assignments FOR ALL
  USING (public.is_team_lead(auth.uid()) AND EXISTS(SELECT 1 FROM public.prayer_chains pc WHERE pc.id = chain_id AND pc.team_id = public.get_user_team_id(auth.uid())))
  WITH CHECK (public.is_team_lead(auth.uid()));
CREATE POLICY "members update own assignment" ON public.prayer_chain_assignments FOR UPDATE
  USING (member_id = auth.uid());

CREATE POLICY "team scope select" ON public.due_payments FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead manages" ON public.due_payments FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE POLICY "view team payment records" ON public.payment_records FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.due_payments p WHERE p.id = payment_id AND p.team_id = public.get_user_team_id(auth.uid())));
CREATE POLICY "members update own record" ON public.payment_records FOR UPDATE USING (member_id = auth.uid());
CREATE POLICY "members insert own record" ON public.payment_records FOR INSERT WITH CHECK (member_id = auth.uid());
CREATE POLICY "team lead manages records" ON public.payment_records FOR ALL
  USING (public.is_team_lead(auth.uid()))
  WITH CHECK (public.is_team_lead(auth.uid()));

CREATE POLICY "team scope select" ON public.rehearsals FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead manages" ON public.rehearsals FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE POLICY "view team attendance" ON public.attendance FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.rehearsals r WHERE r.id = rehearsal_id AND r.team_id = public.get_user_team_id(auth.uid())));
CREATE POLICY "team lead manages attendance" ON public.attendance FOR ALL
  USING (public.is_team_lead(auth.uid()))
  WITH CHECK (public.is_team_lead(auth.uid()));

CREATE POLICY "team scope select" ON public.weekly_checklists FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead manages" ON public.weekly_checklists FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE POLICY "view team checklist items" ON public.checklist_items FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.weekly_checklists c WHERE c.id = checklist_id AND c.team_id = public.get_user_team_id(auth.uid())));
CREATE POLICY "members update own items" ON public.checklist_items FOR UPDATE USING (member_id = auth.uid());
CREATE POLICY "team lead manages items" ON public.checklist_items FOR ALL
  USING (public.is_team_lead(auth.uid()))
  WITH CHECK (public.is_team_lead(auth.uid()));

CREATE POLICY "team scope select" ON public.uniform_events FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead manages" ON public.uniform_events FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE POLICY "view team uniform readiness" ON public.uniform_readiness FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.uniform_events e WHERE e.id = event_id AND e.team_id = public.get_user_team_id(auth.uid())));
CREATE POLICY "members upsert own readiness" ON public.uniform_readiness FOR ALL
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
CREATE POLICY "team lead manages readiness" ON public.uniform_readiness FOR ALL
  USING (public.is_team_lead(auth.uid())) WITH CHECK (public.is_team_lead(auth.uid()));

CREATE POLICY "team scope select" ON public.songs FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead manages" ON public.songs FOR ALL
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE POLICY "view team song assignments" ON public.song_assignments FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.songs s WHERE s.id = song_id AND s.team_id = public.get_user_team_id(auth.uid())));
CREATE POLICY "members upsert own assignment" ON public.song_assignments FOR ALL
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
CREATE POLICY "team lead manages assignments" ON public.song_assignments FOR ALL
  USING (public.is_team_lead(auth.uid())) WITH CHECK (public.is_team_lead(auth.uid()));

CREATE POLICY "team scope select" ON public.chat_messages FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team members send" ON public.chat_messages FOR INSERT
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND sender_id = auth.uid());

CREATE POLICY "users view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "system can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "team scope select" ON public.broadcasts FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
CREATE POLICY "team lead sends" ON public.broadcasts FOR INSERT
  WITH CHECK (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()) AND sender_id = auth.uid());

-- Realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
