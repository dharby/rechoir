CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  type text NOT NULL,
  template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view templates"
  ON public.notification_templates FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team leads can manage templates"
  ON public.notification_templates FOR ALL TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()))
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND public.is_team_lead(auth.uid()));

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();