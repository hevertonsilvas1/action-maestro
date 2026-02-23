-- Add columns needed for winner import deduplication
ALTER TABLE public.winners 
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS prize_datetime timestamp with time zone;

-- Create unique index for deduplication (action + prize_type + cpf + datetime + value)
CREATE UNIQUE INDEX IF NOT EXISTS idx_winners_dedup 
  ON public.winners (action_id, prize_type, cpf, prize_datetime, value) 
  WHERE cpf IS NOT NULL AND prize_datetime IS NOT NULL;

-- Create import_logs table for tracking imports
CREATE TABLE public.import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  file_type text NOT NULL, -- 'pdf', 'xlsx', 'csv'
  file_name text,
  total_found integer NOT NULL DEFAULT 0,
  total_imported integer NOT NULL DEFAULT 0,
  total_duplicates integer NOT NULL DEFAULT 0,
  total_invalid integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read import logs"
  ON public.import_logs FOR SELECT
  USING (is_authenticated_user());

CREATE POLICY "Authenticated can insert import logs"
  ON public.import_logs FOR INSERT
  WITH CHECK (is_authenticated_user());