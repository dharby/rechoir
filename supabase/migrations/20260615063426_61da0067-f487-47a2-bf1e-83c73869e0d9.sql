
CREATE POLICY "member self sign-in attendance"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND status IN ('present','late')
  AND EXISTS (
    SELECT 1 FROM public.rehearsals r
    WHERE r.id = attendance.rehearsal_id
      AND r.team_id = public.get_user_team_id(auth.uid())
  )
);

CREATE POLICY "member self sign-in service"
ON public.service_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  member_id = auth.uid()
  AND status IN ('on_time','late')
  AND EXISTS (
    SELECT 1 FROM public.service_events e
    WHERE e.id = service_attendance.event_id
      AND e.team_id = public.get_user_team_id(auth.uid())
  )
);
