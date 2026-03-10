
ALTER TABLE public.window_messages
  ADD COLUMN scope varchar(50) NOT NULL DEFAULT 'global',
  ADD COLUMN scope_value text NULL,
  ADD COLUMN priority integer NOT NULL DEFAULT 1;
