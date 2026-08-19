-- 1) Extend attendance_status enum to include 'late'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'late' AND enumtypid = 'attendance_status'::regtype) THEN
    ALTER TYPE public.attendance_status ADD VALUE 'late';
  END IF;
END$$;

-- 2) Add remark to attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS remark text;

-- 3) Prayer chain custom days (array of 0..6, Sun..Sat) and per-day fields
ALTER TABLE public.prayer_chains
  ADD COLUMN IF NOT EXISTS days_of_week int[] NOT NULL DEFAULT '{}'::int[];

-- 4) Prayer leader schedule: support specific day + time
ALTER TABLE public.prayer_leader_schedule
  ADD COLUMN IF NOT EXISTS day_of_week int,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- 5) Notifications: category + link
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS link text;
