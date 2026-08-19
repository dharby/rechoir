
-- ============ TEAMS: payment account details ============
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS bank_name text;

-- ============ PRAYER CHAINS: recurrence + time window ============
DO $$ BEGIN
  CREATE TYPE public.prayer_recurrence AS ENUM (
    'none','daily','weekly_mon','weekly_tue','weekly_wed','weekly_thu','weekly_fri','weekly_sat','weekly_sun'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.prayer_chains
  ADD COLUMN IF NOT EXISTS recurrence public.prayer_recurrence NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- ============ PRAYER LEADER SCHEDULE ============
CREATE TABLE IF NOT EXISTS public.prayer_leader_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  member_id uuid NOT NULL,
  week_start_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, week_start_date)
);
ALTER TABLE public.prayer_leader_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team scope select" ON public.prayer_leader_schedule;
CREATE POLICY "team scope select" ON public.prayer_leader_schedule
  FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));

DROP POLICY IF EXISTS "team lead manages" ON public.prayer_leader_schedule;
CREATE POLICY "team lead manages" ON public.prayer_leader_schedule
  FOR ALL USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

-- ============ DUE PAYMENTS: recurrence ============
DO $$ BEGIN
  CREATE TYPE public.payment_recurrence AS ENUM ('one_time','daily','weekly','monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.due_payments
  ADD COLUMN IF NOT EXISTS recurrence public.payment_recurrence NOT NULL DEFAULT 'one_time';

-- ============ PAYMENT RECORDS: partial payments + verification ============
ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- Allow team lead to verify any record in their team
DROP POLICY IF EXISTS "team lead verifies records" ON public.payment_records;
CREATE POLICY "team lead verifies records" ON public.payment_records
  FOR UPDATE USING (
    public.is_team_lead(auth.uid())
    AND EXISTS (SELECT 1 FROM public.due_payments p WHERE p.id = payment_records.payment_id AND p.team_id = public.get_user_team_id(auth.uid()))
  );

-- ============ SERVICE ATTENDANCE ============
DO $$ BEGIN
  CREATE TYPE public.service_event_kind AS ENUM ('rehearsal','service','event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.punctuality_status AS ENUM ('on_time','late','very_late','absent','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.service_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  title text NOT NULL,
  kind public.service_event_kind NOT NULL DEFAULT 'service',
  date date NOT NULL,
  start_time time,
  end_time time,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team scope select" ON public.service_events;
CREATE POLICY "team scope select" ON public.service_events FOR SELECT USING (team_id = public.get_user_team_id(auth.uid()));
DROP POLICY IF EXISTS "team lead manages" ON public.service_events;
CREATE POLICY "team lead manages" ON public.service_events
  FOR ALL USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE TABLE IF NOT EXISTS public.service_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  member_id uuid NOT NULL,
  status public.punctuality_status NOT NULL DEFAULT 'absent',
  arrival_time timestamptz,
  notes text,
  marked_by uuid,
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);
ALTER TABLE public.service_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "view team service attendance" ON public.service_attendance;
CREATE POLICY "view team service attendance" ON public.service_attendance FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.service_events e WHERE e.id = service_attendance.event_id AND e.team_id = public.get_user_team_id(auth.uid())));
DROP POLICY IF EXISTS "team lead manages service attendance" ON public.service_attendance;
CREATE POLICY "team lead manages service attendance" ON public.service_attendance
  FOR ALL USING (public.is_team_lead(auth.uid()))
  WITH CHECK (public.is_team_lead(auth.uid()));

-- ============ CHAT EXTENSIONS ============
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mentions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Allow any team member to update messages (pin/unpin/soft-delete)
DROP POLICY IF EXISTS "team members update messages" ON public.chat_messages;
CREATE POLICY "team members update messages" ON public.chat_messages
  FOR UPDATE USING (team_id = public.get_user_team_id(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()));

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team scope select" ON public.chat_message_reactions;
CREATE POLICY "team scope select" ON public.chat_message_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = chat_message_reactions.message_id AND m.team_id = public.get_user_team_id(auth.uid())));
DROP POLICY IF EXISTS "user manages own reactions" ON public.chat_message_reactions;
CREATE POLICY "user manages own reactions" ON public.chat_message_reactions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.chat_message_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
ALTER TABLE public.chat_message_stars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user manages own stars" ON public.chat_message_stars;
CREATE POLICY "user manages own stars" ON public.chat_message_stars
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_message_reactions REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_messages';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_message_reactions';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
