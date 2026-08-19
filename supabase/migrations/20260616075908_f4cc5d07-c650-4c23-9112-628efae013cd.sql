
-- =========================================================
-- Attendance: late_after, verification, excused fields
-- =========================================================
ALTER TABLE public.rehearsals
  ADD COLUMN IF NOT EXISTS late_after timestamptz;

ALTER TABLE public.service_events
  ADD COLUMN IF NOT EXISTS late_after timestamptz;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self';

ALTER TABLE public.service_attendance
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self';

-- =========================================================
-- Strict one-sign-in: members can INSERT only when no row exists,
-- and cannot UPDATE/DELETE their own attendance. Unique constraint
-- already exists on (rehearsal_id, member_id) / (event_id, member_id).
-- Existing policies are already insert-only for members; this is
-- already enforced. Nothing to change there.
-- =========================================================

-- =========================================================
-- Songs: lead singer flag
-- =========================================================
ALTER TABLE public.song_assignments
  ADD COLUMN IF NOT EXISTS is_lead boolean NOT NULL DEFAULT false;

-- =========================================================
-- Checklists: multi-assignee + custom status options
-- =========================================================
ALTER TABLE public.weekly_checklists
  ADD COLUMN IF NOT EXISTS status_options jsonb NOT NULL DEFAULT '["Not started","In progress","Done"]'::jsonb;

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT true;

-- Per-assignee status table (multi-member tasks)
CREATE TABLE IF NOT EXISTS public.checklist_item_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_item_assignees TO authenticated;
GRANT ALL ON public.checklist_item_assignees TO service_role;

ALTER TABLE public.checklist_item_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view team item assignees"
  ON public.checklist_item_assignees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checklist_items ci
      JOIN public.weekly_checklists wc ON wc.id = ci.checklist_id
      WHERE ci.id = checklist_item_assignees.item_id
        AND wc.team_id = public.get_user_team_id(auth.uid())
    )
  );

CREATE POLICY "team lead manages item assignees"
  ON public.checklist_item_assignees FOR ALL
  USING (public.is_team_lead(auth.uid()))
  WITH CHECK (public.is_team_lead(auth.uid()));

CREATE POLICY "member updates own assignee row"
  ON public.checklist_item_assignees FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_checklist_item_assignees_updated_at
  BEFORE UPDATE ON public.checklist_item_assignees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
