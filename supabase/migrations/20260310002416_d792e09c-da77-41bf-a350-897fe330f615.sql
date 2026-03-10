
-- Create winner_statuses table
CREATE TABLE public.winner_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  slug varchar(100) NOT NULL UNIQUE,
  color varchar(20) NOT NULL DEFAULT '#6b7280',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  update_mode varchar(20) NOT NULL DEFAULT 'manual',
  trigger_event varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.winner_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can read winner_statuses"
  ON public.winner_statuses FOR SELECT
  TO authenticated
  USING (public.is_authenticated_user());

CREATE POLICY "Admins can insert winner_statuses"
  ON public.winner_statuses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update winner_statuses"
  ON public.winner_statuses FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete winner_statuses"
  ON public.winner_statuses FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Seed with existing enum values
INSERT INTO public.winner_statuses (name, slug, color, description, sort_order, is_default, update_mode, trigger_event) VALUES
  ('Importado', 'imported', '#6b7280', 'Ganhador recém-importado no sistema', 0, true, 'automatic', 'winner_created'),
  ('Pix Solicitado', 'pix_requested', '#3b82f6', 'Solicitação de chave PIX enviada', 1, false, 'automatic', 'pix_request_sent'),
  ('Aguardando Pix', 'awaiting_pix', '#60a5fa', 'Aguardando resposta do ganhador com chave PIX', 2, false, 'manual', NULL),
  ('Pix Recebido', 'pix_received', '#8b5cf6', 'Chave PIX recebida e validada', 3, false, 'automatic', 'pix_key_received'),
  ('Pronto para Pagar', 'ready_to_pay', '#8b5cf6', 'Pagamento pronto para ser processado', 4, false, 'manual', NULL),
  ('Enviado para Lote', 'sent_to_batch', '#60a5fa', 'Incluído em lote de pagamento', 5, false, 'manual', NULL),
  ('Aguardando Comprovante', 'awaiting_receipt', '#f59e0b', 'Pagamento realizado, aguardando comprovante', 6, false, 'manual', NULL),
  ('Pago', 'paid', '#22c55e', 'Pagamento confirmado', 7, false, 'automatic', 'payment_registered'),
  ('Comprovante Anexado', 'receipt_attached', '#f97316', 'Comprovante anexado, pendente de envio', 8, false, 'automatic', 'receipt_attached'),
  ('Comprovante Enviado', 'receipt_sent', '#22c55e', 'Comprovante enviado ao ganhador', 9, false, 'automatic', 'receipt_sent'),
  ('Pix Recusado', 'pix_refused', '#ef4444', 'Chave PIX recusada ou inválida', 10, false, 'manual', 'manual_review_required'),
  ('Número Inexistente', 'numero_inexistente', '#ef4444', 'Número de telefone não encontrado', 11, false, 'manual', NULL),
  ('Cliente Não Responde', 'cliente_nao_responde', '#ef4444', 'Ganhador não respondeu às tentativas de contato', 12, false, 'manual', NULL);
