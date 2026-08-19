-- Notifications: priority + dismissed + delete policy
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

DROP POLICY IF EXISTS "users delete own notifications" ON public.notifications;
CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- Chat read state per user
CREATE TABLE IF NOT EXISTS public.chat_read_state (
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, team_id)
);

ALTER TABLE public.chat_read_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own chat read state" ON public.chat_read_state;
CREATE POLICY "users manage own chat read state"
  ON public.chat_read_state FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());