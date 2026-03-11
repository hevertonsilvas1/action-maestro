ALTER TABLE public.window_messages ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.window_messages ALTER COLUMN content DROP NOT NULL;