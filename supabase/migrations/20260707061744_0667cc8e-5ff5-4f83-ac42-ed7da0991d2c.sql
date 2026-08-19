
ALTER TABLE public.service_attendance
  ADD CONSTRAINT service_attendance_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.service_events(id) ON DELETE CASCADE;

ALTER TABLE public.service_attendance
  ADD CONSTRAINT service_attendance_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
