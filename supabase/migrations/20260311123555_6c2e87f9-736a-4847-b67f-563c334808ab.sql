
-- Create automation_logs table for tracking every automation dispatch
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.window_messages(id) ON DELETE SET NULL,
  automation_name text,
  automation_type text,
  winner_id uuid REFERENCES public.winners(id) ON DELETE SET NULL,
  action_id uuid REFERENCES public.actions(id) ON DELETE SET NULL,
  action_name text,
  trigger_source text, -- 'manual', 'auto_attach', 'auto_inbound', 'system'
  url_called text NOT NULL,
  http_method text NOT NULL DEFAULT 'POST',
  payload_sent jsonb,
  status_code integer,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read automation_logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert automation_logs"
  ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Service role inserts bypass RLS, so edge functions using service client can always insert.

-- Index for quick lookups
CREATE INDEX idx_automation_logs_winner_id ON public.automation_logs(winner_id);
CREATE INDEX idx_automation_logs_created_at ON public.automation_logs(created_at DESC);
