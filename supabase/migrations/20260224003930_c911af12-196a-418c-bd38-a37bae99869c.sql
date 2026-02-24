
-- Table for storing integration configs (webhook URLs, API keys)
CREATE TABLE public.integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  label text,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read integration configs"
  ON public.integration_configs FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert integration configs"
  ON public.integration_configs FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update integration configs"
  ON public.integration_configs FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete integration configs"
  ON public.integration_configs FOR DELETE
  USING (is_admin());

-- Seed default config for n8n webhook
INSERT INTO public.integration_configs (key, label, description, value)
VALUES ('N8N_WEBHOOK_URL', 'Webhook n8n', 'URL do webhook n8n para envio de mensagens via UnniChat/WhatsApp', '');
