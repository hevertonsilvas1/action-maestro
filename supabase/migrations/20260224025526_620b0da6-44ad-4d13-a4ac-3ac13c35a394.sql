
-- Add PIX holder fields to winners table
ALTER TABLE public.winners
  ADD COLUMN IF NOT EXISTS pix_holder_name text,
  ADD COLUMN IF NOT EXISTS pix_holder_doc text,
  ADD COLUMN IF NOT EXISTS pix_observation text,
  ADD COLUMN IF NOT EXISTS pix_registered_by text,
  ADD COLUMN IF NOT EXISTS pix_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_validated_by text,
  ADD COLUMN IF NOT EXISTS pix_validated_at timestamptz;

-- Allow support to insert winners (for manual creation)
CREATE POLICY "Support can insert winners"
  ON public.winners
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));

-- Allow support to insert audit logs
CREATE POLICY "Support can insert audit log"
  ON public.action_audit_log
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));
