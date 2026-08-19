ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS read_receipts boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "teammates can view chat read state" ON public.chat_read_state;
CREATE POLICY "teammates can view chat read state"
ON public.chat_read_state FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    team_id = public.get_user_team_id(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = chat_read_state.user_id AND p.read_receipts)
  )
);

DROP POLICY IF EXISTS "peer can view dm read state" ON public.dm_read_state;
CREATE POLICY "peer can view dm read state"
ON public.dm_read_state FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    peer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = dm_read_state.user_id AND p.read_receipts)
  )
);

GRANT SELECT ON public.chat_read_state TO authenticated;
GRANT SELECT ON public.dm_read_state TO authenticated;