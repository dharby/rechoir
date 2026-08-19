
-- Allow team leads to update/delete their broadcasts
CREATE POLICY "team lead updates broadcasts"
  ON public.broadcasts FOR UPDATE
  USING (is_team_lead(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
  WITH CHECK (is_team_lead(auth.uid()) AND team_id = get_user_team_id(auth.uid()));

CREATE POLICY "team lead deletes broadcasts"
  ON public.broadcasts FOR DELETE
  USING (is_team_lead(auth.uid()) AND team_id = get_user_team_id(auth.uid()));

-- Allow team leads to delete chat messages in their team
CREATE POLICY "team lead deletes chat messages"
  ON public.chat_messages FOR DELETE
  USING (is_team_lead(auth.uid()) AND team_id = get_user_team_id(auth.uid()));
