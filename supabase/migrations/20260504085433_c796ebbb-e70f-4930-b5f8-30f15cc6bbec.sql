-- 1. Direct messages between members and team lead (and lead↔member). No member↔member.
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL,
  mentions text[] NOT NULL DEFAULT '{}',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dm_team_pair_created
  ON public.direct_messages (team_id, sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_created
  ON public.direct_messages (recipient_id, created_at DESC);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Helper: are these two users a valid DM pair? (one of them must be a team lead, both same team)
CREATE OR REPLACE FUNCTION public.dm_pair_allowed(_a uuid, _b uuid, _team uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pa
    JOIN public.profiles pb ON pb.id = _b
    WHERE pa.id = _a
      AND pa.team_id = _team
      AND pb.team_id = _team
      AND (pa.role = 'team_lead' OR pb.role = 'team_lead')
      AND _a <> _b
  );
$$;

-- View: only sender or recipient can see, and only within their team
CREATE POLICY "dm participants select" ON public.direct_messages
FOR SELECT USING (
  team_id = public.get_user_team_id(auth.uid())
  AND (sender_id = auth.uid() OR recipient_id = auth.uid())
);

-- Insert: must be sender, same team, and pair must include a team lead
CREATE POLICY "dm send" ON public.direct_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND team_id = public.get_user_team_id(auth.uid())
  AND public.dm_pair_allowed(sender_id, recipient_id, team_id)
);

-- Update: sender can edit their own (used for soft-delete + edits)
CREATE POLICY "dm sender update" ON public.direct_messages
FOR UPDATE USING (sender_id = auth.uid());

-- Team lead can hard-delete any DM in their team
CREATE POLICY "team lead deletes dm" ON public.direct_messages
FOR DELETE USING (
  public.is_team_lead(auth.uid())
  AND team_id = public.get_user_team_id(auth.uid())
);

-- 2. DM read state (per recipient pair)
CREATE TABLE IF NOT EXISTS public.dm_read_state (
  user_id uuid NOT NULL,
  peer_id uuid NOT NULL,
  team_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, peer_id)
);
ALTER TABLE public.dm_read_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own dm read state" ON public.dm_read_state
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Avatar URL on profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 4. Avatars storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars (folder = user_id)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Realtime for DMs
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;