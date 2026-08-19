ALTER TABLE public.prayer_leader_schedule
  ADD COLUMN IF NOT EXISTS focus text,
  ADD COLUMN IF NOT EXISTS scheduled_date date;

CREATE INDEX IF NOT EXISTS idx_prayer_leader_schedule_team_date
  ON public.prayer_leader_schedule (team_id, scheduled_date);