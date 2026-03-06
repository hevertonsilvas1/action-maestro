ALTER TABLE public.winners
  ADD COLUMN IF NOT EXISTS template_reopen_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_reopen_count integer NOT NULL DEFAULT 0;