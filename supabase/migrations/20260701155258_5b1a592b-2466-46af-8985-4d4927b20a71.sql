
-- Member lifecycle: trash, suspension, admin roles, probation

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_pages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS probation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS probation_targets jsonb;

-- Helper: does user have admin access to a page?
CREATE OR REPLACE FUNCTION public.has_admin_page(_user_id uuid, _page text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (role = 'team_lead' OR (is_admin AND _page = ANY(admin_pages)))
  );
$$;

-- Probation scores
CREATE TABLE IF NOT EXISTS public.probation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  target_key text NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  note text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.probation_scores TO authenticated;
GRANT ALL ON public.probation_scores TO service_role;

ALTER TABLE public.probation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own probation scores"
ON public.probation_scores FOR SELECT TO authenticated
USING (member_id = auth.uid() OR public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Leads manage probation scores"
ON public.probation_scores FOR ALL TO authenticated
USING (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()))
WITH CHECK (public.is_team_lead(auth.uid()) AND team_id = public.get_user_team_id(auth.uid()));

CREATE TRIGGER update_probation_scores_updated_at
BEFORE UPDATE ON public.probation_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Event priorities
ALTER TABLE public.rehearsals         ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;
ALTER TABLE public.service_events     ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;
ALTER TABLE public.weekly_checklists  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;
ALTER TABLE public.prayer_chains      ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;
ALTER TABLE public.broadcasts         ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;

-- DM parity: pin + highlight
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight_color text;
