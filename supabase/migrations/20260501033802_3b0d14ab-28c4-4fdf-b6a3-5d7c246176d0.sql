
-- Helper trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Prayer requests
CREATE TABLE public.prayer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  lead_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own prayer requests"
  ON public.prayer_requests FOR SELECT
  USING (member_id = auth.uid());

CREATE POLICY "Team leads can view all team prayer requests"
  ON public.prayer_requests FOR SELECT
  USING (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Members can create their own prayer requests"
  ON public.prayer_requests FOR INSERT
  WITH CHECK (member_id = auth.uid() AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Members can update their own prayer requests"
  ON public.prayer_requests FOR UPDATE
  USING (member_id = auth.uid());

CREATE POLICY "Team leads can update team prayer requests"
  ON public.prayer_requests FOR UPDATE
  USING (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Members can delete their own prayer requests"
  ON public.prayer_requests FOR DELETE
  USING (member_id = auth.uid());

CREATE POLICY "Team leads can delete team prayer requests"
  ON public.prayer_requests FOR DELETE
  USING (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()));

CREATE TRIGGER prayer_requests_updated_at
  BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own subscriptions"
  ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert their own subscriptions"
  ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update their own subscriptions"
  ON public.push_subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete their own subscriptions"
  ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add remark to service_attendance
ALTER TABLE public.service_attendance
  ADD COLUMN IF NOT EXISTS remark TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_team ON public.push_subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_team ON public.prayer_requests(team_id);
