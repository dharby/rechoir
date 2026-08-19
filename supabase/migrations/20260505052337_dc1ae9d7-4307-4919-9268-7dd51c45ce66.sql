
-- Attachments on group chat
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- DM parity: attachments, pin, reply
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid;

-- Allow self-DM (notes to self) — also keep member↔lead rule
CREATE OR REPLACE FUNCTION public.dm_pair_allowed(_a uuid, _b uuid, _team uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- self-DM always allowed within own team
    CASE WHEN _a = _b THEN
      EXISTS (SELECT 1 FROM public.profiles WHERE id = _a AND team_id = _team)
    ELSE
      EXISTS (
        SELECT 1
        FROM public.profiles pa
        JOIN public.profiles pb ON pb.id = _b
        WHERE pa.id = _a
          AND pa.team_id = _team
          AND pb.team_id = _team
          AND (pa.role = 'team_lead' OR pb.role = 'team_lead')
      )
    END;
$$;

-- DM reactions
CREATE TABLE IF NOT EXISTS public.dm_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm reactions select"
  ON public.dm_message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.direct_messages d
    WHERE d.id = dm_message_reactions.message_id
      AND (d.sender_id = auth.uid() OR d.recipient_id = auth.uid())
  ));
CREATE POLICY "user manages own dm reactions"
  ON public.dm_message_reactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DM stars
CREATE TABLE IF NOT EXISTS public.dm_message_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
ALTER TABLE public.dm_message_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own dm stars"
  ON public.dm_message_stars FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage bucket for chat & DM attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (URLs are unguessable uuids)
DROP POLICY IF EXISTS "chat attachments public read" ON storage.objects;
CREATE POLICY "chat attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat attachments user upload" ON storage.objects;
CREATE POLICY "chat attachments user upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "chat attachments user update" ON storage.objects;
CREATE POLICY "chat attachments user update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "chat attachments user delete" ON storage.objects;
CREATE POLICY "chat attachments user delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
