ALTER TABLE public.window_messages
  ADD COLUMN min_value numeric DEFAULT NULL,
  ADD COLUMN max_value numeric DEFAULT NULL;