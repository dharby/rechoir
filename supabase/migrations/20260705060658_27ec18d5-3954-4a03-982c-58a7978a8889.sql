ALTER TABLE public.broadcasts ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE public.broadcasts
  ALTER COLUMN priority TYPE text
  USING CASE priority::text
    WHEN '1' THEN 'low'
    WHEN '2' THEN 'normal'
    WHEN '3' THEN 'high'
    WHEN '4' THEN 'critical'
    ELSE 'normal'
  END;
ALTER TABLE public.broadcasts ALTER COLUMN priority SET DEFAULT 'normal';
ALTER TABLE public.broadcasts ALTER COLUMN priority SET NOT NULL;