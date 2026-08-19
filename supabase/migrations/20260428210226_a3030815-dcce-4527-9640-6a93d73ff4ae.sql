
REVOKE EXECUTE ON FUNCTION public.get_user_team_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_lead(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "system can insert notifications" ON public.notifications;
CREATE POLICY "users insert notifications for self or team lead inserts" ON public.notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_team_lead(auth.uid()));
