
-- Prevent duplicate imports of the same rehearsal
CREATE UNIQUE INDEX IF NOT EXISTS service_events_team_date_title_kind_key
  ON public.service_events(team_id, date, title, kind);

-- Backfill service_events from rehearsals as kind='rehearsal'
INSERT INTO public.service_events
  (team_id, title, kind, date, start_time, end_time, location, notes, late_after, priority, created_at)
SELECT r.team_id, r.title, 'rehearsal'::service_event_kind, r.date,
       r.start_time, r.end_time, r.location, r.agenda, r.late_after, r.priority, r.created_at
FROM public.rehearsals r
ON CONFLICT (team_id, date, title, kind) DO NOTHING;

-- Backfill service_attendance from attendance
INSERT INTO public.service_attendance
  (event_id, member_id, status, arrival_time, remark, verified_by, verified_at, overridden, source, marked_at)
SELECT se.id, a.member_id,
  (CASE a.status::text
    WHEN 'present' THEN 'on_time'
    WHEN 'late'    THEN 'late'
    WHEN 'absent'  THEN 'absent'
    WHEN 'excused' THEN 'excused'
    ELSE 'absent'
  END)::punctuality_status,
  a.arrival_time, a.remark, a.verified_by, a.verified_at, a.overridden, a.source,
  COALESCE(a.arrival_time, now())
FROM public.attendance a
JOIN public.rehearsals r     ON r.id = a.rehearsal_id
JOIN public.service_events se ON se.team_id = r.team_id
                             AND se.date    = r.date
                             AND se.title   = r.title
                             AND se.kind    = 'rehearsal'
ON CONFLICT (event_id, member_id) DO NOTHING;
